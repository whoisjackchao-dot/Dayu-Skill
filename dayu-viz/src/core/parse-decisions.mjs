import { parseDocument, colIndex, cellAt } from './markdown.mjs';
import {
  UNKNOWN, addWarning, normalizeDecisionState, extractIds, extractDate, stripEmphasis,
} from './model.mjs';

/** 就地写入 project.decisions。 */
export function parseDecisions(text, project, file = '01-decisions.md') {
  const doc = parseDocument(text);

  // 注意：findTables 把文档标题也算进标题路径，而本文件标题就是「决策登记」，
  // 只按标题匹配会命中所有表。因此必须叠加表头判据。
  const table = doc.tables.find(
    (t) => colIndex(t.header, 'ID') >= 0 && colIndex(t.header, '决策内容') >= 0,
  );
  if (!table) {
    addWarning(project, 'NO_DECISION_TABLE', '未找到决策表', { file });
    return;
  }

  const idIdx = colIndex(table.header, 'ID');
  const qIdx = colIndex(table.header, '决策内容');
  const sIdx = colIndex(table.header, '当前依据/状态', '状态', '依据');
  const nIdx = colIndex(table.header, '影响节点');

  if (idIdx < 0 || qIdx < 0) {
    addWarning(project, 'BAD_DECISION_TABLE', '决策表缺少 ID 或 决策内容 列', { file, line: table.line });
    return;
  }

  // 先扫批准记录，建立 id -> {notCovering, note}
  const approvals = collectApprovals(doc);

  table.rows.forEach((row, i) => {
    const id = stripEmphasis(cellAt(row, idIdx) ?? '');
    if (!/^Q\d+$/.test(id)) return;
    const stateText = cellAt(row, sIdx) ?? '';
    const approval = approvals.get(id) ?? { notCovering: [], note: null };
    project.decisions.push({
      id,
      question: (cellAt(row, qIdx) ?? '').trim(),
      state: normalizeDecisionState(stateText),
      date: extractDate(stateText),
      basis: stripEmphasis(stateText),
      affectedNodes: extractIds(cellAt(row, nIdx) ?? '', 'M'),
      approvalNote: approval.note,
      notCovering: approval.notCovering,
      source: { file, line: table.line + 2 + i },
    });
  });
}

function collectApprovals(doc) {
  const map = new Map();
  let current = null;
  for (const line of doc.lines) {
    const h = /^###\s+(Q\d+)\s*批准依据/.exec(line);
    if (h) {
      current = { id: h[1], notCovering: [], note: null, body: [] };
      map.set(current.id, current);
      continue;
    }
    if (/^#{1,6}\s/.test(line) && !h) { current = null; continue; }
    if (!current) continue;
    current.body.push(line);
    const m = /^\*\*本批准不覆盖\*\*[：:]\s*(.+)$/.exec(line.trim());
    if (m) current.note = m[1].trim();
  }
  // 把 note 按「；」拆成条目，保留原文措辞
  for (const a of map.values()) {
    a.notCovering = a.note
      ? a.note.split('；').map((s) => s.trim()).filter(Boolean)
      : [];
  }
  return map;
}
