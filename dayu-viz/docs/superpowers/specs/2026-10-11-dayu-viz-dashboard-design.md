# dayu-viz — Dayu 项目全生命周期可视化看板 · 设计文档

> 日期：2026-10-11｜状态：**设计已获用户认可，待书面复审**
> 交付形态：Dayu-Skill 仓库**新 DLC 分支 `feature/dayu-viz`**
> 本文不是已实现的软件说明。截至本文写作时**没有编写任何产品代码**。

---

## 1. 背景与目标

### 1.1 问题

用 dayu 方法论推进的项目，其全部关键状态都沉在 `docs/` 的 11 份文档里——阶段、里程碑、需求 `R`、决策 `Q`、契约 `C`、用例、证据、验收门槛 `G`。这套设计对 agent 是"外部记忆"，但对**人**几乎是不可读的：

- 要回答"这个项目现在在哪、卡在哪、下一步是什么"，得逐份读文档并自己在脑子里建索引。
- `R → C/Q → 用例 → M → 证据` 这条追踪链路**跨 4 份文档的 4 张表**，断链只能靠人工核对（dayu `references/ids.md` §7 的五问自检）。
- 多 agent 协作时，谁在干什么、任务依赖如何、有没有写作用域冲突，**不在文档里**，只存在于会话流中。
- 最关键的一点：dayu 的灵魂是**反幻觉**（未批准不当作事实、`BLOCKED ≠ PASS`、mock 通过不算交付）。这些纪律在文档里是文字，读者**不会主动去核**。

### 1.2 目标

提供一个本地看板，把一个 dayu 项目**端到端**呈现为可交互视图：

1. **进度与状态**：阶段、当前节点、阻塞、待批准，一屏可见。
2. **关键节点**：`M0→M1→…` 纵向增量轴，节点按**证据**关闭而非按时间。
3. **追踪链路**：`R → C/Q → 用例 → M → 证据 → G` 的有向图，**断链自动高亮**。
4. **Agent 合作模式**：团队拓扑、任务依赖 DAG、消息流、写作用域冲突；并**与项目节点对齐**。
5. **防幻觉**：把违反 dayu 铁律的地方主动标红（见 §8.2）。

### 1.3 成功判据（初步）

- 打开看板，在**不读任何原始文档**的情况下，能正确说出：当前阶段、当前节点、阻塞项及其解除条件、待批准 `Q` 及其最迟时点、下一步动作。
- 对真实项目 `D:\DSH\docs`（生成创作 Agent），看板能报出至少 3 条**人工未察觉**的问题（断链或红旗）。
- 任意 dayu 项目换目录即用（`--project <dir>`），无需改代码。

---

## 2. 交付形态：dayu 的新 DLC

用户明确要求：本功能**作为 dayu 的一个新 DLC 存在和发布**。DLC 规范来自对现有两个 DLC 分支的实测（证据等级：**实测**，命令行输出见 §2.2）。

### 2.1 DLC 约定（实测得出）

| 约定 | 证据 |
| --- | --- |
| 分支名 `feature/<skill-name>` | 远端实测存在 `feature/token-check`、`feature/dayu-ultra` |
| 目录名 = skill 名 = frontmatter `name`（ASCII kebab-case） | `token-check/SKILL.md`、`dayu-ultra/SKILL.md` |
| Self-contained，拷贝即安装 | `token-check/` 不引用 `dayu/`；`dayu-ultra/` vendor 了全部参考文件 |
| **只增不改**：`A <dlc>/**` + `M README.md` | `git diff --name-status origin/main origin/feature/token-check` 的完整输出 |
| 可随附构建证据 | `dayu-ultra/provenance/`（vendor 清单、依赖实测）、`dayu-ultra/evidence/` |

### 2.2 本 DLC 的形状

