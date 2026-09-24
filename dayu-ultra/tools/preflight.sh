#!/usr/bin/env bash
# preflight.sh — dayu-ultra 依赖检测与安装
#
#   bash preflight.sh                 只检测并报告
#   bash preflight.sh --install       缺什么装什么，然后复检
#   bash preflight.sh --check-vendor  检查 vendor 副本是否与 dayu 漂移
#   bash preflight.sh --json          机器可读输出
#
# 退出码：0 = 四项依赖齐备；1 = 有缺失；2 = 全部缺失（建议改用 dayu）
#
# 设计约束：必须同时用「插件配置」与「技能名」两条证据交叉验证——
# superpowers 的技能由插件从 ~/.cache/opencode/packages/ 提供，
# 而 qiushi 把技能复制进 ~/.config/opencode/skills/，只按路径判断会漏判。

set -uo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENCODE_HOME="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"
CONFIG_JSON="$OPENCODE_HOME/opencode.json"
CONFIG_JSONC="$OPENCODE_HOME/opencode.jsonc"

# 已核实的上游坐标
NPM_OH_MY="oh-my-openagent"                 # 注意：仓库叫 oh-my-opencode，npm 包名是 oh-my-openagent
GIT_SUPERPOWERS="superpowers@git+https://github.com/obra/superpowers.git"
GIT_GRILL_ME="https://github.com/RobMitt/grill-me-skill"

# ---------- 采集：技能名 ----------
collect_skill_names() {
  local roots=(
    "$OPENCODE_HOME/skills" "$OPENCODE_HOME/skill"
    "$HOME/.claude/skills" "$HOME/.agents/skills"
    "$HOME/.cache/opencode/skills"
    "$PWD/.opencode/skills" "$PWD/.opencode/skill"
  )
  local r f name
  for r in "${roots[@]}"; do
    [ -d "$r" ] || continue
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      name="$(sed -n 's/^name:[[:space:]]*//p' "$f" | head -1 | tr -d '"'"'"'' | tr -d '\r')"
      [ -n "$name" ] || name="$(basename "$(dirname "$f")")"
      printf '%s\n' "$name"
    done < <(find "$r" -maxdepth 3 -name SKILL.md -type f 2>/dev/null)
  done
  # 插件包内置技能（superpowers 走这条路）
  if [ -d "$HOME/.cache/opencode/packages" ]; then
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      name="$(sed -n 's/^name:[[:space:]]*//p' "$f" | head -1 | tr -d '"'"'"'' | tr -d '\r')"
      [ -n "$name" ] || name="$(basename "$(dirname "$f")")"
      printf '%s\n' "$name"
    done < <(find "$HOME/.cache/opencode/packages" -path '*/skills/*/SKILL.md' -type f 2>/dev/null)
  fi
}

# ---------- 采集：插件条目 ----------
collect_plugins() {
  local cfg="$CONFIG_JSON"
  [ -f "$cfg" ] || cfg="$CONFIG_JSONC"
  [ -f "$cfg" ] || { printf ''; return; }
  python3 - "$cfg" <<'PY' 2>/dev/null
import json, re, sys, pathlib
try:
    raw = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
except OSError:
    raise SystemExit
raw = re.sub(r'^\s*//.*$', '', raw, flags=re.M)   # 容忍 jsonc
try:
    data = json.loads(raw)
except ValueError:
    raise SystemExit
for item in data.get("plugin") or []:
    if isinstance(item, str):
        print(item)
    elif isinstance(item, list) and item:
        print(item[0])
PY
}

SKILLS="$(collect_skill_names | sort -u)"
PLUGINS="$(collect_plugins)"

has_skill()  { printf '%s\n' "$SKILLS"  | grep -qx -- "$1"; }
has_plugin() { printf '%s\n' "$PLUGINS" | grep -qi -- "$1"; }

# ---------- 逐项判定 ----------
check_oh_my()      { has_plugin 'oh-my-openagent' || has_plugin 'oh-my-opencode'; }
check_superpowers() { has_plugin 'superpowers' || has_skill 'using-superpowers'; }
check_qiushi()     { has_skill 'arming-thought' && has_skill 'contradiction-analysis'; }
check_grill_me()   { has_skill 'grill-me'; }

