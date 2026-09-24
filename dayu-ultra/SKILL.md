---
name: dayu-ultra
description: "MUST USE for running a whole software project with auditable evidence AND a curated companion stack. This is the ultra variant of `dayu`: Phase 0 is a preflight that detects and installs four OpenCode dependencies (oh-my-opencode / oh-my-openagent, obra/superpowers, HughYau/qiushi-skill, RobMitt/grill-me-skill), then the six lifecycle phases run while each phase delegates to the right companion skill — grill-me for requirement interrogation, qiushi for investigation and contradiction analysis, superpowers for planning/TDD/debugging/review/verification, oh-my-opencode for parallel subagents. Use ONLY when the companion stack is wanted, or the user asks for dayu-ultra / ultra 版 / 依赖编排. DO NOT load together with `dayu` — the two are mutually exclusive; use `dayu` alone for a dependency-free run. Triggers: dayu-ultra, ultra 版, 依赖编排, 编排, preflight, 依赖检测, 组合技能, 多技能流程, superpowers 编排, qiushi 编排, 求是, grill-me, oh-my-opencode, 长上下文, 需求分析, 项目规划, 契约冻结, 验收, 交付."
---

# dayu-ultra

**本文件是路由，不是手册。** 规则在 `references/` 下；你的第一个动作是**跑 preflight**，然后按当前阶段加载最小文件集。

## 0. 与 `dayu` 的关系：互斥，不混用

| | `dayu` | `dayu-ultra`（本技能） |
| --- | --- | --- |
| 依赖 | **零依赖**，独立可用 | 依赖 4 个协作技能栈 |
| 内容 | 六阶段规范 + 模板 | **超集**：在本体内已经 vendor 了 `dayu` 的全部参考文件 |
| 适用 | 只想按规范走；环境干净；离线 | 想要编排：逼问需求、求是分析、superpowers 工程流、并行子代理 |

**互斥规则（硬性）：**

1. 本会话**已经加载 `dayu`** → **不要**再加载 `dayu-ultra`，继续用 `dayu` 走完。
2. 本会话**加载了 `dayu-ultra`** → **不要**再加载 `dayu`。ultra 已自带 `dayu` 的全部参考文件，再加载是重复。
3. 需要判断该用哪个时，问用户一句即可，**不要两个都上**。
4. preflight 会检测 `dayu` 是否安装并在报告中标注，但**不要求卸载**——互斥约束的是"同一次会话内不同时加载"，不是"不能共存于磁盘"。

理由：两者内容高度重叠（ultra 是超集），同时加载会得到两份措辞略异的同一规范，产生歧义与上下文浪费——这正是本规范反复强调要避免的漂移源。

## 1. Phase 0：Preflight（强制前置，不可跳过）

**在任何阶段工作开始前，先执行依赖检测。** 这是 ultra 与 `dayu` 的唯一结构性区别。

```bash
bash <skill-dir>/tools/preflight.sh            # 只检测并报告
bash <skill-dir>/tools/preflight.sh --install  # 缺什么装什么，再复检
```

preflight 检查四件事，并把结果打成一张表：

| 依赖 | 提供什么 | 缺失时的后果 |
| --- | --- | --- |
| `oh-my-opencode`（npm 包名 `oh-my-openagent`） | 异步子代理、策划过的 agents、LSP/AST 工具 | 无法并行分派；退回串行执行 |
| `obra/superpowers` | 计划、TDD、调试、审查、验证等 14+ 技能 | 阶段 2–6 失去工程流支撑 |
| `HughYau/qiushi-skill` | 实事求是、矛盾分析、调查研究、批评与自我批评等 11 技能 | 阶段 0/1/5 失去认识论框架 |
| `RobMitt/grill-me-skill` | 逼问式访谈直到达成共识 | 阶段 1 的需求拷问退化为普通提问 |

**缺失时的处理规则：**

- 默认 `--install`：按 `references/preflight.md` 的命令安装缺失项，然后**复检**。
- 安装失败或用户不允许安装 → **降级但不伪装**：在 `docs/00-index.md` 的"已知不可信"里写明"本次以 `dayu` 等价流程运行，协作技能 X/Y 不可用"，然后照 `references/` 的规范继续。**不得声称用了实际没加载的技能。**
- 若四个依赖全部缺失且无法安装，**建议改用 `dayu`** —— ultra 的价值全在编排层。

详细检测逻辑、安装命令、降级策略见 `references/preflight.md`。

## 2. 阶段模型与编排

阶段划分与 `dayu` 完全一致（0–6）。ultra 的增量是**每个阶段指定协作技能**。

| 阶段 | 本技能负责 | 委派给 | 何时委派 |
| --- | --- | --- | --- |
| **0** 立项与证据基线 | 五级证据、环境基线、缺口台账 | `investigation-first` | 需要"先调查再下判断"时 |
| **1** 需求分析 | `R` 清单、`Q` 决策登记、停止条件 | **`grill-me`**、`contradiction-analysis` | 需求含糊 / 用户没说清 / 多需求争优先级 |
| **2** 项目规划 | `M` 节点卡片、DoR、契约冻结 | `writing-plans`、`overall-planning`、`concentrate-forces` | 写计划 / 多目标平衡 / 排优先级 |
| **3** 开发 | T/C/H/D 分类、RED→GREEN 证据 | `test-driven-development`、`systematic-debugging`、`subagent-driven-development`、`dispatching-parallel-agents` | 写代码 / 调试 / 可并行的工作 |
| **4** 测试 | 用例表、追踪矩阵、执行记录 | `verification-before-completion`、`practice-cognition` | 声称完成前 / 迭代验证 |
| **5** 验收 | 门槛判定、分母完整、故障注入 | `criticism-self-criticism`、`requesting-code-review`、`security-review` | 自我审查 / 代码审查 / 安全审查 |
| **6** 交付 | 完整 DoD、交付件、脱敏 | `finishing-a-development-branch`、`criticism-self-criticism` | 收尾 / 发布前 |
| **全程** | 铁律约束 | `arming-thought`、`protracted-strategy`、`spark-prairie-fire` | 会话开始 / 长周期 / 从零起步 |