```
feature/dayu-viz 分支
├── README.md                    ← M：在既有「分支与变体（DLC）」章节追加 DLC ③（纯增）
└── dayu-viz/                    ← A：全新目录（纯增）
    ├── SKILL.md                 agent 入口（frontmatter name + description + 触发词）
    ├── README.md                给人看的说明
    ├── bin/dayu-viz.mjs         CLI 入口
    ├── src/core/                解析层（零依赖、纯函数）
    ├── src/server/              本地服务（node:http + SSE）
    ├── web/                     前端（原生 ES Module）
    ├── vendor/                  一次性 vendor 的图表库
    ├── docs/                    ★ dayu-viz 自身的六阶段文档（dogfooding）
    ├── evidence/                ★ 本项目的 RED/GREEN 证据
    └── provenance/              ★ DLC 打包规范与实测证据
```

**安装**：`cp -r dayu-viz ~/.dsh/skills/dayu-viz`（OpenCode 为 `~/.config/opencode/skills/dayu-viz`）。

### 2.3 需要登记的两项偏差

| 项 | 偏差 | 处理 |
| --- | --- | --- |
| `dayu-viz/docs/` 随 DLC 发布 | 消费者可能误把工具自身的构建记录当成自己的项目文档 | `SKILL.md` 与 `README.md` 首屏明确声明其性质；`--project` 默认值**不是**技能目录 |
| 发布（`git push`） | dayu 铁律⑧：发布是独立授权项 | 登记为 `Q01`，**未获授权前不推送** |

---

## 3. 用户与使用场景

**主要用户**：用 dayu 推进项目的开发者本人（多会话、长时间跨度）。

| 场景 | 触发 | 期望 |
| --- | --- | --- |
| **开工** | 新会话开始 | 打开看板即知阶段/节点/阻塞/下一步，不必逐份读文档 |
| **盯盘** | 长任务运行中 | agent 在跑，看板自动跟随状态变化 |
| **自查** | 进入验收前 | 跑一遍 dayu §7 五问自检，看板给出结论 |
| **复盘** | 节点关闭 | 看某节点的适用用例、证据、残余风险与"不算完成"清单 |

**非用户**：不是给团队/远程协作用的；不做账号、不做远程访问。

---

## 4. 数据源（三级，均为本机实测）

| 级 | 路径 | 内容 | 形态 | 里程碑 |
| --- | --- | --- | --- | --- |
| **A. dayu 产物** | `<project>/docs/*.md`、`docs/contracts/` | 阶段、`M`、`R/G/Q/C/A/B`、用例、追踪矩阵、证据、DoR/DoD | Markdown 表格 | M1 起 |
| **B. Agent 协作** | `~/.dsh/storages/session_projcache/sessions/*.json` | `agentTeam{members,tasks,messages}`、`subagent*`、`todos`、`tokenUsage`、`sessionStats`、`turnOutline` | **明文 JSON，实时更新** | M4 |
| **C. 会话全轨迹** | `~/.dsh/sessions/<ws>/<id>/session.v4.jsonl.zstd` | 逐步工具调用、委派、耗时 | zstd 压缩 JSONL | **非目标** |

**证据（实测）**：

- A：`D:\DSH\docs` 下 6 份文档已填实（`00-index`/`01-decisions`/`02-requirements`/`03-feasibility`/`05-plan`/`06-test-matrix`，0 占位符、约 160 行表格），`04-adr`/`08-readiness`/`09-acceptance`/`10-delivery` 仍为模板。
- B：`session-db015490-…json` 实测含 8 members / 16 tasks / 67 messages；成员字段 `{id,name,description,provider,context,phase}`，任务字段 `{id,revision,subject,status,ownerId,blockedBy[],writeScopes[]}`，消息字段 `{id,senderId,senderName,targetId,content[]}`。
- C：`session.v4.jsonl.zstd` 为 zstd 压缩流，Node 24 的 `zlib.zstdDecompressSync` 可解——**列为非目标**，因为 B 已足够且成本更低。

**关键咬合点**：B 的任务 `subject` 中直接含有 dayu 的 ID（实测样例：`M1-A：官方 xiaozhi-esp32 集成路线编译验证（spike）`）。据此可把 agent 任务挂到项目节点上，实现三层对齐。

**会话关联规则（消除歧义）**：一个项目可能对应多个 DSH 会话，必须定义取哪一个：

