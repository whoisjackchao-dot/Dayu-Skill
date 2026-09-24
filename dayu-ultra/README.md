# dayu-ultra

`dayu` 的**编排增强版**。在六阶段可审计流程之外，多了一层**依赖感知与协作编排**：开工先跑 preflight，缺依赖先装，然后每个阶段把工作委派给最合适的协作技能。

> **与 `dayu` 互斥。** 两者内容高度重叠（ultra 已 vendor `dayu` 的全部参考文件），**同一次会话内不要同时加载**。
> 想要零依赖、离线、干净跑一遍 → 用 `dayu`。想要编排 → 用 `dayu-ultra`。

---

## 与 dayu 的差异

| | `dayu` | `dayu-ultra` |
| --- | --- | --- |
| 依赖 | **零依赖** | 4 个协作技能栈 |
| 参考文件 | 自有 | vendor 自 `dayu` + 2 份自有（preflight / orchestration） |
| 阶段划分 | 0–6 | 0–6（相同） |
| 铁律 | 12 条 | 12 条 + **3 条编排铁律** |
| 冲突裁决 | — | 已登记 3 处与协作技能的规范冲突及裁决 |
| 启动动作 | 建文档骨架 | **先跑 preflight** |

## 四个依赖

| 依赖 | 坐标 | 提供什么 |
| --- | --- | --- |
| **oh-my-opencode** | npm `oh-my-openagent` | 异步子代理、策划过的 agents、LSP/AST 工具 |
| **obra/superpowers** | `github.com/obra/superpowers` | 计划 / TDD / 调试 / 审查 / 验证等 14+ 技能 |
| **HughYau/qiushi-skill** | `github.com/HughYau/qiushi-skill` | 实事求是、矛盾分析、调查研究、批评与自我批评等 11 技能 |
| **RobMitt/grill-me-skill** | `github.com/RobMitt/grill-me-skill` | 逼问式访谈直到达成共识 |

> **注意坐标不一致**：仓库叫 `oh-my-opencode`，**npm 包名是 `oh-my-openagent`**。

### 本机实测状态（2026-09-22）

| 依赖 | 状态 | 证据 |
| --- | --- | --- |
| oh-my-opencode | ✅ 已装 | 插件 `oh-my-openagent@4.19.4` |
| superpowers | ✅ 已装 | 插件 `superpowers@git+…/obra/superpowers.git`；技能 `using-superpowers` 等 14 个在册 |
| qiushi-skill | ✅ 已装 | `~/.config/opencode/skills/` 下 11 个技能 |
| grill-me | 见 preflight | 本机原仅 DSH 侧存在，OpenCode 侧由 preflight 补装 |

复现：`bash tools/preflight.sh`

---

## 用法

```bash
bash tools/preflight.sh              # 检测并报告（退出码 0/1/2）
bash tools/preflight.sh --install    # 缺什么装什么，然后复检
bash tools/preflight.sh --check-vendor   # 检查 vendor 副本与 dayu 是否漂移
bash tools/preflight.sh --json       # 机器可读
```

在 OpenCode 里：

```
/dayu-ultra <任务>
```

或直接描述匹配的任务（`description` 里带了触发词），也可以显式说「加载 dayu-ultra skill」。

> **装完插件/技能后必须重启 OpenCode。** 配置只在进程启动时读一次，不做热重载。

---

## 结构

```
dayu-ultra/
├── SKILL.md                    agent 入口：互斥规则、preflight 门、阶段×协作矩阵、15 条铁律
├── README.md                   本文件
├── tools/
│   └── preflight.sh            依赖检测 / 安装 / vendor 漂移检查（可执行）
├── references/
│   ├── preflight.md            ★ 自有：依赖详解、检测方法、安装命令、降级策略
│   ├── orchestration.md        ★ 自有：委派协议、交接块格式、反模式
│   ├── 00-context-protocol.md  ← vendor 自 dayu
│   ├── 01-requirements.md      ← vendor
│   ├── 02-planning.md          ← vendor
│   ├── 03-development.md       ← vendor（T/C/H/D 分类门）
│   ├── 04-testing.md           ← vendor
│   ├── 05-acceptance.md        ← vendor
│   ├── 06-delivery.md          ← vendor
│   ├── evidence.md             ← vendor
│   ├── decisions.md            ← vendor
│   ├── ids.md                  ← vendor
│   └── templates/              ← vendor（11 份模板 + 索引）
└── provenance/
    ├── vendor-manifest.md      来源 md5 清单，用于检测与 dayu 的漂移
    └── dependency-matrix.md    四个依赖的实测证据记录
```

★ = ultra 自有文件；← vendor = 从 `dayu` 原样引入。

**为什么要 vendor 而不是引用**：`dayu-ultra` 必须能独立工作。若引用 `dayu/references/…`，则未安装 `dayu` 时 ultra 就会破——那正好违反"不混用"。代价是两份副本可能漂移，因此用 `provenance/vendor-manifest.md` 记录来源 md5，并提供 `--check-vendor` 检测。

---

## 已登记的规范冲突与裁决

引入外部技能栈必然带来规范冲突。按本规范自己的要求，冲突要**登记并裁决**，不能悄悄选一个：

| # | 冲突 | 裁决 |
| --- | --- | --- |
| 1 | superpowers 的 `test-driven-development` 主张"先写测试" vs 本规范的 T/C/H/D 分类 | **分类门先行**：先分类，只对 T 类加载 TDD；H 类（实机感官/硬件）不得强套单元测试 |
| 2 | `writing-plans` 负责"怎么写计划" vs 本规范要求计划必须含哪些字段 | **叠加**：用它的写法，装本规范的字段（含"明确未交付"与"不算完成"） |
| 3 | qiushi 的 `arming-thought` 声明会话开始自动注入 | **不重复实现**总原则，只在其上叠加证据分级/决策登记/契约冻结 |

详见 `SKILL.md` §3。

---

## 编排铁律（ultra 新增）

13. **不得声称加载了实际未加载的技能**——编排表里写了委派却没真调用，等同伪造证据。
14. **委派不等于免责**——协作技能负责过程质量，本规范负责可审计性；`R`/`Q`/`M`/用例/证据仍必须落地。
15. **降级必须显式**——依赖不可用时降级为 `dayu` 等价流程是允许的，但必须写进索引的"已知不可信"。

## 什么时候不要用

- 单文件、单次会话能完成的小改动。
- 环境干净、不想引入任何依赖 → 用 `dayu`。
- 已装依赖但只想按规范走、不需要编排 → 用 `dayu`。
