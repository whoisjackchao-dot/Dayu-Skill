import { parseDocument, findTables, colIndex, cellAt } from './markdown.mjs';
import { UNKNOWN, addWarning, extractIds, extractDate, stripEmphasis } from './model.mjs';

const HANDOVER_KEYS = [
  ['updatedAt', /最后更新/],
  ['completed', /本次完成/],
  ['notCompleted', /本次未完成/],
  ['next', /下一步/],
  ['awaitingUser', /待用户决定/],
  ['dontReask', /不要重复询问/],
  ['untrusted', /已知不可信/],
];

/** 就地写入 project.status。 */
export function parseIndex(text, project, file = '00-index.md') {
  const doc = parseDocument(text);
  const status = project.status;

  // 1. 当前状态表：按标题路径定位，不按位置
  // 叠加表头判据：findTables 的标题路径包含文档标题本身，只按标题匹配可能命中文档里的第一张表。
  const t = findTables(doc, /当前状态/)
    .find((x) => colIndex(x.header, '字段') >= 0 && colIndex(x.header, '值') >= 0);
  if (!t) {
    addWarning(project, 'NO_STATUS_TABLE', '未找到含 字段/值 列的「当前状态」表', { file });
    return;
  }
  const kIdx = colIndex(t.header, '字段');
  const vIdx = colIndex(t.header, '值');

  for (let i = 0; i < t.rows.length; i++) {
    const key = stripEmphasis(cellAt(t.rows[i], kIdx) ?? '');
    const val = (cellAt(t.rows[i], vIdx) ?? '').trim();
    const line = t.line + 2 + i;

    if (/当前阶段/.test(key)) {
      const m = /阶段\s*([0-6])/.exec(val);
      // 带占位符的「阶段 <0–6>」不构成有效阶段
      status.phase = m && !val.includes('<') ? Number(m[1]) : UNKNOWN;
    } else if (/当前节点/.test(key)) {
      const ids = extractIds(val, 'M');
      if (ids.length === 0) {
        status.currentNode = UNKNOWN;
      } else {
        status.currentNode = ids[0];
        if (ids.length > 1) {
          addWarning(
            project,
            'MULTI_NODE',
            `当前节点表述含多个里程碑（${ids.join('、')}），取首个 ${ids[0]}`,
            { file, line },
          );
        }
      }
    } else if (/本会话目标/.test(key)) {
      status.sessionGoal = val || UNKNOWN;
    } else if (/文档版本/.test(key)) {
      status.docVersion = val || UNKNOWN;
    }
  }

  // 2. 交接块：按「键：值」行解析，不依赖固定顺序
  const handoverHeading = doc.headings.find((h) => /交接/.test(h.text));
  if (!handoverHeading) {
    addWarning(project, 'NO_HANDOVER', '未找到交接块', { file });
    return;
  }
  status.handover.updatedAt = extractDate(handoverHeading.text) ?? UNKNOWN;

  const start = handoverHeading.line; // 1-based，下一行开始
  for (let i = start; i < doc.lines.length; i++) {
    const line = doc.lines[i];
    if (/^#{1,6}\s/.test(line)) break;
    const m = /^\s*-\s*\*\*(.+?)\*\*[：:]\s*(.*)$/.exec(line);
    if (!m) continue;
    const label = m[1].trim();
    const value = m[2].trim();
    const hit = HANDOVER_KEYS.find(([, re]) => re.test(label));
    if (hit && hit[0] !== 'updatedAt' && value) {
      status.handover[hit[0]] = value;
    }
  }
}
