---
name: dayu
description: "MUST USE for running a software project through its full lifecycle with auditable evidence: requirements analysis, planning, contract freezing, milestones, implementation, testing, acceptance, and delivery — especially for long-context / multi-session projects where the document set is the agent's external memory. Provides the phase model, the iron rules (unapproved is not fact, documents are not execution, two kinds of done), evidence grading, the decision register, Selective TDD risk classes (T/C/H/D), DoR/DoD, traceability IDs, and copy-ready templates. Triggers: 需求分析, 项目规划, 立项, 可行性核查, 契约冻结, 决策登记, 需求追踪, 里程碑, 验收, 交付, 长上下文, 跨会话, 新项目, 测试规格, 追踪矩阵, DoR, DoD, definition of ready, definition of done, project kickoff, milestone plan, contract freeze, traceability matrix, acceptance criteria, evidence log, long-context project, multi-session project, spec-driven delivery."
---

# Project Lifecycle

**本文件是路由，不是手册。** 规则在 `references/` 下；你的第一个动作是按当前阶段加载最小文件集，并用一句话说明加载了什么。凭印象开工，产出的就是这套规范专门要防的那种"看起来很完整的幻觉文档"。

## 立场

这套规范解决的不是"怎么写代码"，而是两件事：

1. **一个跨多会话、多阶段的项目，如何让每条结论都有可追溯的证据，且没有一句话是编造的。**
2. **上下文放不下整个项目时，如何让文档成为外部记忆，使任何一次新会话都能在有限读取量内恢复全部关键状态。**

它的前身是一套在真实项目上跑过的流程产物（需求/HLD/契约/测试矩阵/可行性核查/交付定义），本 skill 把它抽成了与领域无关的规范。

**名字由来**：大禹治水十三年。父鲧用堵、失败；禹改用疏导——对应"可逆决策不提前冻结"；划天下为九州——对应里程碑纵向切分；铸九鼎——对应契约冻结成基线；三过家门而不入——对应节点按证据关闭而非按时间；《禹贡》——对应分级、可复核的记录。一个形象覆盖了这套规范的六阶段主干。

## 三条最贵的铁律

违反这三条，后面所有文档都会变成精致的谎言。

**① 未批准不当作事实。**
空白不等于"已批准的确定值"。没给定数值、语料、字节布局、人员、工期，就登记为未决，不要为了把表格填满而编造。`TBD` 是合法值；编造不是。

**② 文档不等于执行。**
"已写测试用例"不是 TDD，"文档里出现测试字样"不证明任何行为。只有实现时的 **RED→GREEN 证据**能证明。同理：方案获批 ≠ 可以开始编码、刷机、调用付费 API 或公开发布。

**③ 两种"完成"必须分开。**

| | 判据 | 允许的说法 |
|---|---|---|
| **文档交付完成** | 资料逐份审查、缺口有记录、规格/追踪/交付标准可读且一致 | 可交付待审稿；**不得**称"已批准" |
| **产品完整交付** | 被真实使用并满足已批准需求 | 需真实证据 |

`BLOCKED`、`NOT_RUN`、只在 mock 通过、只有截图或源码，**均不算**完整交付。

## 阶段模型

不是瀑布。默认风险优先推进，每个阶段内部继续按"一个可独立演示的行为一轮"循环。

| 阶段 | 名称 | 主要产物 | 加载 |
| --- | --- | --- | --- |
| **0** | 立项与证据基线 | 可行性核查、环境基线、证据分级、已知缺口 | `references/00-context-protocol.md` + `01-requirements.md` |
| **1** | 需求分析 | 需求清单（`R`）、决策登记（`Q`）、待审定事项、停止条件 | `references/01-requirements.md` + `decisions.md` + `ids.md` |
| **2** | 项目规划 | 契约冻结、里程碑（`M`）、DoR、冻结时间表、ADR | `references/02-planning.md` + `decisions.md` |
| **3** | 开发 | 契约优先实现、Selective TDD 的 T/C/H/D 分类、RED→GREEN 记录 | `references/03-development.md` + `evidence.md` |
| **4** | 测试 | Given/When/Then 用例、测试分层、追踪矩阵、执行记录 | `references/04-testing.md` + `ids.md` |
| **5** | 验收 | 门槛判定、分母完整、故障注入、真实组合验证 | `references/05-acceptance.md` + `evidence.md` |
| **6** | 交付 | 完整 DoD、交付件清单、manifest 与哈希、操作验证 | `references/06-delivery.md` |

**贯穿全程、不是某个阶段专有：**

| 需要时加载 | 内容 |
| --- | --- |
| `references/context-protocol.md` | 长上下文作业协议：读什么、写什么、怎么恢复、什么时候压缩 |
| `references/evidence.md` | 证据分级、不可伪造证据、测试隔离与替身边界 |
| `references/decisions.md` | 决策登记、契约冻结、ADR、冻结时间表 |
| `references/ids.md` | ID 体系与追踪矩阵（R→C→用例→M） |
| `references/templates/` | 可直接复制进项目的模板 |
| `examples/sanitized-walkthrough.md` | 一个脱敏的完整走查，展示各产物长什么样 |

