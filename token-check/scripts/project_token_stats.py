#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""项目 token 消耗统计与费用估算工具(通用版, 全局安装)。

项目识别: 内置关键词为空, 通过 --keywords 传入本项目的高区分度词, 或在同目录
project_token_config.json 的 project_title_keywords 中固化。

数据源: OpenCode SQLite 数据库(session 表自带 tokens_*/cost/model/parent_id 字段)。
范围:   --since 起项目相关会话(含 subagent, 按 parent 链继承归属)。
费用:   DB 已计价的模型直接采用真实 cost; 包月/中转模型按 token_prices.json 估算;
        无单价模型单列用量、不计费, 提示补价。

用法:
  python3 tools/project_token_stats.py                 # 终端汇总
  python3 tools/project_token_stats.py --json out.json # 机器可读导出
  python3 tools/project_token_stats.py --html out.html # 静态报告(内联SVG, 无外部依赖)
  python3 tools/project_token_stats.py --review        # 只列待复核会话(供人工补 overrides)
归类的手工补丁: 编辑同目录 project_token_config.json 的 overrides 映射(会话id -> project|exclude)。
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import os
import sqlite3
import sys
from collections import defaultdict

TOOL_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB = os.path.expanduser("~/.local/share/opencode/opencode.db")
DEFAULT_PRICES = os.path.join(TOOL_DIR, "token_prices.json")
DEFAULT_CONFIG = os.path.join(TOOL_DIR, "project_token_config.json")

# ---------------------------------------------------------------- 配置(默认值, 可被 config json 覆盖)
DEFAULT_CONFIG_DATA = {
    # title 命中即判为项目会话(大小写不敏感的子串)
    "project_title_keywords": [],
    # title 命中即排除(优先于 project 关键词)
    "exclude_title_keywords": [
        "模型接入测试", "连通性测试", "greeting", "hello", "ping", "test message",
        "quick test", "quick ping", "binary search", "alias test", "model garden",
        "代理保持器", "proxy-keeper", "keepproxy", "dsh web",
    ],
    # title 与覆盖词都不命中时, 读首条用户消息按这些词判定
    "project_message_keywords": [],
    # 人工覆盖: 会话id(可只写前缀) -> "project" | "exclude"
    "overrides": {},
}

KIND_PROJECT, KIND_EXCLUDE, KIND_REVIEW = "project", "exclude", "review"


def load_config(path: str) -> dict:
    cfg = dict(DEFAULT_CONFIG_DATA)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            user = json.load(f)
        for k, v in user.items():
            if k == "overrides":
                cfg[k] = {**cfg[k], **v}
            else:
                cfg[k] = v
    return cfg


def load_prices(path: str) -> dict:
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return {"models": {}, "defaults": {"per_provider": {}, "global": {"status": "unknown"}}}


# ---------------------------------------------------------------- DB 读取

def fetch_sessions(db_path: str, since_ms: int) -> list[dict]:
    db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    rows = db.execute(
        """SELECT id, parent_id, title, agent, cost,
                  tokens_input, tokens_output, tokens_reasoning,
                  tokens_cache_read, tokens_cache_write,
                  JSON_EXTRACT(model,'$.providerID') provider,
                  JSON_EXTRACT(model,'$.id') model_id,
                  time_created, time_updated
           FROM session WHERE time_created >= ? ORDER BY time_created""",
        (since_ms,),
    ).fetchall()
    return [dict(r) for r in rows]


def fetch_first_user_texts(db_path: str, session_ids: list[str]) -> dict[str, str]:
    """取每个会话首条用户文本消息(经 part 表), 供模糊会话判定。"""
    out: dict[str, str] = {}
    if not session_ids:
        return out
    db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    ph = ",".join("?" * len(session_ids))
    rows = db.execute(
        f"""SELECT m.session_id, p.data FROM message m JOIN part p ON p.message_id = m.id
            WHERE m.session_id IN ({ph}) AND JSON_EXTRACT(m.data,'$.role')='user'
              AND JSON_EXTRACT(p.data,'$.type')='text'
            ORDER BY m.session_id, p.time_created""",
        session_ids,
    ).fetchall()
    for sid, pdata in rows:
        if sid in out:
            continue
        try:
            out[sid] = (json.loads(pdata).get("text") or "")[:800]
        except json.JSONDecodeError:
            continue
    return out


