import { parseDocument, colIndex, cellAt } from './markdown.mjs';
import { UNKNOWN, addWarning, stripEmphasis } from './model.mjs';

/** 就地写入 project.requirements 与 project.gates。 */
export function parseRequirements(text, project, file = '02-requirements.md') {
  const doc = parseDocument(text);

  // 注意：findTables 把文档标题也算进标题路径，本文件标题含「验收门槛」，
  // 因此门槛表的定位必须叠加表头判据，否则会命中文档里的第一张表。
  const byHeader = (...names) => doc.tables.find((t) => names.every((n) => colIndex(t.header, n) >= 0));

  // ---- 需求表 ----
  const reqTable = byHeader('编号', '已确认要求') ?? byHeader('ID', '已确认要求');
  if (reqTable) {
    const idIdx = colIndex(reqTable.header, '编号', 'ID');
    const txtIdx = colIndex(reqTable.header, '已确认要求', '要求', '内容');
    if (idIdx >= 0 && txtIdx >= 0) {
      reqTable.rows.forEach((row, i) => {
        const id = stripEmphasis(cellAt(row, idIdx) ?? '');
        if (!/^R\d+$/.test(id)) return;
        project.requirements.push({
          id,
          text: (cellAt(row, txtIdx) ?? '').trim(),
          gates: [],
          source: { file, line: reqTable.line + 2 + i },
        });
      });
    } else {
      addWarning(project, 'BAD_REQUIREMENT_TABLE', '需求表缺少 编号 或 已确认要求 列', { file, line: reqTable.line });
    }
  } else {
    addWarning(project, 'NO_REQUIREMENT_TABLE', '未找到需求表', { file });
  }

  // ---- 验收门槛表：两种真实形态 ----
  const gateTable = byHeader('门槛', '判定标准') ?? byHeader('门槛', '数值');
  if (gateTable) {
    const idIdx = colIndex(gateTable.header, '门槛', 'ID');
    const critIdx = colIndex(gateTable.header, '判定标准');
    const topicIdx = colIndex(gateTable.header, '主题');
    const valIdx = colIndex(gateTable.header, '数值', '值');
    gateTable.rows.forEach((row, i) => {
      const id = stripEmphasis(cellAt(row, idIdx) ?? '');
      if (!/^G\d+/.test(id)) return;
      const rawCrit = critIdx >= 0 ? (cellAt(row, critIdx) ?? '').trim() : '';
      const rawTopic = topicIdx >= 0 ? (cellAt(row, topicIdx) ?? '').trim() : '';
      const rawVal = valIdx >= 0 ? stripEmphasis(cellAt(row, valIdx) ?? '').trim() : '';
      let state = 'defined';
      if (critIdx >= 0 && rawCrit) state = 'defined';
      else if (/^TBD$/i.test(rawVal) || rawVal === '') state = 'tbd';
      else if (rawVal.includes('待') || rawVal.includes('未定')) state = 'pending';
      else state = 'defined';
      project.gates.push({
        id,
        topic: rawTopic || UNKNOWN,
        value: critIdx >= 0 && rawCrit ? rawCrit : (rawVal || UNKNOWN),
        state,
        source: { file, line: gateTable.line + 2 + i },
      });
    });
  } else {
    addWarning(project, 'NO_GATE_TABLE', '未找到验收门槛表', { file });
  }
}
