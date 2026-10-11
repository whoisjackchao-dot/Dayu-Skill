import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWatcher } from '../src/server/watcher.mjs';
import { createHttpServer } from '../src/server/server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, 'fixtures', 'sample-project');

test('watcher 在文件变化后去抖触发一次回调', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dayu-viz-watch-'));
  const target = path.join(dir, 'a.md');
  await fs.writeFile(target, 'one');

  let hits = 0;
  const w = createWatcher([dir], () => { hits++; }, { debounceMs: 80 });
  await new Promise((r) => setTimeout(r, 120));

  await fs.writeFile(target, 'two');
  await fs.writeFile(target, 'three');
  await new Promise((r) => setTimeout(r, 400));

  w.close();
  assert.equal(hits >= 1, true, `期望至少触发 1 次，实际 ${hits}`);
  assert.equal(hits <= 2, true, `去抖应合并连续写入，实际 ${hits}`);
  await fs.rm(dir, { recursive: true, force: true });
});

test('GET /api/model 返回解析后的模型', async () => {
  const server = createHttpServer({ projectRoot: FIXTURE, webDir: null });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/model`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    const body = await res.json();
    assert.equal(body.status.phase, 2);
    assert.equal(body.requirements.length, 2);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('静态文件路径穿越被拒绝', async () => {
  const server = createHttpServer({ projectRoot: FIXTURE, webDir: path.join(here, 'fixtures') });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/../package.json`);
    assert.equal(res.status === 403 || res.status === 404, true);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
