// 状态徽章。配色语义是硬约束：BLOCKED / NOT_RUN / unknown 永远不得看起来像成功。
const CLASS = {
  PASS: 'badge-pass',
  FAIL: 'badge-fail',
  BLOCKED: 'badge-blocked',
  NOT_RUN: 'badge-notrun',
  NOT_APPLICABLE_APPROVED: 'badge-na',
  approved: 'badge-pass',
  pending: 'badge-blocked',
  undecided: 'badge-notrun',
  unknown: 'badge-unknown',
};

const LABEL = {
  unknown: '未提供',
  NOT_RUN: '未执行',
  BLOCKED: '阻塞',
  PASS: '通过',
  FAIL: '失败',
  NOT_APPLICABLE_APPROVED: '经批准不适用',
  approved: '已批准',
  pending: '待批准',
  undecided: '未决',
};

export function statusBadge(state) {
  const key = state ?? 'unknown';
  const cls = CLASS[key] ?? 'badge-unknown';
  const label = LABEL[key] ?? String(key);
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
