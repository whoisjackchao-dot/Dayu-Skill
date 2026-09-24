# 依赖实测记录

> 测量日期：2026-09-22｜测量环境：本机 WSL，OpenCode 1.18.32
> **本文件是证据记录，不是结论摘要。** 每条都附可复现的来源。

## 证据等级说明

沿用 `references/evidence.md` 的五级：**实测** / 类型·源码 / 官方文档 / 拟定设计 / 未验证。

本文件中的"已装"判定均为**实测**（读取本机文件系统与 OpenCode 合并配置），
但请注意其**证明范围**：只能证明**本机当前**的安装状态，不能推断其他机器。

---

## 1. oh-my-opencode

| 项 | 值 |
| --- | --- |
| 仓库 | `github.com/sodam-ai/oh-my-opencode`（官方文档） |
| npm 包名 | **`oh-my-openagent`**（注意与仓库名不一致） |
| 实测状态 | ✅ 已装 |
| 证据 | `opencode debug config` 的 `plugin` 数组含 `oh-my-opencode` → 实际条目 `"oh-my-openagent@4.19.4"` |
| 落盘 | `~/.opencode/oh-my-openagent.json`；`~/.opencode/oh-my-opencode.json` 为其符号链接 |
| 证据等级 | 实测（读合并配置）+ 官方文档（仓库身份） |
| **未验证** | 其 agent 列表（Sisyphus / Hephaestus / Prometheus / Atlas / Metis / Momus 等）是否**实际可用**、异步子代理是否真能并发——本次未运行，只有配置证据 |

## 2. obra/superpowers

| 项 | 值 |
| --- | --- |
| 仓库 | `github.com/obra/superpowers` |
| 实测状态 | ✅ 已装 |
| 证据 A（插件） | `plugin` 数组含 `"superpowers@git+https://github.com/obra/superpowers.git"` |
| 证据 B（技能） | `opencode debug skill` 列出 14 个：`using-superpowers` `brainstorming` `writing-plans` `executing-plans` `test-driven-development` `systematic-debugging` `requesting-code-review` `receiving-code-review` `verification-before-completion` `using-git-worktrees` `finishing-a-development-branch` `subagent-driven-development` `dispatching-parallel-agents` `writing-skills` |
| 证据 C（落盘） | `~/.cache/opencode/packages/superpowers@git+https:/github.com/obra/superpowers.git/node_modules/superpowers/skills/` |
| 另有 | `security-research` `security-review` 位于 `~/.cache/opencode/skills`，同属该生态 |
| 证据等级 | 实测 |
| **重要发现** | superpowers 的技能**不在** `~/.config/opencode/skills/`，而由插件从 **`~/.cache/opencode/packages/`** 提供。**只按 skills 目录做检测会漏判**——这正是 preflight 必须交叉验证的原因 |

## 3. HughYau/qiushi-skill

| 项 | 值 |
| --- | --- |
| 仓库 | `github.com/HughYau/qiushi-skill` |
| 实测状态 | ✅ 已装 |
| 证据 A（技能） | 以下 11 个在 `~/.config/opencode/skills/`：`arming-thought` `contradiction-analysis` `practice-cognition` `investigation-first` `mass-line` `criticism-self-criticism` `protracted-strategy` `concentrate-forces` `spark-prairie-fire` `overall-planning` `workflows` |
| 证据 B（命令） | `~/.config/opencode/commands/` 下同名 10 个 slash 命令入口 |
| 安装方式 | 官方为 `npx qiushi-skill install --target opencode --scope user`（官方文档）；本机**实际以何方式装入未核实** |
| 证据等级 | 实测（技能在册）+ 官方文档（安装方式） |
| **未验证** | 其 `agents/investigator.md` 与 `agents/self-critic.md` 两个 subagent 是否已注册可用；`arming-thought` 的会话自动注入 hook 在本机是否生效 |

## 4. RobMitt/grill-me-skill

| 项 | 值 |
| --- | --- |
| 仓库 | `github.com/RobMitt/grill-me-skill` |
| **实测状态（安装前）** | ❌ OpenCode 侧**缺失**；`~/.dsh/skills/grill-me/` 存在（DSH 侧） |
| 内容一致性 | 已核实 DSH 侧 `SKILL.md` 与上游 `main` 分支 raw 文件 **md5 完全相同**（`9eadb4245b105e5c3a20d9204e0b1e1b`）→ 可离线安装 |
| 上游形态 | 仓库根目录即 `SKILL.md`，无构建步骤 |
| 证据等级 | 实测 |
| **已知适配问题（未验证）** | 上游正文要求"每个问题都用 **AskUserQuestion** 工具"——这是 Claude Code 的工具名。OpenCode 侧是否存在同名工具**尚未验证**。若无，逼问将退化为普通文本提问：**流程仍有效，但行为与 Claude Code 不一致，必须标注而非假装相同** |

---

## 互斥检查：`dayu`

| 项 | 值 |
| --- | --- |
| 实测状态 | ✅ 已装（`~/.config/opencode/skills/dayu/`、`~/.dsh/skills/dayu/`） |
| 含义 | 磁盘共存无问题；约束是**同一次会话内不同时加载** `dayu` 与 `dayu-ultra` |
| 已发布 | `github.com/whoisjackchao-dot/Dayu-Skill`（MIT） |

---

## 复现命令

```bash
bash tools/preflight.sh           # 人读表格 + 退出码
bash tools/preflight.sh --json    # 机器可读
```

手工核对（不依赖 opencode 命令）：

```bash
# 插件
python3 -c "import json;print(json.load(open('$HOME/.config/opencode/opencode.json'))['plugin'])"
# 技能
find ~/.config/opencode/skills ~/.claude/skills ~/.cache/opencode/skills \
     ~/.cache/opencode/packages -name SKILL.md 2>/dev/null | wc -l
```

## 本文件不声称的事

- 不声称四个依赖在其他机器上已装——只记录本机状态。
- 不声称插件提供的 agent / subagent **功能可用**——只记录它们**已配置**。功能可用性需要实际运行才能证明，属"未验证"。
- 不声称 grill-me 在 OpenCode 下的行为与 Claude Code 一致——工具名差异尚未验证。
