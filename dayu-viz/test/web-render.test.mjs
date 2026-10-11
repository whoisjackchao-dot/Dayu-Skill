import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderOverview } from '../web/views/overview.mjs';
import { statusBadge } from '../web/components/status-badge.mjs';
import { emptyProject } from '../src/core/model.mjs';

test('unknown 状态渲染为「未提供」，不得渲染成 0 或空白', () => {
  const html = statusBadge('unknown');
  assert.match(html, /未提供/);
  assert.match(html, /badge-unknown/);
});

test('BLOCKED 与 NOT_RUN 不得使用表示成功的样式', () => {
  for (const s of ['BLOCKED', 'NOT_RUN']) {
    const html = statusBadge(s);
    assert.equal(/badge-ok|badge-pass|green/.test(html), false, `${s} 不得渲染为成功样式`);
  }
});

test('驾驶舱渲染阶段、节点、阻塞、待批准与交接', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', '2026-10-11T00:00:00.000Z');
  p.status.phase = 2;
  p.status.currentNode = 'M1';
  p.status.handover.completed = '需求基线建立';
  p.decisions.push({ id: 'Q05', question: '门槛数值', state: 'pending', date: null, basis: '', affectedNodes: [], approvalNote: null, notCovering: [], source: { file: 'f', line: 1 } });
  const html = renderOverview(p);
  assert.match(html, /阶段 2/);
  assert.match(html, /M1/);
  assert.match(html, /Q05/);
  assert.match(html, /需求基线建立/);
});

test('模型缺字段时渲染 unknown 文案而不是抛错', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', 'now');
  const html = renderOverview(p);
  assert.equal(typeof html, 'string');
  assert.match(html, /未提供/);
});

test('status.phase 为 undefined 时渲染「未提供」，不得出现字面量 undefined', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', '2026-10-11T00:00:00.000Z');
  p.status.phase = undefined;
  const html = renderOverview(p);
  assert.match(html, /未提供/);
  assert.equal(html.includes('undefined'), false, '页面不得渲染字面量 undefined');
});

test('status.phase 为 null 时渲染「未提供」，不得出现字面量 null 阶段', () => {
  const p = emptyProject('D:/x', 'D:/x/docs', '2026-10-11T00:00:00.000Z');
  p.status.phase = null;
  const html = renderOverview(p);
  assert.match(html, /未提供/);
  assert.equal(html.includes('阶段 null'), false, '页面不得渲染「阶段 null」');
});
