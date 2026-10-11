import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadProject, DOC_FILES } from '../src/server/project.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, 'fixtures', 'sample-project');

test('DOC_FILES 覆盖 11 份文档加契约目录入口', () => {
  assert.equal(DOC_FILES.length, 12);
  assert.equal(DOC_FILES.includes('00-index.md'), true);
  assert.equal(DOC_FILES.includes('contracts/README.md'), true);
});

test('loadProject 组装出完整模型', async () => {
  const p = await loadProject(FIXTURE);
  assert.equal(p.status.phase, 2);
  assert.equal(p.status.currentNode, 'M0');
  assert.equal(p.decisions.length, 2);
  assert.equal(p.requirements.length, 2);
  assert.equal(p.gates.length, 1);
  assert.equal(p.milestones.length, 2);
  assert.equal(p.meta.inventory.length, 12);
});

test('缺失的文档在 inventory 里 exists=false，且不影响其他文档解析', async () => {
  const p = await loadProject(FIXTURE);
  const missing = p.meta.inventory.filter((e) => !e.exists).map((e) => e.file);
  assert.equal(missing.includes('09-acceptance.md'), true);
  assert.equal(p.meta.inventory.find((e) => e.file === '00-index.md').exists, true);
});

test('loadProject 对不存在的项目目录抛可识别错误', async () => {
  await assert.rejects(() => loadProject(path.join(here, 'fixtures', 'no-such-project')), /docs 目录不存在/);
});
