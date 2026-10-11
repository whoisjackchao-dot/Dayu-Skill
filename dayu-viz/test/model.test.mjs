import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  UNKNOWN, emptyProject, addWarning, normalizeDecisionState,
  normalizeCaseState, extractIds, extractDate, stripEmphasis,
} from '../src/core/model.mjs';

test('emptyProject 的未填字段必须是 unknown，不能是空串或 0', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', '2026-10-11T00:00:00.000Z');
  assert.equal(p.status.phase, UNKNOWN);
  assert.equal(p.status.currentNode, UNKNOWN);
  assert.equal(p.status.handover.completed, UNKNOWN);
  assert.equal(p.requirements.length, 0);
  assert.equal(p.meta.parsedAt, '2026-10-11T00:00:00.000Z');
});

test('normalizeDecisionState 覆盖真实文档里的三种写法', () => {
  assert.equal(normalizeDecisionState('✅ **已批准 A（2026-09-25）**：字节全家桶'), 'approved');
  assert.equal(normalizeDecisionState('⏳ **待批准（有前置）**：协议草案已出'), 'pending');
  assert.equal(normalizeDecisionState('⏳ 待批准（默认否：需入驻审核）'), 'pending');
  assert.equal(normalizeDecisionState('未决：最迟 M2 前'), 'undecided');
  assert.equal(normalizeDecisionState(''), 'unknown');
});

test('normalizeCaseState 只用五个合法值加 unknown', () => {
  assert.equal(normalizeCaseState('PASS'), 'PASS');
  assert.equal(normalizeCaseState('BLOCKED（等 Key）'), 'BLOCKED');
  assert.equal(normalizeCaseState('NOT_APPLICABLE_APPROVED'), 'NOT_APPLICABLE_APPROVED');
  assert.equal(normalizeCaseState('未执行'), 'unknown');
});

test('extractIds 按前缀抽编号并去重保序', () => {
  assert.deepEqual(extractIds('`M0` → `M1` 过渡', 'M'), ['M0', 'M1']);
  assert.deepEqual(extractIds('M1、M1、M12', 'M'), ['M1', 'M12']);
  assert.deepEqual(extractIds('没有编号', 'M'), []);
});

test('extractDate 抽取 YYYY-MM-DD', () => {
  assert.equal(extractDate('最后更新：2026-09-25，第六次写回'), '2026-09-25');
  assert.equal(extractDate('无日期'), null);
});

test('stripEmphasis 去掉粗体与行内代码标记', () => {
  assert.equal(stripEmphasis('✅ **已批准** `Q01`'), '✅ 已批准 Q01');
});

test('addWarning 追加 warning 且带定位', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  addWarning(p, 'MULTI_NODE', '当前节点表述含多个里程碑', { file: '00-index.md', line: 11 });
  assert.equal(p.meta.warnings.length, 1);
  assert.deepEqual(p.meta.warnings[0].ref, { file: '00-index.md', line: 11 });
});
