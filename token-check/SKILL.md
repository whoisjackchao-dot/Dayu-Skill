---
name: token-check
description: Use when 用户要求统计某个项目的 token 消耗量、AI 用量、模型费用、成本评估, 或要求评估项目资源消耗水平、给消耗优化建议; 触发词包括 token 统计、消耗统计、费用对账、/token-check、多模型成本、用量仪表。适用于 OpenCode 单机环境, 从本机所有 coding-agent 会话库聚合统计。
---

# token-check: 项目 token 消耗统计与优化建议

## Overview

从 OpenCode SQLite 库的 `session` 表聚合任意项目的 token 消耗与费用, 并按实证阈值给优化建议。三条铁律:

1. **归类先于数字**: 会话归属未闭环(有待复核)前, 一切总量都不可信。
2. **费用三分口径**: billed(DB 真实账面) / estimated(价目表估算) / unknown(无单价只计 token), 严禁混加后当作"实际花费"。
3. **窗口以数据为准**: 项目真实起点用会话数据探测, 不信文档记载的日期。

## Quick Start

```bash
python3 <本skill目录>/scripts/project_token_stats.py \
  --keywords "项目词1,项目词2" \
  --name "项目名" \
  [--since YYYY-MM-DD] \
  [--milestones milestones.json] \
  [--html ./evidence/token-stats/<日期>-token消耗统计.html --json 同目录.json]
```

`--milestones`: 里程碑配置 JSON(`{"milestones":[{"id","title","date","basis"}]}`, date 支持
`YYYY-MM-DD` 或小时精度 `YYYY-MM-DDTHH:MM`; 末节点可用远期日期作"进行中"占位), 生成
token-per-milestone 分段: 每节点 tokens/会话(主+子)/活跃天/强度(tokens/活跃天)/费用。
达成日按证据填写并注明依据, 用户可修正后重跑。各段之和恒等于总量(守恒自检)。

- `--keywords`: 2~5 个高区分度词(项目代号、专有模块名; 避开 asr/bridge/api 通用词)。缺省时从项目目录名和 README 首屏派生, 运行前向用户确认。
- `--since auto`(默认): 自动探测窗口; 若打印 ≥72h 断点警告且项目为间歇节奏, 改用显式 `--since`。
- `--review`: 只列待复委会话, 供人工归类。

## 方法: 四步闭环

1. **定窗口**: 全表归类后自动探测项目起点(或用户指定)。
2. **归类**(四级, 优先级从高到低): 人工 overrides > parent 链继承(子代理跟主会话) > 标题关键词 > 首条用户消息判定; 仍不明 → 待复核清单, **绝不瞎猜**。待复委会话确认后把 id 前缀写入 `scripts/project_token_config.json` 的 overrides 并重跑验证归零。
3. **计费**: billed 用 DB 原值; cost=0 的会话即使模型通常计费也只做估算进 estimated; unknown 模型提醒用户补 `scripts/token_prices.json`(估算价须标注来源与误差)。
4. **验证**: billed 与 `SELECT SUM(cost)` 直查对账(差 <0.0001); 抽查排除集是否含项目词误伤、关键 subagent 是否归入。

## 已踩过的坑(规则来源: ESP32-S3M5 项目 14 天实证)

| 坑 | 规则 |
|---|---|
| 排除词 "dayu" 误杀 2.54 亿 tokens 的项目流程会话 | 归类完成后必查: 排除集 title 含项目关键词的会话 = 误伤 |
| 文档说 09-15 开始, 实际首会话 09-11 | 窗口起点以 DB 数据为准 |
| 同批会话被多平台/镜像检出 | 计数前识别镜像存储(如 ~/.claude/transcripts 是 OpenCode 会话镜像), 不重复计 |
| cost=0 会话用拟合价补算后混入 billed, 对账差 0.6% | billed 语义严格等于 DB SUM(cost), fallback 估算一律进 estimated |
| 拟合价共线不稳(负单价/大残差) | 价目表估算价必须标注来源与平均误差 |

## 优化建议检查清单(advice 模式, 阈值为实证值)

1. 待复核 > 0 → 先走归类复核, 再谈数字
2. 元会话(title 含"查找/历史/恢复")token 占比 > 10% → 建立每日收工交接文档
3. 缓存命中率 < 90% → 检查提示词前缀稳定性(动态注入/换模型破坏缓存)
4. 最大单会话 > 1 亿 tokens → 以里程碑/契约为界切分会话
5. 子代理占比过低 → 探索/验证类工作委派子代理(用完即弃不污染主会话)
6. unknown 模型有用量 → 补价目表, 否则费用被系统性低估
7. 单日峰值 > 总量 30% → 排查流程性/恢复性大消耗
8. 费用陈述: 真实与估算必须分开, 严禁混加

## 输出纪律

先数字后建议; 每条建议标注依据(指标、阈值、实际值); 待复核存在时所有数字标注"含待复核误差"; 区分数据实证与推测。