report() {
  local ok=0 missing=0
  printf '\n%s\n' "dayu-ultra preflight"
  printf '%s\n'   "───────────────────────────────────────────────────────────"
  printf '  %-26s %-8s %s\n' "依赖" "状态" "证据"
  printf '%s\n'   "───────────────────────────────────────────────────────────"

  if check_oh_my; then
    printf '  %-26s %-8s %s\n' "oh-my-opencode" "✅ 已装" "$(printf '%s\n' "$PLUGINS" | grep -i 'oh-my' | head -1)"
  else
    printf '  %-26s %-8s %s\n' "oh-my-opencode" "❌ 缺失" "插件数组中无 $NPM_OH_MY"; missing=$((missing+1))
  fi

  if check_superpowers; then
    printf '  %-26s %-8s %s\n' "obra/superpowers" "✅ 已装" "$(printf '%s\n' "$PLUGINS" | grep -i 'superpowers' | head -1)"
  else
    printf '  %-26s %-8s %s\n' "obra/superpowers" "❌ 缺失" "无 superpowers 插件，且技能 using-superpowers 不在册"; missing=$((missing+1))
  fi

  if check_qiushi; then
    printf '  %-26s %-8s %s\n' "HughYau/qiushi-skill" "✅ 已装" "技能 arming-thought + contradiction-analysis 在册"
  else
    printf '  %-26s %-8s %s\n' "HughYau/qiushi-skill" "❌ 缺失" "缺 arming-thought 或 contradiction-analysis"; missing=$((missing+1))
  fi

  if check_grill_me; then
    printf '  %-26s %-8s %s\n' "RobMitt/grill-me" "✅ 已装" "技能 grill-me 在册"
  else
    printf '  %-26s %-8s %s\n' "RobMitt/grill-me" "❌ 缺失" "技能 grill-me 不在 OpenCode 技能目录"
    missing=$((missing+1))
  fi

  printf '%s\n'   "───────────────────────────────────────────────────────────"
  if has_skill 'dayu'; then
    printf '  %-26s %-8s %s\n' "dayu（互斥检查）" "⚠️ 已装" "磁盘共存没问题；但同一次会话内不要与 dayu-ultra 同时加载"
  else
    printf '  %-26s %-8s %s\n' "dayu（互斥检查）" "—" "未安装，无互斥风险"
  fi
  printf '  技能总数：%s   插件条目：%s\n' "$(printf '%s\n' "$SKILLS" | grep -c .)" "$(printf '%s\n' "$PLUGINS" | grep -c .)"
  printf '\n'

  if [ "$missing" -eq 0 ]; then
    printf '  ✅ 四项依赖齐备，可以开始 ultra 编排。\n'
    printf '  （若刚装过插件，仍需重启 OpenCode 才会生效。）\n\n'
    return 0
  elif [ "$missing" -eq 4 ]; then
    printf '  ⛔ 四项全部缺失 —— ultra 的价值全在编排层，建议改用 `dayu`。\n'
    printf '  安装：bash %s --install\n\n' "$0"
    return 2
  else
    printf '  ⚠️  缺 %s 项。安装：bash %s --install\n' "$missing" "$0"
    printf '  装不上则按 references/preflight.md §5 显式降级，不得假装已加载。\n\n'
    return 1
  fi
}

install_missing() {
  printf '\n开始安装缺失依赖…\n'
  if ! check_grill_me; then
    printf '→ grill-me\n'
    mkdir -p "$OPENCODE_HOME/skills/grill-me"
    if [ -f "$HOME/.dsh/skills/grill-me/SKILL.md" ]; then
      cp "$HOME/.dsh/skills/grill-me/SKILL.md" "$OPENCODE_HOME/skills/grill-me/SKILL.md"
      printf '   已从本机 DSH 侧复制（与上游逐字节一致，无需网络）\n'
    elif command -v git >/dev/null 2>&1; then
      tmp="$(mktemp -d)"
      if git clone --depth 1 "$GIT_GRILL_ME" "$tmp/grill-me" >/dev/null 2>&1; then
        cp "$tmp/grill-me/SKILL.md" "$OPENCODE_HOME/skills/grill-me/SKILL.md"
        printf '   已从 %s 克隆\n' "$GIT_GRILL_ME"
      else
        printf '   ✗ 克隆失败（网络/代理）\n'
      fi
      rm -rf "$tmp"
    else
      printf '   ✗ 无 git 且本机无副本，无法安装\n'
    fi
  fi

  if ! check_oh_my; then
    printf '→ oh-my-opencode\n'
    if command -v opencode >/dev/null 2>&1; then
      opencode plugin "$NPM_OH_MY" -g && printf '   已写入全局配置\n' || printf '   ✗ 安装失败\n'
    else
      printf '   ✗ 找不到 opencode 命令\n'
    fi
  fi

  if ! check_superpowers; then
    printf '→ superpowers\n'
    if command -v opencode >/dev/null 2>&1; then
      opencode plugin "$GIT_SUPERPOWERS" -g && printf '   已写入全局配置（首次需网络）\n' || printf '   ✗ 安装失败\n'
    else
      printf '   ✗ 找不到 opencode 命令\n'
    fi
  fi

  if ! check_qiushi; then
    printf '→ qiushi-skill\n'
    if command -v npx >/dev/null 2>&1; then
      npx --yes qiushi-skill install --target opencode --scope user \
        && printf '   已安装\n' || printf '   ✗ 安装失败\n'
    else
      printf '   ✗ 无 npx；请手动把上游 skills/ 复制到 %s/skills/\n' "$OPENCODE_HOME"
    fi
  fi

  printf '\n复检…\n'
  SKILLS="$(collect_skill_names | sort -u)"
  PLUGINS="$(collect_plugins)"
}