1. 以 projcache 记录里 `record.identity.cwd` 与项目的 DSH workspace 根匹配，得到候选集；
2. 默认取候选集中**最近活跃**（`record.rows.sessionStats.val` 的 `lastTurn` / `openStep` 时间最新）的那个；
3. `--session <id>` 显式覆盖；
4. 候选集为空，或多个并列而无法判定 → `agents` 整体置 `unknown` 并记入 `meta.warnings`，UI 显示"未关联到会话"，**不得猜测**。

---

## 5. 架构

### 5.1 分层与边界

```
[数据源 A/B]  →  src/core（纯解析，零依赖、无 IO）  →  DayuProject 模型
                          ↓
                   src/server（唯一 IO 层：fs / http / SSE）
                          ↓  /api/model (JSON) + /events (SSE)
                   web/（原生 ESM，只消费 JSON）
```

**可测试的边界规则**：

1. `src/core/**` 不得 `import` 任何 `node:*` IO 模块、不得读文件、不得读时钟、不得联网。
2. 所有 IO 集中在 `src/server/**`。
3. `web/**` 不含任何解析逻辑——它只渲染 `/api/model` 返回的模型。

直接收益：解析层可在无文件系统依赖的情况下单测；展示层将来换成 React 时，解析层一行不动。

### 5.2 技术选型

| 层 | 选型 | 理由 |
| --- | --- | --- |
| 运行时 | Node ≥ 20（开发机实测 v24.16.0） | `node:http` / `fs.watch` / SSE 全在标准库 |
| 后端依赖 | **零 npm 依赖** | 技能目录必须"拷贝即用"；不吃 npm 沙箱与缓存路径问题 |
| 前端 | 浏览器原生 ES Module，**无构建步骤** | 改完刷新即生效；新会话接管成本最低（长上下文场景） |
| 图表 | ECharts（Apache-2.0），vendor 进 `vendor/` | 一个文件覆盖 graph / 时间线 / 桑基 / 热力；唯一外部依赖，风险被隔离 |
| 测试 | `node:test` + `node:assert`（标准库） | 零依赖，`node --test` 直接跑 |

> 本机实测：`npm view vite` 可达（registry 经本机代理 `198.18.0.101`），依赖安装**不受限**。选零构建是**工程判断**（可逆决策），不是环境所迫。

### 5.3 目录

```
dayu-viz/
├─ package.json            type:module；scripts: start / test
├─ bin/dayu-viz.mjs        CLI：--project <dir> --port <n> --open --session <id>
├─ src/
│  ├─ core/
│  │  ├─ markdown.mjs          极简 MD 解析：标题树 / 表格 / 复选清单 / 行号定位
│  │  ├─ model.mjs             模型构造与规范化（JSDoc 类型）
│  │  ├─ parse-inventory.mjs   文档存在性与填写度（占位符 / 行数 / mtime）
│  │  ├─ parse-index.mjs       → status + handover
│  │  ├─ parse-requirements.mjs → requirements[] / gates[]
│  │  ├─ parse-decisions.mjs   → decisions[] + 批准记录（含"不覆盖什么"）
│  │  ├─ parse-plan.mjs        → milestones[] + 卡片字段 + DoR + 常量 + 外部授权
│  │  ├─ parse-contracts.mjs   → contracts[]（冻结时间表 + 冻结文档）
│  │  ├─ parse-test-matrix.mjs → cases[] + 追踪矩阵 + 变异敏感性
│  │  ├─ parse-evidence.mjs    → evidence[] + 执行记录 + 状态变更
│  │  ├─ parse-feasibility.mjs → 环境基线 + experiments[] + gaps[]
│  │  ├─ parse-acceptance.mjs  → acceptance[]
│  │  ├─ parse-delivery.mjs    → delivery{}
│  │  ├─ trace.mjs         ★ 追踪链路构建 + 断链检测
│  │  ├─ redflags.mjs      ★ 红旗规则引擎
│  │  └─ session.mjs       ★ projcache JSON → agents{}
│  └─ server/
│     ├─ server.mjs        node:http：静态文件 + /api/model + /events(SSE)
│     ├─ watcher.mjs       fs.watch + 去抖 → 变更事件
│     └─ project.mjs       项目定位、文档版本快照、session 关联
└─ web/
   ├─ index.html
   ├─ app.mjs              路由与状态
   ├─ views/               overview / milestones / trace / boards / redflags / agents
   ├─ components/          表格、状态徽章、图例
   └─ vendor/echarts.min.js
```

