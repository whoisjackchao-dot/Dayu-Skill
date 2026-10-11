import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderOverview } from '../web/views/overview.mjs';
import { statusBadge, escapeHtml } from '../web/components/status-badge.mjs';
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

// 判别式断言（原始形态必须缺席 + 转义形态必须到场）：
// 只有这样才能证伪「恒等实现」（return String(s)）——恒等实现会让前半条断言失败。
test('escapeHtml 真正转义敌对标记，而不是原样透传', () => {
  const raw = '<img src=x onerror=alert(1)>';
  const out = escapeHtml(raw);

  assert.equal(out.includes('<img'), false, `不得保留原始 <img 标签，实际输出：${out}`);
  assert.equal(out.includes('&lt;img'), true, `必须转义出 &lt;img，实际输出：${out}`);
  assert.equal(out.includes('>'), false, `不得保留原始的 >，实际输出：${out}`);
  assert.equal(out.includes('&gt;'), true, `必须转义出 &gt;，实际输出：${out}`);

  // 属性截断形态：双引号同样必须转义
  const attr = escapeHtml('"><img src=x>');
  assert.equal(attr.includes('"><'), false, `不得保留可截断属性的 "><，实际输出：${attr}`);
  assert.equal(attr.includes('&quot;&gt;&lt;img'), true, `必须转义为 &quot;&gt;&lt;img，实际输出：${attr}`);
});

test('renderOverview 转义项目文档里的敌对标记（决策问题/交接值/告警）', () => {
  const hostile = (n) => `<img src=x onerror=alert(${n})>`;
  const p = emptyProject('D:/x', 'D:/x/docs', '2026-10-11T00:00:00.000Z');
  p.status.handover.completed = hostile(1);
  p.decisions.push({
    id: 'Q99', question: hostile(2), state: 'pending', date: null, basis: '',
    affectedNodes: [], approvalNote: null, notCovering: [], source: { file: 'f', line: 1 },
  });
  p.meta.warnings.push({ code: 'W99', message: hostile(3) });

  const html = renderOverview(p);

  for (const n of [1, 2, 3]) {
    assert.equal(html.includes(hostile(n)), false, `第 ${n} 处敌对原文不得出现在渲染结果中`);
  }
  for (const n of [1, 2, 3]) {
    assert.equal(html.includes(hostile(n).replace('<', '&lt;').replace('>', '&gt;')), true, `第 ${n} 处必须出现转义形态`);
  }
  assert.equal(html.includes('<img'), false, '渲染结果不得含任何原始 <img 标签');
});