## 铁律清单

与阶段无关，任何时候都不得违反。

1. **未批准不当作事实**；空白、`TBD`、未决都合法，编造不合法。
2. **文档不等于执行**；只有 RED/GREEN 证据能证明行为。
3. **两种"完成"分开**；mock 通过、截图、源码都不算交付。
4. **证据分级且不可互相冒充**：本次实测 / 官方文档 / 上游试验 / 原始规格 / 推断，各自标注来源与验证范围。
5. **契约先于两端实现**：两端第一次独立实现前冻结**最小**互操作契约；不提前建设通用平台。
6. **可逆决策不提前冻结，不可逆决策不延后冻结**：每个决策登记"最迟冻结时间"与"变更方式"。
7. **不确定必须可表达**：`unknown` / `not_reported` / `uncertain` 是合法状态，禁止用 `0` 或假值掩盖。
8. **明确声明不提供的保证**：达不到的强语义要写下来，不偷偷声称已满足。
9. **每次批准都要记录它不覆盖什么**：批准是有边界的，边界必须落在纸面上。
10. **不删失败测试、不放宽断言以变绿**；关键缺陷先补能复现的回归测试。
11. **发现跨文档冲突时，登记并修订所有受影响文档**，不能悄悄选对实现最容易的版本。
12. **不虚构**团队人数、Sprint 天数、交付日期、开发速度、覆盖率百分比。节点按证据完成，不按时间自动完成。

## 遇到未知怎么办（"不要猜"的操作化）

这是本 skill 最常被用到的部分。任何时候你发现信息不足：

| 情况 | 正确动作 | 禁止动作 |
| --- | --- | --- |
| 阈值/参数未定 | 登记为待决项，写清"影响哪个故事/节点" + "谁批准" + "最迟何时冻结" | 自己选一个看起来合理的值 |
| 外部 API 能力未知 | 开一个**限范围 spike**，先写假设、判定方法、终止条件，再记录结果 | 在未验证假设上批量编码 |
| spike 结论是"不支持" | 返回设计并向用户说明 | 静默降低需求，或用胶水代码绕过 |
| 用户说"你决定" | 区分：可逆工程细节（框架、目录、命名）→ 你决定；不可逆产品语义（数据外发、准确率、时延、许可、发布）→ 必须用户批准 | 把不可逆决策当成工程细节自己批了 |
| 文档之间有冲突 | 登记冲突 → 修订所有受影响文档 → 记录 ADR | 静默采用最省事的那版 |
| 只完成了一部分 | 明确写"未交付什么"，如"M1 不含设备采音，不能称语音输入器完成" | 用模糊措辞让读者以为都做完了 |

## 启动一个新项目

按顺序，不要跳：

1. **建文档骨架** — 复制 `references/templates/` 到项目 `docs/`，从 `00-index.md` 开始填。
2. **写可行性核查**（阶段 0）— 先固定证据分级与已知缺口，再谈方案。**缺证据的功能不要写进需求。**
3. **写需求清单**（阶段 1）— 每条需求一个 `R` 编号；同时开决策登记表 `Q`，把"必须由用户拍板的事"逐条列出。
4. **做一次缺口审查** — 输出"严重性 / 原文定位 / 问题 / 本轮处理"表。这一步会暴露"只有主题没有可执行用例"这类问题。
5. **规划里程碑**（阶段 2）— 每个 `M` 节点必须是**纵向可演示增量**，含：用户价值、入口、交付、Selective TDD 分类、适用用例、演示脚本、出口判据、明确未交付。
6. **冻结关键契约**（阶段 2）— 只冻结"不冻结就没法开始"的部分，其余登记最迟冻结时间。
7. **然后才开始编码** — 按 `03-development.md` 的 T/C/H/D 分类走。

## 什么时候不要用本 skill

- 单文件、单次会话能完成的小改动 — 直接做，本规范的产物成本高于收益。
- 纯粹的信息查询 — 用检索，不要立项。
- 使用前先判断：**这个项目会不会跨越多次会话、需要向他人证明结论的真实性？** 两个都否，就不必动用全套。

## 参考文件索引

| 文件 | 何时读 |
| --- | --- |
| `references/00-context-protocol.md` | 会话开始、恢复上下文、准备交接、上下文快满时 |
| `references/01-requirements.md` | 需求分析、写 `R` 清单、开决策登记 |
| `references/02-planning.md` | 规划里程碑、写 DoR、冻结契约、写 ADR |
| `references/03-development.md` | 写代码前决定测试策略、记录 RED/GREEN |
| `references/04-testing.md` | 写用例、建追踪矩阵、填执行记录 |
| `references/05-acceptance.md` | 判定门槛是否达标、组织真实组合验证 |
| `references/06-delivery.md` | 准备交付件、写 manifest、执行 DoD 清单 |
| `references/evidence.md` | 任何需要标注证据来源或设计测试隔离时 |
| `references/decisions.md` | 任何需要登记决策、冻结契约、写 ADR 时 |
| `references/ids.md` | 需要新建编号或维护追踪链路时 |