---

## 6. 数据模型

**总原则：绝不编造。** 任何读不到的字段取 `unknown`，**不得**取 `0`、空串或默认值。这是 dayu 铁律⑦（不确定必须可表达）对工具自身的要求，也是本工具存在意义的一部分。

```js
DayuProject = {
  meta: {
    name, root, docsDir, parsedAt,
    inventory: [{ file, exists, isTemplate, placeholders, tableRows, bytes, mtime }],
    warnings: []
  },

  status: {
    phase,                      // 0..6 | 'unknown'
    currentNode,                // 'M1' | 'unknown'
    sessionGoal, docVersion,
    handover: { updatedAt, completed, notCompleted, next,
                awaitingUser, dontReask, untrusted }   // 缺项 = 'unknown'
  },

  requirements: [{ id:'R01', text, gates:['G1'], source:{file,line} }],
  gates:        [{ id:'G1', topic, value, state }],     // value 可为 'TBD'
  decisions:    [{ id:'Q01', question, state,            // approved|pending|undecided|unknown
                   date, basis, affectedNodes:[],
                   approvalNote, notCovering:[], source }],
  contracts:    [{ id, name, mustFreezeBy, file, state, source }],
  milestones:   [{ id:'M1', name, state,
                   fields:{ userValue, entry, deliverable, testStrategy,
                            cases:[], demoScript, exitCriteria,
                            notDelivered:[], notDone:[] },
                   source }],
  cases:        [{ id:'IMG-01', layer:['T','C'], gw, assertion,
                   state,                     // NOT_RUN|BLOCKED|FAIL|PASS|NOT_APPLICABLE_APPROVED|unknown
                   evidencePath, runs:[], source }],
  trace:        [{ requirement, cases:[], milestones:[] }],
  evidence:     [{ caseId, requirement, contract, red, green,
                   codeVersion, residualRisk, date, source }],
  gaps:         [{ id:'B01', gap, neededEvidence, currentStance,
                   isPrimaryBlocker, source }],
  experiments:  [{ id:'E03', action, observation, conclusion, source }],
  acceptance:   [{ gate, denominator, met, conclusion, evidencePath, date, source }],
  redflags:     [{ severity:'必须改正'|'应当改正', rule, message, refs:[{file,line}] }],
  agents: {
    sessionId, members:[{id,name,description,provider,context,phase}],
    tasks:[{id,revision,subject,status,ownerId,blockedBy:[],writeScopes:[],
            linkedIds:{milestones:[],requirements:[],cases:[]}}],
    messages:[{id,senderId,senderName,targetId,text,ts}],
    subagents:[], stats:{}
  }
}
```

**每个实体带 `source:{file,line}`**——看板里任何一条结论都能跳回原文行。这是"可复核"的最低成本实现。

---

## 7. 解析契约与韧性规则

文档由人和 agent 手写，格式必然漂移。解析器必须**不脆**：

| 规则 | 做法 |
| --- | --- |
| **按标题语义定位** | 用标题正则（如 `/已确认需求/`、`/里程碑卡片/`）而非行号；容忍编号变化（`## 2. 已确认需求` 与 `## 已确认需求` 都命中） |
| **按表头列名取值** | 以表头文字（`编号`、`已确认要求`）建立列映射，**不按列下标**；容忍列序调整与多余列 |
| **表格识别** | 连续的以 `\|` 开头结尾的行构成一张表；首行为表头、次行为分隔行 |
| **未知即 unknown** | 表找不到、列找不到、行为空 → `unknown`，并记入 `meta.warnings`，UI 显示"未提供" |
| **模板 vs 已填** | 含 `<...>` 占位符或表格无数据行 → 标记 `isTemplate`，UI 显示"该阶段尚未产出"而非空表 |
| **文档缺失 = 阶段未开始** | 不报错；映射为"阶段 N 未产出" |
| **只读** | 解析器永不写文件 |
| **宽松优先** | 单个文档解析失败只让该文档降级为 `unknown` + warning，**不得**导致整个项目加载失败 |

---

## 8. 视图设计

