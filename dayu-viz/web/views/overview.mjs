import { statusBadge, escapeHtml } from '../components/status-badge.mjs';

const UNKNOWN_TEXT = '未提供';

function text(v) {
  if (v === null || v === undefined || v === '' || v === 'unknown') return `<span class="muted">${UNKNOWN_TEXT}</span>`;
  return escapeHtml(v);
}

function section(title, bodyHtml) {
  return `<section class="card"><h2>${escapeHtml(title)}</h2>${bodyHtml}</section>`;
}

function todoList(items, emptyText) {
  if (!items || items.length === 0) return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  return `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
}

export function renderOverview(model) {
  const s = model?.status ?? {};
  const h = s.handover ?? {};

  const redline = `
    <div class="redline">
      <span>阶段 <b>${s.phase === 'unknown' ? UNKNOWN_TEXT : s.phase}</b></span>
      <span>节点 <b>${text(s.currentNode)}</b></span>
      <span>待批准 <b>${(model?.decisions ?? []).filter((d) => d.state === 'pending' || d.state === 'undecided').length}</b></span>
      <span>数据时间 <b>${escapeHtml(model?.meta?.parsedAt ?? UNKNOWN_TEXT)}</b></span>
    </div>`;

  const pending = (model?.decisions ?? [])
    .filter((d) => d.state !== 'approved')
    .map((d) => `<tr><td><code>${escapeHtml(d.id)}</code></td><td>${escapeHtml(d.question)}</td><td>${statusBadge(d.state)}</td><td>${d.affectedNodes?.length ? escapeHtml(d.affectedNodes.join('、')) : `<span class="muted">${UNKNOWN_TEXT}</span>`}</td></tr>`)
    .join('');

  const milestoneRows = (model?.milestones ?? [])
    .map((m) => `<tr><td><code>${escapeHtml(m.id)}</code></td><td>${escapeHtml(m.name)}</td><td>${text(m.state)}</td><td>${m.fields?.cases?.length ?? 0}</td></tr>`)
    .join('');

  const warnings = (model?.meta?.warnings ?? [])
    .map((w) => `<li><code>${escapeHtml(w.code)}</code> ${escapeHtml(w.message)}${w.ref ? ` <span class="muted">(${escapeHtml(w.ref.file)}${w.ref.line ? ':' + w.ref.line : ''})</span>` : ''}</li>`)
    .join('');

  return `
    ${redline}
    ${section('当前状态', `
      <dl class="kv">
        <dt>当前阶段</dt><dd>${s.phase === 'unknown' ? UNKNOWN_TEXT : '阶段 ' + s.phase}</dd>
        <dt>当前节点</dt><dd>${text(s.currentNode)}</dd>
        <dt>本会话目标</dt><dd>${text(s.sessionGoal)}</dd>
        <dt>文档版本</dt><dd>${text(s.docVersion)}</dd>
      </dl>`)}

    ${section('待批准与未决（在等用户）', pending
      ? `<table><thead><tr><th>ID</th><th>问题</th><th>状态</th><th>影响节点</th></tr></thead><tbody>${pending}</tbody></table>`
      : `<p class="muted">${UNKNOWN_TEXT}</p>`)}

    ${section('里程碑节点轴', milestoneRows
      ? `<table><thead><tr><th>节点</th><th>名称</th><th>状态</th><th>适用用例</th></tr></thead><tbody>${milestoneRows}</tbody></table>`
      : `<p class="muted">${UNKNOWN_TEXT}</p>`)}

    ${section('交接块', `
      <dl class="kv">
        <dt>最后更新</dt><dd>${text(h.updatedAt)}</dd>
        <dt>本次完成</dt><dd>${text(h.completed)}</dd>
        <dt>本次未完成</dt><dd>${text(h.notCompleted)}</dd>
        <dt>下一步</dt><dd>${text(h.next)}</dd>
        <dt>待用户决定</dt><dd>${text(h.awaitingUser)}</dd>
        <dt>不要重复询问</dt><dd>${text(h.dontReask)}</dd>
        <dt>已知不可信</dt><dd>${text(h.untrusted)}</dd>
      </dl>`)}

    ${section('解析告警', warnings ? `<ul>${warnings}</ul>` : '<p class="muted">无</p>')}
  `;
}
