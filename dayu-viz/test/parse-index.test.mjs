import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIndex } from '../src/core/parse-index.mjs';
import { emptyProject } from '../src/core/model.mjs';

const INDEX = `# 生成创作 Agent

## 当前状态

| 字段 | 值 |
| --- | --- |
| 当前阶段 | 阶段 2：项目规划（阶段 0–1 出口条件已基本满足） |
| 当前节点 | \`M0\` → \`M1\` 过渡：规划文档就绪，\`SPIKE-B01\` 待授权 |
| 本会话目标 | M1 规划完成（\`05-plan.md\` v0.1） |
| 文档版本 | 2026-09-25 / v0.4（新增 R06） |

## 交接（最后更新：2026-09-25，第六次写回）

- **阶段/节点**：阶段 2 / \`M0\` 基线冻结中 → \`SPIKE-B01\` 就绪待 Key
- **本次完成**：Q02 批准；测试矩阵建立
- **本次未完成**：spike 未执行（唯一缺口 = 火山 Key）
- **下一步**：用户供 Key → 执行 IMG-01…04
- **待用户决定**：Q05（G1–G4 数值）；Q06（默认否）
- **不要重复询问**：Q02=50 元/月已批，不要再问费用
- **已知不可信**：EV-Q02-1 价格为第三方转述
`;

test('当前阶段含多个阶段号时置 unknown 并报 MULTI_PHASE（不再自信取首值）', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parseIndex(INDEX, p, '00-index.md');
  assert.equal(p.status.phase, 'unknown');
  const w = p.meta.warnings.find((x) => x.code === 'MULTI_PHASE');
  assert.ok(w, 'INDEX 单元格同时含 阶段 2 与 阶段 0–1，必须产出 MULTI_PHASE 告警');
  assert.equal(w.message, '当前阶段表述含多个阶段号（0、1、2），无法唯一确定，置为 unknown');
  assert.deepEqual(w.ref, { file: '00-index.md', line: 7 });
});

test('解析阶段、节点、会话目标与文档版本', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parseIndex(INDEX, p, '00-index.md');
  assert.equal(p.status.phase, 'unknown');
  assert.equal(p.status.currentNode, 'M0');
  assert.match(p.status.sessionGoal, /M1 规划完成/);
  assert.match(p.status.docVersion, /v0\.4/);
});

test('交接块六字段全部解析，并对 Q 编号做抽取', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parseIndex(INDEX, p, '00-index.md');
  const h = p.status.handover;
  assert.equal(h.updatedAt, '2026-09-25');
  assert.match(h.completed, /Q02 批准/);
  assert.match(h.notCompleted, /spike 未执行/);
  assert.match(h.next, /用户供 Key/);
  assert.equal(h.awaitingUser, 'Q05（G1–G4 数值）；Q06（默认否）');
  assert.match(h.dontReask, /不要再问费用/);
  assert.match(h.untrusted, /第三方转述/);
});

test('节点表述含多个里程碑时取首个并记 warning', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parseIndex(INDEX, p, '00-index.md');
  assert.equal(p.status.currentNode, 'M0');
  const w = p.meta.warnings.find((x) => x.code === 'MULTI_NODE');
  assert.equal(w.message.includes('M0'), true);
  assert.equal(w.ref.file, '00-index.md');
  assert.equal(typeof w.ref.line, 'number');
});

test('模板 index（占位符）不得被当作有效阶段，也不得报 MULTI_PHASE', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parseIndex('## 当前状态\n\n| 字段 | 值 |\n| --- | --- |\n| 当前阶段 | 阶段 <0–6>：<名称> |\n| 当前节点 | `M<N>`：<名称> |\n', p, '00-index.md');
  assert.equal(p.status.phase, 'unknown');
  assert.equal(p.status.currentNode, 'unknown');
  assert.equal(p.meta.warnings.some((x) => x.code === 'MULTI_PHASE'), false);
});

// 该表仅一行数据：表头在第 5 行、分隔行第 6 行，「当前阶段」数据行 = 第 7 行。
const statusTable = (phaseCell) =>
  `# T\n\n## 当前状态\n\n| 字段 | 值 |\n| --- | --- |\n| 当前阶段 | ${phaseCell} |\n\n## 交接（最后更新：2026-10-11）\n\n- **本次完成**：x\n`;

test('唯一阶段号：取该值且无 MULTI_PHASE 告警', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parseIndex(statusTable('阶段 2：项目规划'), p, '00-index.md');
  assert.equal(p.status.phase, 2);
  assert.deepEqual(p.meta.warnings.filter((x) => x.code === 'MULTI_PHASE'), []);
});

test('两个不同阶段号：置 unknown 并报 MULTI_PHASE，候选与行号都在告警里', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parseIndex(statusTable('阶段 0–1 完成，进入阶段 2'), p, '00-index.md');
  assert.equal(p.status.phase, 'unknown');
  const w = p.meta.warnings.find((x) => x.code === 'MULTI_PHASE');
  assert.ok(w, '阶段 0–1 完成，进入阶段 2 含两个不同阶段号，必须报 MULTI_PHASE');
  assert.equal(w.message, '当前阶段表述含多个阶段号（0、1、2），无法唯一确定，置为 unknown');
  assert.deepEqual(w.ref, { file: '00-index.md', line: 7 });
});

test('同一阶段号重复出现不算歧义：取该值且无告警', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parseIndex(statusTable('阶段 3 收尾，阶段 3 验证'), p, '00-index.md');
  assert.equal(p.status.phase, 3);
  assert.deepEqual(p.meta.warnings.filter((x) => x.code === 'MULTI_PHASE'), []);
});
