import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRequirements } from '../src/core/parse-requirements.mjs';
import { emptyProject } from '../src/core/model.mjs';

const REQ_A = `# 项目：需求与验收门槛

## 2. 已确认需求

| 编号 | 已确认要求 |
| --- | --- |
| \`R01\` | 每日优雅收工：状态必须写回 \`00-index.md\` |
| \`R06\` | 生成过程可实时演示；**禁止静默等待** |

## 3. 验收门槛

| 门槛 | 判定标准 |
| --- | --- |
| \`G1\` | 目标会话内的追加行为可被自动化断言 |
`;

const REQ_B = `# 项目：需求与验收门槛

## 3. 验收门槛（G）

| 门槛 | 主题 | 数值 |
| --- | --- | --- |
| \`G1\` | 文生图成功率与产物可打开性 | \`TBD\` |
| \`G3\` | 端到端时延 | 待 Q05 批准 |
`;

test('解析需求表（编号 + 已确认要求）', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parseRequirements(REQ_A, p, '02-requirements.md');
  assert.equal(p.requirements.length, 2);
  assert.equal(p.requirements[0].id, 'R01');
  assert.match(p.requirements[1].text, /禁止静默等待/);
  assert.equal(p.requirements[0].source.file, '02-requirements.md');
});

test('判定标准形态的门槛被解析，TBD 保持原样不当成已批准', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parseRequirements(REQ_A, p, '02-requirements.md');
  assert.equal(p.gates.length, 1);
  assert.equal(p.gates[0].id, 'G1');
  assert.match(p.gates[0].value, /可被自动化断言/);
  assert.equal(p.gates[0].state, 'defined');
});

test('主题+数值形态的门槛被解析，TBD 标为 tbd', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parseRequirements(REQ_B, p, '02-requirements.md');
  assert.equal(p.gates.length, 2);
  assert.equal(p.gates[0].topic, '文生图成功率与产物可打开性');
  assert.equal(p.gates[0].state, 'tbd');
  assert.equal(p.gates[1].state, 'pending');
});

test('缺表只记 warning，不抛错', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  parseRequirements('# 空文档\n', p, '02-requirements.md');
  assert.equal(p.requirements.length, 0);
  assert.equal(p.meta.warnings.some((w) => w.code === 'NO_REQUIREMENT_TABLE'), true);
});