顶部常驻**红灯带**：`阶段 · 节点 · 阻塞 N · 待批准 M · 红旗 K · 数据新鲜度 parsedAt`。左侧导航切换视图。

### 8.1 六个视图

| 视图 | 形态 | 内容要点 |
| --- | --- | --- |
| **V1 驾驶舱** | 阶段带 + 节点卡 + 三红灯区 + 交接块 | 阶段 0–6 每格显示**出口判据达成度**（不是进度百分比）；`Q` 待批准列"卡在谁那里 / 最迟何时"；阻塞列"原因 / 解除条件"；交接块六字段原样呈现 |
| **V2 里程碑节点轴** | 纵向节点轴（**非时间轴**） | 每节点挂其适用用例的状态堆叠条；`不算完成` 清单以警示样式显示；`明确未交付` 单独区块 |
| **V3 追踪链路** | 有向图（`R→C/Q→用例→M→证据→G`）+ R×用例矩阵热力 | 断链高亮：无用例的 `R`、未挂 `R` 的孤立用例、无测试 ID 的冻结契约、仍待批准却被引用的 `Q` |
| **V4 状态看板** | 四张分列板 | 用例五态 / `Q` 三态 / 契约冻结时间表 / `B` 缺口台账（含"首要阻断门槛"标记） |
| **V5 红旗面板** | 告警列表，每条可跳到原文行 | 见 §8.2 |
| **V6 Agent 协作** | 团队拓扑 + 任务依赖 DAG + 消息弧线 + 活动时间线 | `blockedBy` 依赖图；**`writeScopes` 重叠告警**；任务 `subject` 中的 dayu ID 抽取后**回挂 V3** |

**配色语义（强制）**：`PASS` 绿；`FAIL` 红；`NOT_RUN` 灰；`BLOCKED` 橙；`NOT_APPLICABLE_APPROVED` 蓝灰；`unknown` 斜纹灰。**`BLOCKED` / `NOT_RUN` 在任何情况下不得渲染为绿色或任何表示成功的样式。**

### 8.2 红旗规则集（V5）

每条规则都是 dayu 一条铁律的可执行化。规则必须能**被变异测试抓住**（§9）。

| # | 规则 | 判据 | 对应铁律 |
| --- | --- | --- | --- |
| R1 | `BLOCKED`/`NOT_RUN` 冒充达标 | 非 `PASS` 用例出现在验收达标汇总中 | 两种"完成"必须分开 |
| R2 | 假 RED | 证据的 RED 记录匹配 导入失败 / 工具缺失 / 凭据缺失 / 网络断开，而非业务规则失败 | RED 的严格定义 |
| R3 | 未批准当事实 | 状态为 pending/undecided 的 `Q` 出现在契约冻结表或验收基线 | 未批准不当作事实 |
| R4 | 冻结不可测试 | 冻结时间表中 `✅已冻结` 的取值未关联任何测试 ID | 每个冻结文件必须可测试 |
| R5 | 分母不完整 | 验收记录缺"样本/分母"，或正文出现"剔除失败样本"类表述 | 失败不剔除 |
| R6 | 证据不可复核 | 证据条目缺日期 / 版本 / 验证范围 | 证据分级且不可互相冒充 |
| R7 | 缺结论范围声明 | `03-feasibility` / `09-acceptance` 开头无"结论范围"段 | 防误读 |
| R8 | 跨文档冲突 | 同一 `Q` 在 `00-index` 与 `01-decisions` 的状态或取值不一致 | 发现冲突须登记并修订全部 |
| R9 | 收工未写回 | 存在会话活动但 `00-index` 交接块时间戳早于最近文档改动 | 没写回等于没做 |
| R10 | 编号漂移 | ID 跳号、重复，或同一 ID 在两处以不同含义出现 | 编号是坐标不是标签 |
| R11 | 写作用域重叠 | 两个 `in_progress` 任务的 `writeScopes` 存在前缀重叠 | 协作纪律 |
| R12 | 孤立任务 | agent 任务的 `subject`/`description` 无法挂到任何 `M`/`R`/用例 | 可追溯性 |

---

## 9. 测试与验证策略（Selective TDD 分类）

