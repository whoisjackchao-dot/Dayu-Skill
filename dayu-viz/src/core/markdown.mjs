// 纯解析：零 node:* 依赖、无 IO、无时钟。所有输出仅由输入文本决定。

export function toRe(pattern) {
  if (pattern instanceof RegExp) return pattern;
  return new RegExp(String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

export function splitRow(line) {
  const t = String(line ?? '').trim();
  if (!t.startsWith('|')) return null;
  const body = t.replace(/^\|/, '').replace(/\|$/, '');
  return body.split('|').map((c) => c.trim());
}

export function isSeparatorRow(cells) {
  if (!Array.isArray(cells) || cells.length === 0) return false;
  return cells.every((c) => /^:?-{2,}:?$/.test(String(c).replace(/\s/g, '')));
}

export function parseDocument(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const headings = [];
  const tables = [];
  const stack = [];

  for (let i = 0; i < lines.length; i++) {
    const h = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (h) {
      const level = h[1].length;
      const htext = h[2].trim();
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      stack.push({ level, text: htext, line: i + 1 });
      headings.push({ level, text: htext, line: i + 1 });
      continue;
    }

    const cells = splitRow(lines[i]);
    if (!cells) continue;
    const next = splitRow(lines[i + 1] ?? '');
    if (!next || !isSeparatorRow(next)) continue;

    const rows = [];
    let j = i + 2;
    while (j < lines.length) {
      const r = splitRow(lines[j]);
      if (!r) break;
      rows.push(r);
      j++;
    }
    tables.push({
      header: cells,
      rows,
      line: i + 1,
      headings: stack.map((s) => s.text),
    });
    i = j - 1;
  }

  return { lines, headings, tables };
}

export function findTables(doc, pattern) {
  const re = toRe(pattern);
  return doc.tables.filter((t) => t.headings.some((h) => re.test(h)));
}

export function colIndex(header, ...names) {
  for (const name of names) {
    const re = toRe(name);
    const i = header.findIndex((h) => re.test(h));
    if (i >= 0) return i;
  }
  return -1;
}

export function cellAt(row, idx) {
  if (!Array.isArray(row) || idx < 0 || idx >= row.length) return null;
  const v = row[idx];
  return v === undefined ? null : v;
}

export function hasPlaceholder(s) {
  return /<[^<>\n]{1,60}>/.test(String(s ?? ''));
}

export function isBlank(s) {
  return s === undefined || s === null || String(s).trim() === '';
}

export function checkboxItems(text) {
  const out = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = /^\s*-\s*\[( |x|X)\]\s*(.*)$/.exec(line);
    if (m) out.push({ checked: m[1].toLowerCase() === 'x', text: m[2].trim() });
  }
  return out;
}
