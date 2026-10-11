import { parseDocument, findTables, colIndex, cellAt } from './markdown.mjs';
import { UNKNOWN, addWarning, extractIds, stripEmphasis } from './model.mjs';

const FIELD_KEYS = [
  ['userValue', /用户价值/],
  ['entry', /^入口$/],
  ['deliverable', /^交付$/],
  ['testStrategy', /测试策略/],
  ['cases', /适用用例/],
  ['demoScript', /演示脚本/],
  ['exitCriteria', /出口判据/],
  ['notDelivered', /明确未交付/],
  ['notDone', /不算完成/],
];

const LIST_FIELDS = new Set(['notDelivered', 'notDone']);

function emptyFields() {
  return {
    userValue: UNKNOWN, entry: UNKNOWN, deliverable: UNKNOWN, testStrategy: UNKNOWN,
    cases: [], demoScript: UNKNOWN, exitCriteria: UNKNOWN, notDelivered: [], notDone: [],
  };
}

/** 就地写入 project.milestones 与 project.planExtras。 */
export function parsePlan(text, project, file = '05-plan.md') {
  const doc = parseDocument(text);
  project.planExtras = project.planExtras ?? { dor: [], constants: [], authorizations: [], demos: [] };

  // ---- 1. 节点序列 ----
  const seqTable = findTables(doc, /节点序列/)[0];
  const byId = new Map();
  if (seqTable) {
    const idIdx = colIndex(seqTable.header, '节点');
    const nameIdx = colIndex(seqTable.header, '名称');
    const stIdx = colIndex(seqTable.header, '状态');
    seqTable.rows.forEach((row, i) => {
      const id = stripEmphasis(cellAt(row, idIdx) ?? '');
      if (!/^M\d+$/.test(id)) return;
      const m = {
        id,
        name: (cellAt(row, nameIdx) ?? '').trim(),
        state: (cellAt(row, stIdx) ?? '').trim() || UNKNOWN,
        fields: emptyFields(),
        source: { file, line: seqTable.line + 2 + i },
      };
      project.milestones.push(m);
      byId.set(id, m);
    });
  } else {
    addWarning(project, 'NO_MILESTONE_TABLE', '未找到节点序列表', { file });
  }

  // ---- 2. 里程碑卡片 ----
  const cardHeading = doc.headings.find((h) => /里程碑卡片/.test(h.text));
  const cardStart = cardHeading ? cardHeading.line : 0;
  let current = null;
  for (let i = cardStart; i < doc.lines.length; i++) {
    const line = doc.lines[i];
    const h = /^###\s+(M\d+)\s*[：:]\s*(.*)$/.exec(line);
    if (h) {
      const id = h[1];
      const milestone = byId.get(id);
      if (!milestone) {
        // 卡片存在但节点序列里没有 —— 登记偏差而不是静默忽略
        addWarning(project, 'CARD_WITHOUT_NODE', `里程碑卡片 ${id} 未出现在节点序列表中`, { file, line: i + 1 });
        current = null;
        continue;
      }
      milestone.name = h[2].trim() || milestone.name;
      milestone.fields = emptyFields();
      current = milestone;
      continue;
    }
    if (/^#{1,6}\s/.test(line) && !h) {
      if (/里程碑卡片/.test(line) === false && current) {
        // 卡片区段结束（遇到同级或更高级标题）
        if (/^#{1,3}\s/.test(line) && !/^####/.test(line)) current = null;
      }
      continue;
    }
    if (!current) continue;
    const m = /^\s*-\s*\*\*(.+?)\*\*[：:]\s*(.*)$/.exec(line);
    if (!m) continue;
    const label = m[1].trim();
    const value = m[2].trim();
    const hit = FIELD_KEYS.find(([, re]) => re.test(label));
    if (!hit) continue;
    const [key] = hit;
    if (LIST_FIELDS.has(key)) {
      current.fields[key] = splitItems(value);
    } else if (key === 'cases') {
      current.fields.cases = extractCaseIds(value);
    } else {
      current.fields[key] = value || UNKNOWN;
    }
  }

  for (const m of project.milestones) {
    if (m.fields.notDone.length === 0) {
      addWarning(project, 'MISSING_NOT_DONE', `里程碑 ${m.id} 缺少「不算完成」字段`, { file, line: m.source.line });
    }
  }

  // ---- 3. DoR ----
  // 文档标题是「里程碑与 Definition of Ready」，只按标题匹配会命中所有表；按表头定位。
  const dorTable = doc.tables.find(
    (t) => colIndex(t.header, '条件') >= 0 && colIndex(t.header, '状态') >= 0,
  );
  if (dorTable) {
    const nIdx = colIndex(dorTable.header, '#', '序号');
    const cIdx = colIndex(dorTable.header, '条件');
    const sIdx = colIndex(dorTable.header, '状态');
    dorTable.rows.forEach((row) => {
      project.planExtras.dor.push({
        n: (cellAt(row, nIdx) ?? '').trim(),
        condition: (cellAt(row, cIdx) ?? '').trim(),
        state: (cellAt(row, sIdx) ?? '').trim() || UNKNOWN,
      });
    });
  }

  // ---- 4. 常量批准前置 ----
  const constTable = doc.tables.find(
    (t) => colIndex(t.header, '符号') >= 0 && colIndex(t.header, '批准值') >= 0,
  );
  if (constTable) {
    const symIdx = colIndex(constTable.header, '符号');
    const valIdx = colIndex(constTable.header, '批准值');
    const unitIdx = colIndex(constTable.header, '单位');
    const basisIdx = colIndex(constTable.header, '批准依据');
    constTable.rows.forEach((row) => {
      const symbol = stripEmphasis(cellAt(row, symIdx) ?? '');
      if (!symbol) return;
      project.planExtras.constants.push({
        symbol,
        value: stripEmphasis(cellAt(row, valIdx) ?? '') || UNKNOWN,
        unit: (cellAt(row, unitIdx) ?? '').trim() || UNKNOWN,
        basis: stripEmphasis(cellAt(row, basisIdx) ?? '') || UNKNOWN,
      });
    });
  }
}

/** 把「① a；② b」或「a、b」拆成条目。 */
function splitItems(value) {
  return String(value ?? '')
    .split(/[；;、]/)
    .flatMap((s) => s.split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])/))
    .map((s) => s.replace(/^[①②③④⑤⑥⑦⑧⑨⑩\s]+/, '').trim())
    .filter(Boolean);
}

const CASE_ID_RE = /\b([A-Z]{2,6})-(\d{1,3})\b/g;

/** 抽取用例 ID（域前缀-两位序号），并展开 `IMG-01…04` 这类闭区间写法。 */
function extractCaseIds(value) {
  const out = [];
  const seen = new Set();
  const push = (id) => { if (!seen.has(id)) { seen.add(id); out.push(id); } };
  for (const m of String(value ?? '').matchAll(CASE_ID_RE)) {
    push(`${m[1]}-${m[2]}`);
  }
  // 处理 `IMG-01…04` / `TUI-01`—`TUI-18` 的区间写法
  const rangeRe = /\b([A-Z]{2,6})-(\d{1,3})\s*[…—–\-~至到]+\s*(\d{1,3})\b/g;
  for (const m of String(value ?? '').matchAll(rangeRe)) {
    const from = Number(m[2]);
    const to = Number(m[3]);
    if (to >= from && to - from <= 30) {
      for (let n = from; n <= to; n++) push(`${m[1]}-${String(n).padStart(2, '0')}`);
    }
  }
  return out;
}