| 类 | 范围 | 要求 |
| --- | --- | --- |
| **T** | `src/core/**` 全部纯函数：表格解析、列映射、ID 抽取、状态映射、追踪链路、红旗规则 | **先写断言 → 观察真实 RED → 最小 GREEN → 重构回归**。RED 必须因业务规则失败，不得是"模块不存在" |
| **C** | 以**格式忠实的合成 fixture**（`test/fixtures/sample-project`，脱敏）为契约测试；真实项目另做 opt-in 人工核对 | 真实文档格式变化必须让测试报警；含"文档被改成模板"的降级用例。**不得**把真实项目文档拷进仓库当 fixture |
| **H** | 浏览器内人工核对视图正确性 | 记录环境与截图路径到 `evidence/`；**不伪造自动化** |
| **D** | README / SKILL.md / 使用说明 | 结构与来源审查；快速上手步骤必须可复现 |

**错误变异敏感性**（每条规则都必须通过）：

| 变异 | 期望 |
| --- | --- |
| 把某条 `BLOCKED` 用例改成 `PASS` 并计入验收 | R1 **必须报警** |
| 把 RED 记录改成"模块导入失败" | R2 **必须报警** |
| 删除某 `R` 的全部用例 | V3 断链检测**必须报出**该 `R` |
| 把 `Q` 状态改为 pending 但保留其在冻结表 | R3 **必须报警** |
| 把 `09-acceptance` 的分母列清空 | R5 **必须报警** |
| **不报警** | 说明该规则是装饰品，**必须修到报警为止** |

---

## 10. 里程碑切分（本项目的 `M` 轴）

每个节点都是**纵向可演示增量**——能独立演示的一屏，而不是"先把解析器写完再一起做界面"。

| 节点 | 用户价值 | 交付 | 出口判据 | 明确未交付 | 不算完成 |
| --- | --- | --- | --- | --- | --- |
| `M0` | 需求与决策基线 | 本项目 `docs/` 骨架、`R` 清单、`Q` 登记、`M` 轴 | 每条 `R` 可单独引用；`Q` 写明卡在谁 / 最迟何时；首个故事 DoR 七条满足 | **任何可运行软件** | 把设计文档当成已实现 |
| `M1` | 启动服务指向 `D:\DSH\docs`，一屏看清阶段 / 节点 / 阻塞 / 待批准 | 解析层（`inventory`+`index`+`plan`+`decisions`+`requirements`）+ V1 驾驶舱 + SSE 实时跟随 | 对真实项目能正确报出阶段 2、`M0→M1`、`SPIKE-B01` 阻塞、`Q05/Q06` 待批；改文档后页面自动更新 | 图表视图、agent 协作 | 只对 mock 数据跑通；只读一次不刷新 |
| `M2` | 看见追踪链路与断链，看见红旗 | `trace.mjs` + `redflags.mjs` + V3 + V5 + `06-test-matrix` / `07-evidence-log` / 契约解析；并为红旗规则所需字段补做 `03-feasibility`（结论范围、缺口台账）与 `09-acceptance`（门槛、分母）的最小解析 | 变异测试表 6 条全部报警；对真实项目至少报出 3 条人工未察觉的问题 | V2 / V4 / V6 | 规则写了对真实数据不报警 |
| `M3` | 节点轴与四张状态板 | `parse-delivery` + 完整化 `parse-feasibility` / `parse-acceptance` + V2 + V4 | 五态 / 三态 / 冻结时间表 / 缺口台账四板数据与原文逐条吻合 | V6 | 表格渲染错位、状态映射错 |
| `M4` | 看见 agent 在怎么合作，并与项目节点对齐 | `session.mjs` + V6 + ID 回挂 | 对 `session-db015490` 正确显示 8 members / 16 tasks / 67 messages；任务能挂到 `M`/`R`/用例 | 上下文健康度面板 | 只画拓扑不接项目节点 |
| `M5` | 可交付的 DLC | `SKILL.md` + `README.md` + `vendor/` + 使用说明 + DLC ③ README 小节 + `10-delivery.md` + DoD 自检 | 拷贝到 `~/.dsh/skills/dayu-viz` 后**在干净会话中可用**；DoD 四类全绿 | **公开发布（`git push`，独立授权）** | 未在本机安装验证；`docs/` 混淆未声明 |