check_vendor() {
  local dayu="$HOME/.config/opencode/skills/dayu"
  [ -d "$dayu" ] || dayu="$HOME/.dsh/skills/dayu"
  if [ ! -d "$dayu" ]; then
    printf '\n  ⚠️  找不到 dayu 供比对（vendor 漂移检查跳过）\n\n'
    return 0
  fi

  # manifest 的「有意的偏离」表里已登记的，不算漂移
  # 注意：manifest 里写的是 `references/xxx`，而下面循环里的 rel 是相对 references/ 的，
  # 故此处剥掉前缀再比对。
  local declared=""
  if [ -f "$SKILL_DIR/provenance/vendor-manifest.md" ]; then
    declared="$(awk '/^## 有意的偏离/{f=1} f && /^\| `references\//{print}' \
                  "$SKILL_DIR/provenance/vendor-manifest.md" \
                | sed -n 's/^| `\([^`]*\)`.*/\1/p' \
                | sed 's|^references/||')"
  fi

  printf '\nvendor 漂移检查：dayu-ultra/references vs %s/references\n' "$dayu"
  printf '%s\n' "───────────────────────────────────────────────────────────"
  local drift=0 deviated=0 f
  while IFS= read -r f; do
    case "$(basename "$f")" in
      preflight.md|orchestration.md) continue ;;   # ultra 自有文件
    esac
    local rel="${f#"$SKILL_DIR/references/"}"
    local src="$dayu/references/$rel"
    if [ ! -f "$src" ]; then
      printf '  [新增]       %s\n' "$rel"; continue
    fi
    if diff -q "$f" "$src" >/dev/null 2>&1; then
      :
    elif printf '%s\n' "$declared" | grep -qxF -- "$rel"; then
      printf '  [已登记偏离] %s\n' "$rel"; deviated=$((deviated+1))
    else
      printf '  [漂移]       %s\n' "$rel"; drift=$((drift+1))
    fi
  done < <(find "$SKILL_DIR/references" -name '*.md' -type f | sort)
  printf '%s\n' "───────────────────────────────────────────────────────────"
  if [ "$drift" -eq 0 ]; then
    printf '  ✅ 无未登记漂移（已登记偏离 %s 处，见 provenance/vendor-manifest.md）\n\n' "$deviated"
  else
    printf '  ⚠️  %s 个文件与 dayu 不一致且未登记。若为有意修订，请补进 manifest 的「有意的偏离」。\n\n' "$drift"
    return 1
  fi
}

case "${1:-}" in
  --install)      report; install_missing; report ;;
  --check-vendor) check_vendor ;;
  --json)
    python3 - "$(check_oh_my && echo 1 || echo 0)" "$(check_superpowers && echo 1 || echo 0)" \
               "$(check_qiushi && echo 1 || echo 0)" "$(check_grill_me && echo 1 || echo 0)" \
               "$(has_skill dayu && echo 1 || echo 0)" <<'PY'
import json, sys
keys = ["oh_my_opencode", "superpowers", "qiushi_skill", "grill_me", "dayu_installed"]
print(json.dumps(dict(zip(keys, (bool(int(x)) for x in sys.argv[1:6]))), indent=2))
PY
    ;;
  ""|*) report ;;
esac
