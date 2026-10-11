import { parseDocument, hasPlaceholder } from './markdown.mjs';

/** 启发式阈值：占位符数量达到此值即认为该文档仍是未填模板。 */
export const TEMPLATE_PLACEHOLDER_THRESHOLD = 5;

export function buildInventory(entries) {
  return (entries ?? []).map((entry) => {
    const text = entry.text ?? '';
    if (!entry.exists) {
      return {
        file: entry.file, exists: false, isTemplate: false,
        placeholders: 0, dataRows: 0, bytes: 0, mtime: null,
      };
    }
    const doc = parseDocument(text);
    let placeholders = 0;
    for (const line of doc.lines) if (hasPlaceholder(line)) placeholders++;
    const dataRows = doc.tables.reduce((n, t) => n + t.rows.length, 0);
    return {
      file: entry.file,
      exists: true,
      isTemplate: placeholders >= TEMPLATE_PLACEHOLDER_THRESHOLD,
      placeholders,
      dataRows,
      bytes: entry.bytes ?? Buffer.byteLength(text, 'utf8'),
      mtime: entry.mtime ?? null,
    };
  });
}