---

## 11. 明确的非目标（YAGNI）

- **不写回项目文档**（用户已决策：只读 + 实时自动跟随）。
- **不做多项目总览**（用户已决策：单项目深视图）。
- 不做会话全轨迹（数据源 C）解析。
- 不做用户体系、权限、远程访问、移动端适配、数据库。
- 不引入构建步骤与前端框架（可逆决策；若 M4 后发现交互复杂度确需，只换展示层）。
- 不做"进度百分比"——dayu 明确禁止虚构进度；节点按证据关闭。
- 不做 AI 生成的摘要或建议（会引入幻觉，与本工具立意相悖）。

---

## 12. 已登记的决策、偏差与风险

| # | 项 | 类型 | 内容 |
| --- | --- | --- | --- |
| D1 | 落地形态 | 已批准（用户，2026-10-11） | 独立本地 Web 应用 |
| D2 | 组织主线 | 已批准（用户，2026-10-11） | 单项目深视图 |
| D3 | 交互深度 | 已批准（用户，2026-10-11） | 只读 + 实时自动跟随 |
| D4 | 交付形态 | 已批准（用户，2026-10-11） | 作为 dayu 新 DLC `feature/dayu-viz` |
| D5 | 技术路线 | 已批准（用户，2026-10-11） | 分层：解析层零依赖稳定，展示层先零构建 |
| D6 | 分支基线 | 执行者决定（可逆工程细节） | 基于 `origin/main` 建 `feature/dayu-viz`；README 追加 DLC ③ 小节（与两个既有 DLC 分支形状一致） |
| D7 | `docs/` 随 DLC 发布 | 执行者决定（可逆） | 保留并与 `provenance/` 并列；首屏声明其性质。若不妥可改为打包时排除 |
| **Q01** | **`git push` 到 GitHub** | **待批准** | 本地 commit 可做；**推送与建 PR 未获授权，不得执行** |
| Q02 | 图表库最终选型（ECharts vs 轻量替代） | 最迟 `M2` 前冻结 | 影响 `vendor/` 体积 |
| Q03 | 是否包含 V7 上下文健康度面板 | 最迟 `M4` 前 | 需先确认 `tokenUsage`/`contextPressure` 字段语义 |
| Q04 | 本机安装位置（`~/.dsh/skills` 与 `~/.config/opencode/skills` 是否都装） | 最迟 `M5` 前 | 影响安装说明与验证范围 |
| 风险 | 真实文档格式漂移导致解析脆 | 缓解见 §7 + C 类契约测试 | 残余：新项目措辞差异可能降级为 `unknown`（可接受——宁可 unknown，不可编造） |
| 已知不可信 | `D:\DSH\docs` 的项目状态会随后续会话变化 | 证据带 mtime，看板显示数据新鲜度 | 不得把本次读取结果当作该项目的永久状态 |

---

## 13. 环境约束（实测，影响开发方式）

| 约束 | 实测结果 | 影响 |
| --- | --- | --- |
| `D:\DSH` 位于 **exFAT** 卷 | exFAT 不支持硬链接与 junction | 基于硬链接的原子写入工具在 D 盘失效；新建文件需经 C 盘暂存后拷入，修改使用原地编辑 |
| npm registry | 经本机代理 `198.18.0.101` 可达（`npm view vite` → 8.3.4） | 依赖安装不受限；但技能目录"拷贝即用"要求仍选择零依赖 |
| GitHub | `git ls-remote` 可达；`web_fetch` 因解析到非公网 IP 被拒 | 用 git 而非 web 获取上游；推送需授权 |

---

## 14. 复审要点（请用户确认）

1. §2 的 DLC 打包形状（分支名 `feature/dayu-viz`、目录结构、README 续写 DLC ③）是否符合预期。
2. §10 的 `M0–M5` 切分顺序是否认可（M1 先只做驾驶舱，agent 协作放到 M4）。
3. §8.2 的 12 条红旗规则是否有遗漏或误报担忧。
4. §12 的 `Q01`（是否授权推送）与 `Q03`（是否要上下文健康度面板）需要你表态。
