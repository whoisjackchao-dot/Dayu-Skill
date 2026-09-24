# Preflight：依赖检测与安装

ultra 与 `dayu` 的唯一结构性区别就是这一层。**在做任何阶段工作之前先跑它。**

```bash
bash <skill-dir>/tools/preflight.sh              # 只检测并报告
bash <skill-dir>/tools/preflight.sh --install    # 缺什么装什么，然后复检
bash <skill-dir>/tools/preflight.sh --check-vendor   # 检查 vendor 副本是否与 dayu 漂移
```

## 1. 四个依赖是什么

| # | 名称 | 坐标 | 提供什么 | 对应阶段 |
| --- | --- | --- | --- | --- |
| 1 | **oh-my-opencode** | npm `oh-my-openagent` | 异步子代理、策划过的 agents、LSP/AST 工具、MCP 集合 | 阶段 3（并行） |
| 2 | **superpowers** | `github.com/obra/superpowers` | 计划 / TDD / 调试 / 审查 / 验证等工程流技能 | 阶段 2–6 |
| 3 | **qiushi-skill** | `github.com/HughYau/qiushi-skill` | 实事求是、矛盾分析、调查研究、群众路线、批评与自我批评等 11 个方法论技能 | 阶段 0/1/5 |
| 4 | **grill-me** | `github.com/RobMitt/grill-me-skill` | 逼问式访谈：一次一个问题，直到设计树每个分支都有答案 | 阶段 1 |

**注意坐标不一致**：仓库叫 `oh-my-opencode`，但 **npm 包名是 `oh-my-openagent`**。装的时候用后者，检测时要同时匹配两个字符串。

## 2. 检测方法（三条独立证据）

不要只看一处。每条依赖用**多条证据交叉验证**，任一命中即视为已安装：

| 依赖 | 证据 A：插件配置 | 证据 B：技能名在册 | 证据 C：落盘位置 |
| --- | --- | --- | --- |
| oh-my-opencode | `plugin` 数组含 `oh-my-openagent` / `oh-my-opencode` | — | `~/.config/opencode/node_modules/oh-my-*` |
| superpowers | `plugin` 数组含 `superpowers` | 技能 `using-superpowers` 存在 | `~/.cache/opencode/packages/superpowers@*/node_modules/superpowers/skills/` |
| qiushi-skill | — | 技能 `arming-thought` **且** `contradiction-analysis` 存在 | `~/.config/opencode/skills/arming-thought/` |
| grill-me | — | 技能 `grill-me` 存在 | `~/.config/opencode/skills/grill-me/SKILL.md` |

**为什么必须多证据**：superpowers 的技能不在 `skills/` 目录下，而是由插件从 **`~/.cache/opencode/packages/`** 里提供；qiushi 则是把 11 个技能**复制**进 `~/.config/opencode/skills/`。只按路径判断会漏判。

**技能名必须从 frontmatter 读**，不要用目录名猜——目录名与 `name:` 理论上必须一致，但外部安装器不保证。

## 3. 安装命令

按依赖逐个安装。`-g` = 写全局配置（`~/.config/opencode/opencode.json`）。

### 3.1 grill-me（最轻，优先）

上游仓库根目录就是 `SKILL.md`，没有构建步骤。

```bash
# 优先：本机 DSH 侧已有同一份（已核实与上游逐字节一致），直接复制
mkdir -p ~/.config/opencode/skills/grill-me
cp ~/.dsh/skills/grill-me/SKILL.md ~/.config/opencode/skills/grill-me/SKILL.md

# 回退：从 GitHub 取
tmp=$(mktemp -d)
git clone --depth 1 https://github.com/RobMitt/grill-me-skill "$tmp/grill-me"
mkdir -p ~/.config/opencode/skills/grill-me
cp "$tmp/grill-me/SKILL.md" ~/.config/opencode/skills/grill-me/SKILL.md
rm -rf "$tmp"
```

> **已知适配问题（待验证）**：upstream 的 SKILL.md 要求"每个问题都用 **AskUserQuestion** 工具"。这是 Claude Code 的工具名，OpenCode 侧是否有同名工具**未经验证**。若 OpenCode 无此工具，逼问会退化为普通文本提问——**这不影响流程有效性，但要在索引里标注**，不要假装与 Claude Code 行为一致。

### 3.2 oh-my-opencode

```bash
opencode plugin oh-my-openagent -g
```

### 3.3 superpowers

```bash
opencode plugin "superpowers@git+https://github.com/obra/superpowers.git" -g
```

首次安装会拉取仓库到 `~/.cache/opencode/packages/`，**需要网络**；之后离线可用。

### 3.4 qiushi-skill

```bash
npx qiushi-skill install --target opencode --scope user
```

无 Node.js 时，把仓库 `skills/` 下的目录整体复制到 `~/.config/opencode/skills/`。

## 4. 复检与生效

安装完成后**必须复检**，并且知道：

> **OpenCode 的配置只在进程启动时加载一次，不做热重载。**
> 新装的插件与技能**在重启 OpenCode 之后才会出现在模型面前**。

所以 preflight 的完整闭环是：

```
检测 → 安装缺失项 → 复检文件系统 → 提示用户重启 OpenCode → 重启后确认技能在册
```

**在用户重启之前，不要把"已安装"当成"已可用"** —— 那正是本规范禁止的"把文件存在当作功能可用"。

## 5. 降级策略（重要）

依赖装不上（无网络、无 Node、用户不允许、企业代理阻断）时：

| 情况 | 动作 |
| --- | --- |
| 部分缺失 | 显式降级：照 `references/` 的规范继续，**不委派**缺失的那部分；在 `docs/00-index.md` 的"已知不可信"里写明哪几项不可用 |
| 全缺失 | **建议改用 `dayu`** —— ultra 的价值全在编排层，没有依赖就没有 ultra |
| 用户拒绝安装 | 不得反复劝说；记录拒绝事实，按降级走 |

**三条红线：**

1. **不得声称加载了实际未加载的技能。**
2. **不得把"文件已复制"当作"技能可用"。**
3. **降级必须写进索引**，让后续会话知道本次走的是哪条路径。

## 6. 实测状态（2026-09-22 本机）

| 依赖 | 状态 | 证据 |
| --- | --- | --- |
| oh-my-opencode | ✅ 已装 | 插件 `oh-my-openagent@4.19.4` |
| superpowers | ✅ 已装 | 插件 `superpowers@git+https://github.com/obra/superpowers.git`；技能 `using-superpowers` 等 14 个在册 |
| qiushi-skill | ✅ 已装 | `~/.config/opencode/skills/` 下 11 个技能 |
| grill-me | ⚠️ **仅 DSH 侧** | `~/.dsh/skills/grill-me` 存在（与上游 md5 一致）；OpenCode 侧**缺失**，需按 §3.1 安装 |
| `dayu`（互斥检查） | ✅ 已装 | `~/.config/opencode/skills/dayu/` |

复现这张表的命令：

```bash
bash tools/preflight.sh
```
