import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDocument, splitRow, isSeparatorRow, findTables,
  colIndex, cellAt, hasPlaceholder, isBlank, checkboxItems,
} from '../src/core/markdown.mjs';

const DOC = `# 标题

## 1. 决策表

| ID | 决策内容 | 当前依据/状态 | 影响节点 |
| --- | --- | --- | --- |
| \`Q01\` | 厂商组合 | ✅ **已批准 A（2026-09-25）** | \`M1\` |
| \`Q05\` | 门槛数值 | ⏳ **待批准（有前置）** | \`M2\` |

## 2. 别的章节

| 项 | 值 |
| --- | --- |
| 硬件 | <机型> |
`;

test('splitRow 去掉首尾竖线并按列切分', () => {
  assert.deepEqual(splitRow('| a | b |'), ['a', 'b']);
  assert.equal(splitRow('不是表格'), null);
});

test('isSeparatorRow 识别分隔行', () => {
  assert.equal(isSeparatorRow(['---', '---']), true);
  assert.equal(isSeparatorRow([':--', '--:']), true);
  assert.equal(isSeparatorRow(['ID', '值']), false);
});

test('parseDocument 记录表格行号与所属标题路径', () => {
  const doc = parseDocument(DOC);
  assert.equal(doc.tables.length, 2);
  assert.equal(doc.tables[0].line, 5);
  assert.deepEqual(doc.tables[0].header, ['ID', '决策内容', '当前依据/状态', '影响节点']);
  assert.equal(doc.tables[0].rows.length, 2);
  assert.deepEqual(doc.tables[0].headings, ['标题', '1. 决策表']);
});

test('findTables 按标题路径匹配，而不是按出现顺序', () => {
  const doc = parseDocument(DOC);
  assert.equal(findTables(doc, '决策表').length, 1);
  assert.equal(findTables(doc, /别的章节/).length, 1);
  assert.equal(findTables(doc, '不存在的章节').length, 0);
});

test('colIndex 按列名定位，容忍列序变化', () => {
  const doc = parseDocument(DOC);
  const t = doc.tables[0];
  assert.equal(colIndex(t.header, 'ID'), 0);
  assert.equal(colIndex(t.header, '影响节点'), 3);
  assert.equal(colIndex(t.header, '不存在的列'), -1);
});

test('cellAt 越界返回 null，不返回 undefined', () => {
  assert.equal(cellAt(['a'], 0), 'a');
  assert.equal(cellAt(['a'], 5), null);
});

test('hasPlaceholder 识别模板占位符', () => {
  assert.equal(hasPlaceholder('<机型>'), true);
  assert.equal(hasPlaceholder('Windows 11'), false);
});

test('isBlank 把 undefined/null/空白都视为空', () => {
  assert.equal(isBlank(undefined), true);
  assert.equal(isBlank(null), true);
  assert.equal(isBlank('   '), true);
  assert.equal(isBlank('x'), false);
});

test('checkboxItems 解析复选清单', () => {
  const items = checkboxItems('- [x] 已完成\n- [ ] 未完成');
  assert.deepEqual(items, [
    { checked: true, text: '已完成' },
    { checked: false, text: '未完成' },
  ]);
});