# ---------------------------------------------------------------- 会话归类

def classify(sessions: list[dict], first_texts: dict[str, str], cfg: dict) -> dict[str, tuple[str, str]]:
    """返回 {session_id: (kind, reason)}。优先级: overrides > parent链 > exclude > project词 > 首消息 > review。"""
    ov = cfg["overrides"]
    excl = [k.lower() for k in cfg["exclude_title_keywords"]]
    proj = [k.lower() for k in cfg["project_title_keywords"]]
    msg_kw = [k.lower() for k in cfg["project_message_keywords"]]

    def override_of(sid: str) -> str | None:
        bare = sid[4:] if sid.startswith("ses_") else sid
        for key, val in ov.items():
            k = key[4:] if key.startswith("ses_") else key
            if bare.startswith(k):
                return val
        return None

    kind: dict[str, tuple[str, str]] = {}

    def judge_main(s: dict) -> tuple[str, str]:
        sid, title = s["id"], (s["title"] or "").lower()
        o = override_of(sid)
        if o:
            return (o, "override")
        t = title
        if any(k in t for k in excl):
            return (KIND_EXCLUDE, f"title命中排除词")
        if any(k in t for k in proj):
            return (KIND_PROJECT, "title命中项目词")
        text = (first_texts.get(sid) or "").lower()
        if text:
            if any(k in text for k in msg_kw):
                return (KIND_PROJECT, "首消息命中项目词")
            return (KIND_REVIEW, "title与首消息均未命中")
        return (KIND_REVIEW, "无title无首消息")

    # 1) 判定所有主会话
    for s in sessions:
        if not s["parent_id"]:
            kind[s["id"]] = judge_main(s)

    # 2) subagent 沿 parent 链向上继承(带环保护)
    by_id = {s["id"]: s for s in sessions}
    for s in sessions:
        if s["id"] in kind:
            continue
        seen, cur, resolved = set(), s["id"], None
        while cur and cur not in seen:
            seen.add(cur)
            if cur in kind:
                resolved = kind[cur]
                break
            o = override_of(cur)
            if o:
                resolved = (o, "override(祖先)")
                break
            cur = by_id.get(cur, {}).get("parent_id")
        kind[s["id"]] = resolved if resolved else (KIND_REVIEW, "parent链未解析")
    return kind


# ---------------------------------------------------------------- 里程碑分段

