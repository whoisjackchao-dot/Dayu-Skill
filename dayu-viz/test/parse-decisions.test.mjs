import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDecisions } from '../src/core/parse-decisions.mjs';
import { emptyProject } from '../src/core/model.mjs';

const DECISIONS = `# 决策登记

## 1. 决策表

| ID | 决策内容 | 当前依据/状态 | 影响节点 |
| --- | --- | --- | --- |
| \`Q01\` | 生成层厂商组合 | ✅ **已批准 A（2026-09-25）**：字节全家桶 | \`M1\` |
| \`Q05\` | 验收门槛数值 | ⏳ **待批准（有前置）**：待用户审签 | \`M2\` |

## 2. 批准记录

### Q01 批准依据（2026-09-25）

用户在三个选项中选择 A。

**本批准不覆盖**：不批准任何付费调用；不排除未来追加兜底渠道。

### Q03 批准依据（2026-09-25）

用户选择 A。

**本批准不覆盖**：不构成对 GUI 产品化程度的验收结论。

## 5. 待决项

| 项 | 说明 | 关联 | 状态 |
| --- | --- | --- | --- |
| G1–G3 数值 | 用户未给值 | \`Q05\` | \`⏳\` |
`;

test('解析决策表三列并规范化状态', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parseDecisions(DECISIONS, p, '01-decisions.md');
  assert.equal(p.decisions.length, 2);
  const q1 = p.decisions[0];
  assert.equal(q1.id, 'Q01');
  assert.equal(q1.state, 'approved');
  assert.equal(q1.date, '2026-09-25');
  assert.deepEqual(q1.affectedNodes, ['M1']);
  assert.equal(q1.source.file, '01-decisions.md');
  assert.equal(typeof q1.source.line, 'number');
  assert.equal(p.decisions[1].state, 'pending');
});

test('批准记录里的「本批准不覆盖」被完整抽取', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parseDecisions(DECISIONS, p, '01-decisions.md');
  const q1 = p.decisions.find((d) => d.id === 'Q01');
  assert.equal(q1.notCovering.length, 2);
  assert.match(q1.notCovering[0], /不批准任何付费调用/);
  assert.match(q1.notCovering[1], /不排除未来追加兜底渠道/);
});

test('没有批准记录的决策，notCovering 为空数组且 approvalNote 为 null', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parseDecisions(DECISIONS, p, '01-decisions.md');
  const q5 = p.decisions.find((d) => d.id === 'Q05');
  assert.deepEqual(q5.notCovering, []);
  assert.equal(q5.approvalNote, null);
});

test('无法识别的状态一律 unknown，不得默认成 approved', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parseDecisions('## 1. 决策表\n\n| ID | 决策内容 | 当前依据/状态 | 影响节点 |\n| --- | --- | --- | --- |\n| `Q09` | 某事 | | `M1` |\n', p, 'f.md');
  assert.equal(p.decisions[0].state, 'unknown');
});
