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
      // 收集「当前阶段」单元格里出现的全部不同阶段号；不确定就必须可表达，不要猜。
      // 规则：① 紧跟 `阶段` 的 `数字–数字` 区间记作两个独立阶段号（如 `阶段 0–1` → 0 与 1）；
      //      ② 每个 `阶段` 后紧跟的单个数字（负向先行断言排除已被 ① 计过的区间左端）。
      // 方括号占位符（`<0–6>`）不算阶段号，也不构成歧义。
      const found = new Set();
      for (const m of val.matchAll(/阶段\s*([0-6])\s*[-–—~～至到]\s*([0-6])|阶段\s*([0-6])(?!\s*[-–—~～至到]\s*\d)/g)) {
        if (m[1] !== undefined) {
          found.add(Number(m[1]));
          found.add(Number(m[2]));
        } else {
          found.add(Number(m[3]));
        }
      }
      const candidates = [...found].sort((a, b) => a - b);
      if (val.includes('<') || candidates.length === 0) {
        status.phase = UNKNOWN;
      } else if (candidates.length === 1) {
        status.phase = candidates[0];
      } else {
        status.phase = UNKNOWN;
        addWarning(
          project,
          'MULTI_PHASE',
          `当前阶段表述含多个阶段号（${candidates.join('、')}），无法唯一确定，置为 unknown`,
          { file, line },
        );
      }
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
