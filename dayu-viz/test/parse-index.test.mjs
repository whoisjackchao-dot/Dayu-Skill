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

test('解析阶段、节点、会话目标与文档版本', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parseIndex(INDEX, p, '00-index.md');
  assert.equal(p.status.phase, 2);
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

test('模板 index（占位符）不得被当作有效阶段', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parseIndex('## 当前状态\n\n| 字段 | 值 |\n| --- | --- |\n| 当前阶段 | 阶段 <0–6>：<名称> |\n| 当前节点 | `M<N>`：<名称> |\n', p, '00-index.md');
  assert.equal(p.status.phase, 'unknown');
  assert.equal(p.status.currentNode, 'unknown');
});
