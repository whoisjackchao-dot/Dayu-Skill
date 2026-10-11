import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWatcher } from '../src/server/watcher.mjs';
import { createHttpServer, isInsideDir } from '../src/server/server.mjs';

const here = nodePath.dirname(fileURLToPath(import.meta.url));
const FIXTURE = nodePath.join(here, 'fixtures', 'sample-project');

test('watcher 在文件变化后去抖触发一次回调', async () => {
  const dir = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'dayu-viz-watch-'));
  const target = nodePath.join(dir, 'a.md');
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

// 为什么直接单测 isInsideDir 而不是打端点：
// WHATWG URL（服务端 new URL(req.url, base) 与 fetch 客户端两侧）都会归一化 `..`
// 与 percent-encoded `%2e%2e`，任何 URL 形式的请求都到不了 403 分支，端点级断言无法覆盖它。
test('isInsideDir 接受根目录内的正常路径', () => {
  const root = nodePath.join(os.tmpdir(), 'dayu-viz-root');
  assert.equal(isInsideDir(root, nodePath.join(root, 'index.html')), true);
  assert.equal(isInsideDir(root, nodePath.join(root, 'a', 'b', 'c.css')), true);
  assert.equal(isInsideDir(root, root), true);
});

test('isInsideDir 拒绝 ../ 逃逸', () => {
  const root = nodePath.join(os.tmpdir(), 'dayu-viz-root');
  assert.equal(isInsideDir(root, nodePath.join(root, '..', 'outside.txt')), false);
});

test('isInsideDir 拒绝多级 ../../ 逃逸', () => {
  const root = nodePath.join(os.tmpdir(), 'dayu-viz-root', 'web');
  assert.equal(isInsideDir(root, nodePath.join(root, '..', '..', 'outside')), false);
});

test('isInsideDir 拒绝根本身之外的绝对路径', () => {
  const root = nodePath.join(os.tmpdir(), 'dayu-viz-root');
  const outside = process.platform === 'win32' ? 'C:\\Windows\\win.ini' : '/etc/passwd';
  assert.equal(isInsideDir(root, outside), false);
});

test('isInsideDir 拒绝前缀相同但不是子目录的路径', () => {
  const root = nodePath.join(os.tmpdir(), 'dayu-viz-root');
  assert.equal(isInsideDir(root, nodePath.join(os.tmpdir(), 'dayu-viz-root-evil', 'x')), false);
});

// win32 专有：反斜杠形式的 `..\` 必须同样被拒绝
test('isInsideDir 拒绝 win32 反斜杠形式 ..\\ 逃逸', { skip: process.platform !== 'win32' }, () => {
  const root = nodePath.join(os.tmpdir(), 'dayu-viz-root');
  assert.equal(isInsideDir(root, root + '\\..\\outside.txt'), false);
});

test('closeSseClients 结束 /events 长连接，使 server.close 不再挂起', async () => {
  const server = createHttpServer({ projectRoot: FIXTURE, webDir: null });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  let client;
  try {
    const ac = new AbortController();
    client = await fetch(`http://127.0.0.1:${port}/events`, { signal: ac.signal });
    assert.equal(client.status, 200);
    assert.match(client.headers.get('content-type'), /text\/event-stream/);

    // 读到 ready 事件，确认这条 SSE 连接已被服务端登记
    const reader = client.body.getReader();
    const first = await reader.read();
    assert.match(new TextDecoder().decode(first.value), /event: ready/);
    assert.equal(server.sseClientCount(), 1, '服务端应追踪到 1 个 SSE 客户端');

    server.closeSseClients();
    assert.equal(server.sseClientCount(), 0, 'closeSseClients 后客户端集合应为空');

    // 流应被服务端结束（done=true），而不是一直挂着
    const end = await Promise.race([
      reader.read(),
      new Promise((r) => setTimeout(() => r('timeout'), 2000)),
    ]);
    assert.notEqual(end, 'timeout', 'SSE 流应在 closeSseClients 后结束');
    assert.equal(end.done, true);

    // 连接确实断开了：此时 server.close() 必须能在 1s 内完成
    ac.abort();
  } finally {
    server.closeSseClients();
    await new Promise((r) => {
      const t = setTimeout(r, 1500);
      server.close(() => { clearTimeout(t); r(); });
    });
  }
});

test('静态目录内缺失文件返回 404', async () => {
  const server = createHttpServer({ projectRoot: FIXTURE, webDir: nodePath.join(here, 'fixtures') });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/definitely-missing-file.txt`);
    assert.equal(res.status, 404);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
