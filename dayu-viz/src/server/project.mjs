// 唯一读盘处。core 层不得读文件，所有 IO 集中在此。
import fs from 'node:fs/promises';
import path from 'node:path';
import { emptyProject, addWarning } from '../core/model.mjs';
import { buildInventory } from '../core/parse-inventory.mjs';
import { parseIndex } from '../core/parse-index.mjs';
import { parseDecisions } from '../core/parse-decisions.mjs';
import { parseRequirements } from '../core/parse-requirements.mjs';
import { parsePlan } from '../core/parse-plan.mjs';

export const DOC_FILES = [
  '00-index.md',
  '01-decisions.md',
  '02-requirements.md',
  '03-feasibility.md',
  '04-adr.md',
  '05-plan.md',
  '06-test-matrix.md',
  '07-evidence-log.md',
  '08-readiness.md',
  '09-acceptance.md',
  '10-delivery.md',
  'contracts/README.md',
];

export async function readDocs(docsDir) {
  const entries = [];
  for (const file of DOC_FILES) {
    const abs = path.join(docsDir, file);
    try {
      const stat = await fs.stat(abs);
      const text = await fs.readFile(abs, 'utf8');
      entries.push({ file, exists: true, text, bytes: stat.size, mtime: stat.mtime.toISOString() });
    } catch (err) {
      if (err.code === 'ENOENT') {
        entries.push({ file, exists: false });
      } else {
        throw err;
      }
    }
  }
  return entries;
}

export function buildProject(docsDir, entries, { parsedAt, projectRoot }) {
  const project = emptyProject(projectRoot ?? path.dirname(docsDir), docsDir, parsedAt);
  project.meta.inventory = buildInventory(entries);

  const byFile = new Map(entries.map((e) => [e.file, e]));
  const get = (f) => byFile.get(f)?.text;

  const idx = get('00-index.md');
  if (idx) {
    parseIndex(idx, project, '00-index.md');
    const title = /^#\s+(.+)$/m.exec(idx);
    if (title) project.meta.name = title[1].trim();
  } else {
    addWarning(project, 'NO_INDEX', '缺少 00-index.md，无法确定项目阶段');
  }

  const dec = get('01-decisions.md');
  if (dec) parseDecisions(dec, project, '01-decisions.md');

  const req = get('02-requirements.md');
  if (req) parseRequirements(req, project, '02-requirements.md');

  const plan = get('05-plan.md');
  if (plan) parsePlan(plan, project, '05-plan.md');

  return project;
}

export async function loadProject(projectRoot) {
  const docsDir = path.join(projectRoot, 'docs');
  let stat;
  try {
    stat = await fs.stat(docsDir);
  } catch {
    throw new Error(`docs 目录不存在：${docsDir}`);
  }
  if (!stat.isDirectory()) throw new Error(`不是目录：${docsDir}`);

  const entries = await readDocs(docsDir);
  const parsedAt = new Date().toISOString();
  return buildProject(docsDir, entries, { parsedAt, projectRoot });
}
