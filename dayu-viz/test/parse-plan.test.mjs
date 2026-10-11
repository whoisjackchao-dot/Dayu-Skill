import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlan } from '../src/core/parse-plan.mjs';
import { emptyProject } from '../src/core/model.mjs';

const PLAN = `# 里程碑与 Definition of Ready

## 1. 节点序列

| 节点 | 名称 | 状态 |
| --- | --- | --- |
| \`M0\` | 可测试需求与决策基线（**不是可用软件**） | 进行中 |
| \`M1\` | 第一纵向增量：一句话 → 一张图 | 未开始（被 Q02 + Key 阻塞） |
| \`M2\` | 一句话 → 一段视频 | 未开始 |

## 2. 里程碑卡片

### M1：一句话 → 一张图

- **用户价值**：用户说一句需求，得到一张真实生成的图片文件。
- **入口**：M0 需求基线；\`Q01\`✅
- **交付**：① spike 证据；② 生成脚本
- **测试策略**：脚本走 T；对账走 C；真实调用走 H
- **适用用例**：\`IMG-01\`、\`IMG-02\`（API 报错处理）
- **演示脚本**：GUI 输入一句需求；**失败场景**：用无效 Key
- **出口判据**：IMG-01…04 执行记录非 NOT_RUN
- **明确未交付**：视频生成（M2）、多源编排（M3）
- **不算完成**：① 只有 mock 未落盘；② 只跑通一次便宣称稳定

### M2：一句话 → 一段视频

- **用户价值**：得到一段短视频。
- **明确未交付**：图生视频
- **不算完成**：① 单次成功即宣称达标

## 3. 首个故事的 DoR 核查

| # | 条件 | 状态 |
| --- | --- | --- |
| 1 | 可演示结果 + 不含什么 | ✅ 一张真实图片落盘 |
| 2 | 用例及预期；T/C/H/D | ⏳ 待写入测试矩阵 |

### 3.1 常量批准前置

| 符号 | 批准值 | 单位 | 批准依据 |
| --- | --- | --- | --- |
| \`MONTHLY_BUDGET\` | **50**（告警线 40） | 元/月 | \`Q02\` ✅ 2026-09-25 |
`;

test('节点序列给出里程碑与状态', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parsePlan(PLAN, p, '05-plan.md');
  assert.deepEqual(p.milestones.map((m) => m.id), ['M0', 'M1', 'M2']);
  assert.match(p.milestones[0].state, /进行中/);
});

test('里程碑卡片九个字段全部解析', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parsePlan(PLAN, p, '05-plan.md');
  const m1 = p.milestones.find((m) => m.id === 'M1');
  assert.match(m1.name, /一句话 → 一张图/);
  assert.match(m1.fields.userValue, /得到一张真实生成的图片文件/);
  assert.deepEqual(m1.fields.cases, ['IMG-01', 'IMG-02']);
  assert.equal(m1.fields.notDelivered.length, 2);
  assert.equal(m1.fields.notDone.length, 2);
  assert.match(m1.fields.exitCriteria, /非 NOT_RUN/);
});

test('「不算完成」与「明确未交付」逐条拆分', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parsePlan(PLAN, p, '05-plan.md');
  const m2 = p.milestones.find((m) => m.id === 'M2');
  assert.deepEqual(m2.fields.notDelivered, ['图生视频']);
  assert.equal(m2.fields.notDone.length, 1);
});

test('缺「不算完成」的卡片记 warning（dayu 要求该字段必填）', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parsePlan(PLAN, p, '05-plan.md');
  const m0 = p.milestones.find((m) => m.id === 'M0');
  assert.equal(p.meta.warnings.some((w) => w.code === 'MISSING_NOT_DONE' && /M0/.test(w.message)), true);
  assert.equal(m0.fields.notDone.length, 0);
});

test('DoR 与常量表被解析', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parsePlan(PLAN, p, '05-plan.md');
  assert.equal(p.planExtras.dor.length, 2);
  assert.equal(p.planExtras.constants.length, 1);
  assert.equal(p.planExtras.constants[0].symbol, 'MONTHLY_BUDGET');
});
