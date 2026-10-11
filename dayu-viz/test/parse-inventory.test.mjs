import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInventory, TEMPLATE_PLACEHOLDER_THRESHOLD } from '../src/core/parse-inventory.mjs';

const FILLED = `# 决策登记

## 1. 决策表

| ID | 决策内容 |
| --- | --- |
| \`Q01\` | 厂商组合 |
| \`Q02\` | 费用上限 |
`;

const TEMPLATE = `# 决策登记

## 1. 决策表

| ID | 决策内容 |
| --- | --- |
| \`Q01\` | <要决定什么> |
| \`Q02\` | <要决定什么> |
| \`Q03\` | <要决定什么> |
| \`Q04\` | <要决定什么> |
| \`Q05\` | <要决定什么> |
`;

test('已填文档不会被误判为模板', () => {
  const [e] = buildInventory([{ file: '01-decisions.md', exists: true, text: FILLED }]);
  assert.equal(e.isTemplate, false);
  assert.equal(e.placeholders, 0);
  assert.equal(e.dataRows, 2);
});

test('占位符达到阈值判定为模板', () => {
  const [e] = buildInventory([{ file: '04-adr.md', exists: true, text: TEMPLATE }]);
  assert.equal(e.placeholders, TEMPLATE_PLACEHOLDER_THRESHOLD);
  assert.equal(e.isTemplate, true);
});

test('不存在的文档 exists=false 且不抛错', () => {
  const [e] = buildInventory([{ file: '09-acceptance.md', exists: false }]);
  assert.equal(e.exists, false);
  assert.equal(e.isTemplate, false);
  assert.equal(e.dataRows, 0);
});