def aggregate_milestones(proj: list[dict], ms_path: str, prices: dict) -> list[dict]:
    """按里程碑达成日分段聚合。段i = [上一节点upper, 本节点upper), 达成日当天计入该节点(冲刺收尾)。"""
    ms_raw = json.load(open(ms_path, encoding="utf-8"))["milestones"]

    def upper_ms(date_str: str) -> int:
        fmt = "%Y-%m-%dT%H:%M" if "T" in date_str else "%Y-%m-%d"
        t = int(dt.datetime.strptime(date_str, fmt).replace(tzinfo=dt.timezone.utc).timestamp() * 1000)
        return t + 86_399_000 if "T" not in date_str else t

    ms = sorted(
        (
            {
                "id": m["id"],
                "title": m.get("title", ""),
                "basis": m.get("basis", ""),
                "date": m["date"],
                "upper": upper_ms(m["date"]),
            }
            for m in ms_raw
        ),
        key=lambda m: m["upper"],
    )
    segs = []
    lower = min((s["time_created"] for s in proj), default=0)
    for m in ms:
        inseg = [s for s in proj if lower <= s["time_created"] < m["upper"]]
        tokens = defaultdict(int)
        cost_db = cost_est = 0.0
        n_sub = 0
        days = set()
        for s in inseg:
            for fld, v in (
                ("input", s["tokens_input"] or 0), ("output", s["tokens_output"] or 0),
                ("reasoning", s["tokens_reasoning"] or 0), ("cache_read", s["tokens_cache_read"] or 0),
                ("cache_write", s["tokens_cache_write"] or 0),
            ):
                tokens[fld] += v
            cost, basis = estimate_cost(prices, s["provider"], s["model_id"], s)
            if cost is not None:
                if basis == "db":
                    cost_db += cost
                else:
                    cost_est += cost
            if s["parent_id"]:
                n_sub += 1
            days.add(dt.datetime.fromtimestamp(s["time_created"] / 1000).strftime("%Y-%m-%d"))
        span_days = max((m["upper"] - lower) // 86_400_000, 1)
        segs.append({
            "id": m["id"], "title": m["title"], "basis": m["basis"], "date": m["date"],
            "tokens": dict(tokens), "total": sum(tokens.values()),
            "cost_db": round(cost_db, 4), "cost_est": round(cost_est, 4),
            "n_sessions": len(inseg), "n_subagent": n_sub,
            "active_days": len(days), "span_days": span_days,
            "tokens_per_active_day": sum(tokens.values()) // max(len(days), 1),
        })
        lower = m["upper"]
    return segs


# ---------------------------------------------------------------- 计价

def unit_price(prices: dict, provider: str, model_id: str) -> dict:
    models = prices.get("models", {})
    hit = models.get(f"{provider}/{model_id}")
    if hit:
        return hit
    per_provider = prices.get("defaults", {}).get("per_provider", {})
    hit = per_provider.get(provider)
    if hit:
        return hit
    return prices.get("defaults", {}).get("global", {"status": "unknown"})


def estimate_cost(prices: dict, provider: str, model_id: str, s: dict) -> tuple[float | None, str]:
    """返回 (费用USD或None, 依据 basis)。basis: db=DB真实cost / estimated=价目表估算 / unknown=无单价。
    billed 语义严格等于 DB SUM(cost); cost=0 时即使该模型通常计费, 也只做估算、计入 estimated。"""
    if s["cost"] and s["cost"] > 0:
        return s["cost"], "db"
    p = unit_price(prices, provider, model_id)
    if p.get("status") == "unknown" or p.get("in") is None:
        return None, "unknown"
    cost = (
        (s["tokens_input"] or 0) * p["in"]
        + (s["tokens_output"] or 0) * p["out"]
        + (s["tokens_cache_read"] or 0) * p.get("cache_read", 0)
        + (s["tokens_cache_write"] or 0) * p.get("cache_write", 0)
    ) / 1e6
    return cost, "estimated"


# ---------------------------------------------------------------- 聚合

def aggregate(rows: list[dict], prices: dict) -> dict:
    tot = defaultdict(int)
    by_model: dict[str, dict] = {}
    by_day: dict[str, dict] = defaultdict(lambda: defaultdict(int))
    unknown_models: dict[str, int] = defaultdict(int)
    billed = est = 0.0
    est_note_models: set[str] = set()

    for s in rows:
        i, o = s["tokens_input"] or 0, s["tokens_output"] or 0
        r, cr, cw = s["tokens_reasoning"] or 0, s["tokens_cache_read"] or 0, s["tokens_cache_write"] or 0
        key = f"{s['provider']}/{s['model_id']}"
        m = by_model.setdefault(key, {"tokens": defaultdict(int), "cost": 0.0, "cost_db": 0.0, "cost_est": 0.0, "sessions": 0})
        d = dt.datetime.fromtimestamp(s["time_created"] / 1000).strftime("%Y-%m-%d")
        for fld, v in (("input", i), ("output", o), ("reasoning", r), ("cache_read", cr), ("cache_write", cw)):
            tot[fld] += v
            m["tokens"][fld] += v
            by_day[d][fld] += v
        cost, basis = estimate_cost(prices, s["provider"], s["model_id"], s)
        m["sessions"] += 1
        if cost is not None:
            m["cost"] += cost
            if basis == "db":
                m["cost_db"] += cost
                billed += cost
            else:
                m["cost_est"] += cost
                est += cost
                if "estimate_note" in unit_price(prices, s["provider"], s["model_id"]):
                    est_note_models.add(key)
        else:
            unknown_models[key] += i + o + cr + cw

    for m in by_model.values():
        m["status"] = ("billed" if m["cost_db"] > 0 else "") + ("+" if m["cost_db"] > 0 and m["cost_est"] > 0 else "") + ("estimated" if m["cost_est"] > 0 else "") or "unknown"

    return {
        "total": dict(tot),
        "total_all_tokens": sum(tot.values()),
        "by_model": {k: {"tokens": dict(v["tokens"]), "cost": round(v["cost"], 4), "cost_db": round(v["cost_db"], 4), "cost_est": round(v["cost_est"], 4), "status": v["status"], "sessions": v["sessions"]} for k, v in by_model.items()},
        "by_day": {k: dict(v) for k, v in sorted(by_day.items())},
        "cost_billed_real": round(billed, 4),
        "cost_estimated_subscription": round(est, 4),
        "estimated_models_need_review": sorted(est_note_models),
        "unknown_price_models_usage": dict(unknown_models),
        "cache_hit_rate": round(tot["cache_read"] / max(tot["cache_read"] + tot["input"], 1), 4),
    }


# ---------------------------------------------------------------- 展示

def fmt(n: int | float) -> str:
    return f"{n:,.0f}" if isinstance(n, int) else f"{n:,.4f}"


def render_terminal(res: dict, sessions: list[dict], review: list[dict]) -> None:
    a, meta = res["aggregate"], res["meta"]
    days = meta["days"]
    print(f"=== {meta['name']} 项目 token 消耗统计 ===")
    print(f"窗口: {meta['since']} ~ {meta['until']}  (约{days}天)")
    print(f"项目会话: {meta['n_project']} (主会话 {meta['n_main']}, subagent {meta['n_project'] - meta['n_main']})  排除: {meta['n_excl']}  待复核: {meta['n_review']}")
    t = a["total"]
    print(f"\n[总量] input {fmt(t['input'])} | output {fmt(t['output'])} | reasoning {fmt(t['reasoning'])} | cache_read {fmt(t['cache_read'])}")
    print(f"[合计] 全部token {fmt(a['total_all_tokens'])}  日均 {fmt(a['total_all_tokens'] / max(days, 1))}  缓存命中率 {a['cache_hit_rate'] * 100:.1f}%")
    print(f"[费用] 已计价(真实, DB) ${a['cost_billed_real']:.4f} + 包月/中转估算 ${a['cost_estimated_subscription']:.4f} = ${a['cost_billed_real'] + a['cost_estimated_subscription']:.4f}")
    if a["unknown_price_models_usage"]:
        print(f"[未计价] 以下模型无单价, 用量单列: " + ", ".join(f"{k}({fmt(v)})" for k, v in sorted(a['unknown_price_models_usage'].items(), key=lambda x: -x[1])))
    if a["estimated_models_need_review"]:
        print(f"[待核] 估算价请按账单核对: {', '.join(a['estimated_models_need_review'])}")

    print("\n[按模型]  (按总token降序)")
    print(f"{'模型':44}{'会话':>5}{'input':>13}{'output':>11}{'cache_read':>15}{'合计':>15}{'费用$':>11}  状态")
    for k, v in sorted(a["by_model"].items(), key=lambda x: -sum(x[1]["tokens"].values())):
        tk = v["tokens"]
        print(f"{k:44}{v['sessions']:>5}{fmt(tk['input']):>13}{fmt(tk['output']):>11}{fmt(tk['cache_read']):>15}{fmt(sum(tk.values())):>15}{v['cost']:>11.4f}  {v['status']}")

    print("\n[按日] 全部token / 费用估算$")
    for d, v in a["by_day"].items():
        bar = "#" * max(1, int(sum(v.values()) / 2e6))
        print(f"  {d}  {fmt(sum(v.values())):>15}  {bar}")

    if res.get("by_milestone"):
        print("\n[按里程碑] token-per-milestone (达成日当天计入该节点)")
        print(f"{'节点':6}{'窗口':22}{'tokens':>15}{'会话(主+子)':>13}{'活跃天':>7}{'tokens/活跃天':>16}{'费用$真实+估算':>17}")
        for m in res["by_milestone"]:
            win = f"~{m['date'][5:]}" if m["date"] != "2099-01-01" else "至今(进行中)"
            print(f"{m['id']:6}{win:22}{fmt(m['total']):>15}{m['n_sessions'] - m['n_subagent']:>6}+{m['n_subagent']:<5}{m['active_days']:>7}{fmt(m['tokens_per_active_day']):>16}{m['cost_db']:.4f}+{m['cost_est']:.4f}")

    print("\n[TOP12 会话(按token)]")
    for s in sessions[:12]:
        print(f"  {s['date']} {fmt(s['all'])[:10]:>10} {s['provider']}/{s['model_id'][:24]:36} {(s['title'] or '')[:38]}")

    if review:
        print(f"\n[待复核 {len(review)} 个会话] 消耗过token但归属不明; 确认后把id前缀加入 project_token_config.json overrides:")
        for s in review[:15]:
            print(f"  {s['date']} {fmt(s['all'])[:10]:>10} {s['provider']}/{s['model_id'][:24]:36} id={s['id'][:16]} {(s['title'] or '')[:30]}")


SVG_W, SVG_H = 860, 300


def render_html(res: dict, sessions: list[dict], review: list[dict], out_path: str) -> None:
    a, meta = res["aggregate"], res["meta"]
    days = meta["days"]
    e = html.escape

    def bars(data: dict[str, float], color: str, title: str, unit: str) -> str:
        if not data:
            return ""
        mx = max(data.values()) or 1
        bh = 18
        parts = [f"<h3>{e(title)}</h3><svg width='{SVG_W}' height='{len(data) * (bh + 6) + 10}' xmlns='http://www.w3.org/2000/svg' font-family='monospace' font-size='11'>"]
        for n, (k, v) in enumerate(sorted(data.items(), key=lambda x: -x[1])):
            w = int(v / mx * (SVG_W - 330))
            y = n * (bh + 6) + 4
            parts.append(f"<text x='0' y='{y + 13}'>{e(k[:38])}</text>")
            parts.append(f"<rect x='320' y='{y}' width='{max(w, 1)}' height='{bh}' fill='{color}'/>")
            parts.append(f"<text x='{320 + max(w, 1) + 6}' y='{y + 13}'>{v:,.0f}{unit}</text>")
        parts.append("</svg>")
        return "".join(parts)

    day_all = {d: sum(v.values()) for d, v in a["by_day"].items()}
    ms = res.get("by_milestone") or []
    ms_all = {f"{m['id']} {m['title'][:14]}": m["total"] for m in ms}
    ms_per_day = {f"{m['id']} tokens/活跃天": m["tokens_per_active_day"] for m in ms}
    ms_rows = "".join(
        f"<tr><td><b>{e(m['id'])}</b></td><td>{e(m['title'])}</td><td>{'至今(进行中)' if m['date'] == '2099-01-01' else e(m['date'])}</td>"
        f"<td class='r'>{m['total']:,}</td><td class='r'>{m['n_sessions']} ({m['n_sessions'] - m['n_subagent']}+{m['n_subagent']})</td>"
        f"<td class='r'>{m['active_days']}</td><td class='r'>{m['tokens_per_active_day']:,}</td>"
        f"<td class='r'>{m['cost_db']:.4f} + {m['cost_est']:.4f}</td><td>{e(m['basis'])}</td></tr>"
        for m in ms
    )
    ms_section = (
        bars(ms_all, "#7a5", "token-per-milestone (各节点总消耗)", "")
        + bars(ms_per_day, "#c86", "各节点 tokens/活跃天(强度)", "")
        + "<h2>里程碑分段明细</h2><table><tr><th>节点</th><th>定义</th><th>达成日</th><th class='r'>tokens</th><th class='r'>会话(主+子)</th><th class='r'>活跃天</th><th class='r'>tokens/活跃天</th><th class='r'>费用$真实+估算</th><th>证据依据</th></tr>"
        + ms_rows
        + "</table><p><small>日期为证据推断, 修正 tools/milestones.json 后重跑 --milestones 即得新分段。</small></p>"
        if ms
        else ""
    )
    day_out = {d: v["output"] + v["reasoning"] for d, v in a["by_day"].items()}
    model_all = {k: sum(v["tokens"].values()) for k, v in a["by_model"].items()}
    model_cost = {k: v["cost"] for k, v in a["by_model"].items() if v["cost"] > 0}

    rows = "".join(
        f"<tr><td>{e(s['date'])}</td><td>{e(s['provider'] + '/' + s['model_id'])}</td><td class='r'>{s['all']:,}</td>"
        f"<td>{e((s['title'] or '')[:60])}</td><td>{s['id'][:18]}</td></tr>"
        for s in sessions[:25]
    )
    rev = "".join(
        f"<tr><td>{e(s['date'])}</td><td>{s['all']:,}</td><td>{s['id'][:18]}</td><td>{e((s['title'] or '')[:50])}</td></tr>"
        for s in review
    )
    t = a["total"]
    doc = f"""<!DOCTYPE html><html lang="zh"><meta charset="utf-8"><title>{e(meta['name'])} token 消耗统计</title>
<style>body{{font-family:system-ui,sans-serif;margin:24px;max-width:920px;color:#222}}
h2{{border-bottom:2px solid #369;padding-bottom:4px}} table{{border-collapse:collapse;font-size:12px;width:100%}}
td,th{{border:1px solid #ccc;padding:3px 6px}} .r{{text-align:right}} .card{{background:#f4f7fa;padding:10px 16px;border-radius:8px;margin:8px 0}}
.warn{{color:#a00}} small{{color:#666}}</style><body>
<h1>{e(meta['name'])} 项目 Token 消耗报告</h1>
<p>窗口 {e(meta['since'])} ~ {e(meta['until'])} (约{days}天) · 项目会话 {meta['n_project']}(主 {meta['n_main']} / 子代理 {meta['n_project'] - meta['n_main']}) · 排除 {meta['n_excl']} · 待复核 {meta['n_review']} · 生成于 {e(meta['until'])}</p>
<div class="card"><b>总量</b>: input {t['input']:,} · output {t['output']:,} · reasoning {t['reasoning']:,} · cache_read {t['cache_read']:,} → 合计 <b>{a['total_all_tokens']:,}</b> tokens, 日均 {a['total_all_tokens'] // max(days, 1):,}</div>
<div class="card"><b>费用</b>: 真实计价(DeepSeek 直连) <b>${a['cost_billed_real']:.4f}</b> + 包月/中转按牌价估算 ${a['cost_estimated_subscription']:.4f} ≈ <b>${a['cost_billed_real'] + a['cost_estimated_subscription']:.4f}</b>
{(' <span class="warn">未计价模型存在用量: ' + ", ".join(a["unknown_price_models_usage"]) + "</span>") if a["unknown_price_models_usage"] else ""}
<br><small>缓存命中率 {a['cache_hit_rate'] * 100:.1f}% · 估算价待账单核对: {e(", ".join(a["estimated_models_need_review"])) or "无"}</small></div>
{ms_section}{bars(model_all, "#369", "各模型 token 用量", "")}
{bars(model_cost, "#a63", "各模型费用(USD, 含估算)", "$")}
{bars(day_all, "#3a7", "每日 token 总量", "")}
{bars(day_out, "#83a", "每日 output+reasoning(真实生成)", "")}
<h2>TOP25 会话</h2><table><tr><th>日期</th><th>模型</th><th class="r">tokens</th><th>标题</th><th>会话id</th></tr>{rows}</table>
{('<h2>待复核会话(' + str(len(review)) + ')</h2><p>确认归属后写入 tools/project_token_config.json 的 overrides。</p><table><tr><th>日期</th><th class="r">tokens</th><th>会话id</th><th>标题</th></tr>' + rev + "</table>") if review else ""}
<p><small>数据源: OpenCode session 表; 已计价模型费用取 DB 真实 cost; 价格表 tools/token_prices.json v{e(prices_ver)}</small></p>
</body></html>"""
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(doc)


prices_ver = "?"

# ---------------------------------------------------------------- 主流程

def main() -> None:
    global prices_ver
    ap = argparse.ArgumentParser(description="项目 token 消耗统计(通用版, 任意项目可用)")
    ap.add_argument("--db", default=DEFAULT_DB)
    ap.add_argument("--config", default=DEFAULT_CONFIG)
    ap.add_argument("--prices", default=DEFAULT_PRICES)
    ap.add_argument("--since", default="auto",
                    help="统计窗口起点 YYYY-MM-DD; 默认 auto=自动探测项目最早命中会话(推荐)")
    ap.add_argument("--keywords", default="",
                    help="项目识别关键词, 逗号分隔(如 '电纸书,仪表盘,koreader'); 追加到内置关键词之后")
    ap.add_argument("--name", default="", help="项目显示名; 缺省取 --keywords 首词或 '当前项目'")
    ap.add_argument("--milestones", metavar="PATH", help="里程碑配置 JSON(id/title/date/basis), 生成 token-per-milestone 分段统计")
    ap.add_argument("--json", metavar="PATH")
    ap.add_argument("--html", metavar="PATH")
    ap.add_argument("--review", action="store_true", help="只列待复核会话")
    args = ap.parse_args()

    cfg = load_config(args.config)
    project_name = args.name.strip() or cfg.get("name") or (args.keywords.split(",")[0].strip() if args.keywords.strip() else "本项目")
    if args.keywords.strip():
        extra = [k.strip().lower() for k in args.keywords.split(",") if k.strip()]
        cfg["project_title_keywords"] = cfg["project_title_keywords"] + extra
        cfg["project_message_keywords"] = cfg["project_message_keywords"] + extra
    prices = load_prices(args.prices)
    prices_ver = prices.get("version", "?")

    # 全表拉取并在全窗口上归类(避免窗口过滤切断 parent 链), 之后再按窗口过滤统计集合
    sessions = fetch_sessions(args.db, since_ms=0)
    ambiguous = [s for s in sessions if not s["parent_id"]]
    first_texts = fetch_first_user_texts(args.db, [s["id"] for s in ambiguous])
    kind = classify(sessions, first_texts, cfg)

    if args.since.lower() == "auto":
        proj_ts = sorted(s["time_created"] for s in sessions if kind[s["id"]][0] == KIND_PROJECT)
        if not proj_ts:
            print(f"未发现命中项目 [{project_name}] 关键词的会话。请检查 --keywords 或用 --since YYYY-MM-DD 显式指定窗口。")
            return 1
        # 断点启发式: 项目是连续工作段, 取最后一个 >72h 活动间隔之后的首会话为窗口起点,
        # 避免更早期的孤立关键词命中把窗口拉到项目真正开始之前
        cut = 0
        for i in range(1, len(proj_ts)):
            if proj_ts[i] - proj_ts[i - 1] > 72 * 3600 * 1000:
                cut = i
        since_ms = proj_ts[cut]
        since_str = dt.datetime.fromtimestamp(since_ms / 1000).strftime("%Y-%m-%d %H:%M")
        if cut > 0:
            skipped = sum(1 for t in proj_ts if t < since_ms)
            print(f"[提示] auto 窗口在 {since_str} 前检测到 ≥72h 活动断点, 已截去更早的 {skipped} 个命中会话;")
            print("       若项目为间歇性节奏(隔数日一工作), 请用 --since YYYY-MM-DD 指定完整起点。")
    else:
        since_dt = dt.datetime.strptime(args.since, "%Y-%m-%d").replace(tzinfo=dt.timezone.utc)
        since_ms = int(since_dt.timestamp() * 1000)
        since_str = args.since

    proj, review = [], []
    for s in sessions:
        if s["time_created"] < since_ms:
            continue
        s["all"] = (s["tokens_input"] or 0) + (s["tokens_output"] or 0) + (s["tokens_reasoning"] or 0) + (s["tokens_cache_read"] or 0) + (s["tokens_cache_write"] or 0)
        s["date"] = dt.datetime.fromtimestamp(s["time_created"] / 1000).strftime("%m-%d %H:%M")
        (proj if kind[s["id"]][0] == KIND_PROJECT else review if kind[s["id"]][0] == KIND_REVIEW else []).append(s)

    review = [s for s in review if s["all"] > 0]  # 零消耗会话不值得复核
    proj.sort(key=lambda s: -s["all"])
    days = (dt.datetime.now() - dt.datetime.fromtimestamp(min(s["time_created"] for s in proj) / 1000)).days + 1 if proj else 0
    res = {
        "meta": {
            "name": project_name,
            "since": since_str,
            "until": dt.datetime.now().strftime("%Y-%m-%d %H:%M"),
            "days": days,
            "n_project": len(proj),
            "n_main": sum(1 for s in proj if not s["parent_id"]),
            "n_excl": sum(1 for s in sessions if kind[s["id"]][0] == KIND_EXCLUDE),
            "n_review": len(review),
        },
        "aggregate": aggregate(proj, prices),
        "review": [{"id": s["id"], "date": s["date"], "all": s["all"], "title": s["title"]} for s in review],
    }

    if args.milestones:
        res["by_milestone"] = aggregate_milestones(proj, args.milestones, prices)

    if args.review:
        for s in review:
            print(f"{s['date']} {s['all']:>12,} {s['provider']}/{s['model_id'][:26]:36} id={s['id'][:20]} {(s['title'] or '')[:36]}")
        return
    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(res, f, ensure_ascii=False, indent=1)
        print(f"JSON 已写入 {args.json}")
    if args.html:
        render_html(res, proj, review, args.html)
        print(f"HTML 报告已写入 {args.html}")
    render_terminal(res, proj, review)


if __name__ == "__main__":
    main()