编排的完整协议（含交接块格式、反模式）见 `references/orchestration.md`。

## 3. 已知重叠与优先级裁决

引入外部技能栈会带来**规范冲突**。按本规范自己的要求，冲突要登记并裁决，不能悄悄选一个。以下是已识别并已裁决的：

### 3.1 `test-driven-development`（superpowers） vs Selective TDD 的 T/C/H/D

**冲突**：superpowers 的 TDD 主张"先写测试"，本规范主张"先分类，只有 T 类先写测试"。

**裁决**：**分类门先行。**
1. 先按 `references/03-development.md` 把工作分为 T/C/H/D。
2. **仅对 T 类**加载 `test-driven-development`。
3. C 类走契约测试；H 类走实机/人工；D 类走构建与来源审查。
4. **不得**因为加载了 superpowers 就把 H 类（实机感官、硬件）也强行套 TDD —— 那是本规范明令禁止的"用胶水代码逃避规则"的反面。

### 3.2 `writing-plans` vs 里程碑卡片

**裁决**：`writing-plans` 负责**怎么写一份好计划**（结构、粒度）；本规范负责**计划必须包含哪些字段**（用户价值、入口、交付、T/E/C/H 分类、适用用例、演示脚本、出口判据、**明确未交付**、**不算完成**）。两者叠加：用 superpowers 的写法，装本规范的字段。

### 3.3 `arming-thought` 的自动注入

qiushi 的 `arming-thought` 声明"会话开始自动调用，子 agent 跳过"。本规范**不重复实现**总原则，只在其上叠加"证据分级 / 决策登记 / 契约冻结"这些它没有的产物要求。

### 3.4 新增冲突怎么办

发现新的规范冲突时：**登记到 `docs/01-decisions.md`，写明两侧主张、裁决、理由、影响范围**，然后继续。不静默择一。

## 4. 铁律

继承 `dayu` 的全部 12 条（未批准不当作事实 / 文档不等于执行 / 两种完成分开 / 证据分级不可冒充 / 契约先于两端实现 / 可逆不提前冻结不可逆不延后 / 不确定可表达 / 声明不提供的保证 / 批准记录边界 / 不删失败测试 / 冲突同步修订 / 不虚构）。详见下方各 `references/`。

**ultra 新增 3 条：**

13. **不得声称加载了实际未加载的技能。** 编排表里写了委派却没真的调用，等于伪造证据——与"文档不等于执行"同罪。
14. **委派不等于免责。** 交给 `grill-me` 逼问、交给 superpowers 写计划之后，本规范要求的**产物**（R/Q/M/用例/证据）仍必须落地。协作技能负责过程质量，本规范负责可审计性。
15. **降级必须显式。** 依赖不可用时降级为 `dayu` 等价流程是允许的，但必须在索引里写明，不得让读者以为走了 ultra 编排。

## 5. 遇到未知怎么办

与 `dayu` 相同（登记待决 / 开限范围 spike / 区分可逆与不可逆 / 冲突登记）。**ultra 补充**：需求含糊时，**先用 `grill-me` 逼问到共识**再登记；判断"这是不是一个真问题"时，先过 `contradiction-analysis` 找主要矛盾。

## 6. 启动一个新项目

1. **跑 preflight**，处理缺失依赖（缺什么装什么；装不上就显式降级）。
2. **确认互斥**：本会话没加载 `dayu`。
3. 复制 `references/templates/` 到项目 `docs/`，从 `00-index.md` 开始填。
4. 阶段 0：写可行性核查（证据分级 + 缺口台账）。
5. 阶段 1：写需求清单 `R` + 决策登记 `Q`；**需求含糊处用 `grill-me` 拷问**。
6. 阶段 2：规划 `M` 节点 + DoR + 冻结时间表。
7. 之后按编排表逐阶段推进，每次收工写回文档。

## 7. 参考文件索引

| 文件 | 何时读 |
| --- | --- |
| `references/preflight.md` | **Phase 0 必读**：依赖检测、安装命令、降级策略 |
| `references/orchestration.md` | 需要委派协作技能时：编排协议、交接块、反模式 |
| `references/00-context-protocol.md` | 会话开始、恢复上下文、交接、上下文快满时 |
| `references/01-requirements.md` | 阶段 0–1 |
| `references/02-planning.md` | 阶段 2 |
| `references/03-development.md` | 阶段 3（T/C/H/D 分类门） |
| `references/04-testing.md` | 阶段 4 |
| `references/05-acceptance.md` | 阶段 5 |
| `references/06-delivery.md` | 阶段 6 |
| `references/evidence.md` | 任何需要标注证据来源或设计测试隔离时 |
| `references/decisions.md` | 登记决策、冻结契约、写 ADR 时 |
| `references/ids.md` | 新建编号或维护追踪链路时 |
| `references/templates/` | 可直接复制进项目的模板集 |
| `provenance/vendor-manifest.md` | 需要核对与 `dayu` 的差异、或检测副本漂移时 |
