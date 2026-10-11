// 实时跟随链路的端到端守护：bin 的接线 → fs.watch → broadcastUpdate → SSE。
//
// 为什么需要这个文件：这条链路此前只有手工验证（写文档 → ~317ms 后收到 update 事件），
// 没有任何自动化断言。它横跨 bin/ 与 src/server/ 两层，两侧各自的单测都过，链路本身却可能是断的。
// 因此这里不走 createHttpServer/createWatcher，而是驱动真实的 startServer 接线。
//
// 红线：只在 os.tmpdir() 下操作 fixture 的临时副本，绝不触碰任何真实项目的文档。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../bin/dayu-viz.mjs';

const here = nodePath.dirname(fileURLToPath(import.meta.url));
const FIXTURE = nodePath.join(here, 'fixtures', 'sample-project');

// 验收口径：单次文档写入后，update 事件必须在 2000ms 内到达。
const UPDATE_DEADLINE_MS = 2000;
// startServer 默认 debounceMs = 300：突发写入的合并窗口要留足余量再计数。
const COALESCE_WINDOW_MS = 1200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 复制 fixture 到 os.tmpdir() 下的临时项目，返回 { dir, projectRoot, cleanup }。
async function makeTempProject() {
  const dir = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'dayu-viz-live-'));
  const projectRoot = nodePath.join(dir, 'sample-project');
  await fs.cp(FIXTURE, projectRoot, { recursive: true });
  return {
    dir,
    projectRoot,
    docsFile: nodePath.join(projectRoot, 'docs', '00-index.md'),
    cleanup: () => fs.rm(dir, { recursive: true, force: true }),
  };
}

// 打开一条 SSE 长连接。必须用 http.request：fetch/undici 会按 body 语义缓冲 event-stream，
// 拿不到"逐条到达"的原始流，就无法对到达时刻计时。
function openSse(port) {
  const events = [];
  const listeners = new Set();
  let buffer = '';
  let req = null;
  let failure = null;

  const notify = () => { for (const fn of [...listeners]) fn(); };

  const ready = new Promise((resolve, reject) => {
    req = http.request(
      { host: '127.0.0.1', port, path: '/events', method: 'GET', agent: false },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`/events 返回 ${res.statusCode}，期望 200`));
          return;
        }
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          buffer += chunk;
          let idx;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const m = /^event:\s*(.+)$/m.exec(frame);
            if (m) {
              events.push({ name: m[1].trim(), at: Date.now() });
              notify();
            }
          }
        });
        resolve(res);
      },
    );
    req.on('error', (err) => { failure = err; reject(err); });
    req.end();
  });

  const countOf = (name) => events.filter((e) => e.name === name).length;

  // 等到 name 事件累计出现 min 次；超时或连接出错则 reject（绝不静默通过）。
  const waitForCount = (name, min, timeoutMs) => new Promise((resolve, reject) => {
    let timer = null;
    const finish = (err) => {
      if (timer) { clearTimeout(timer); timer = null; }
      listeners.delete(onEvent);
      if (err) reject(err); else resolve();
    };
    function onEvent() {
      if (failure) { finish(failure); return; }
      if (countOf(name) >= min) finish(null);
    }
    listeners.add(onEvent);
    if (failure) { finish(failure); return; }
    if (countOf(name) >= min) { finish(null); return; }
    timer = setTimeout(
      () => finish(new Error(`等待 ${name} 事件（>=${min} 个）超时 ${timeoutMs}ms，实际收到 ${countOf(name)} 个`)),
      timeoutMs,
    );
  });

  return {
    ready,
    events,
    countOf,
    waitForCount,
    close() {
      try { req?.destroy(); } catch { /* 已断开 */ }
    },
  };
}

// server.close() 会等待所有连接断开；残留连接时兜底强拆，保证测试进程能退出。
function closeServer(server) {
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      try { server.closeAllConnections?.(); } catch { /* ignore */ }
      resolve();
    }, 1500);
    server.close(() => { clearTimeout(t); resolve(); });
  });
}

// 起一个临时项目 + 真实 startServer + 一条 SSE 连接，交给 body，之后无论如何都清理干净。
async function withLiveProject(body) {
  const project = await makeTempProject();
  let started = null;
  let sse = null;
  try {
    started = await startServer({ projectRoot: project.projectRoot, port: 0, webDir: null });
    sse = openSse(started.port);
    const res = await sse.ready;
    await body({ ...project, started, sse, res });
  } finally {
    sse?.close();
    started?.server.closeSseClients?.();
    started?.watcher.close();
    if (started) await closeServer(started.server);
    await project.cleanup();
  }
}

test('实时跟随：连接即收 ready，文档写入后 2000ms 内收到 update', async () => {
  let measuredLatencyMs = null;

  await withLiveProject(async ({ started, sse, docsFile }) => {
    // 已建立的真实监听地址
    assert.match(started.url, /^http:\/\/127\.0\.0\.1:\d+\/$/, `url 形态异常：${started.url}`);

    // 1) 连接建立即收到 ready
    await sse.waitForCount('ready', 1, 1000);
    assert.equal(sse.countOf('ready'), 1, '连接 /events 时必须收到 ready 事件');
    assert.equal(started.server.sseClientCount(), 1, '服务端应登记这条 SSE 连接');

    // 2) 追加一行 → 计时等 update
    const t0 = Date.now();
    await fs.appendFile(docsFile, `\n- 实时跟随自动化测试写入 ${t0}\n`);
    await sse.waitForCount('update', 1, UPDATE_DEADLINE_MS);
    measuredLatencyMs = Date.now() - t0;

    assert.equal(
      measuredLatencyMs < UPDATE_DEADLINE_MS,
      true,
      `update 必须在 ${UPDATE_DEADLINE_MS}ms 内到达，实测 ${measuredLatencyMs}ms`,
    );
    assert.equal(measuredLatencyMs >= 0, true, `计时异常：${measuredLatencyMs}ms`);

    // 3) 写入的确实是临时副本，不是任何真实项目
    assert.equal(
      docsFile.startsWith(os.tmpdir()),
      true,
      `测试只能写 os.tmpdir() 下的临时项目，实际写入 ${docsFile}`,
    );
  });

  assert.notEqual(measuredLatencyMs, null, '未能测得 update 延迟');
  console.log(`[live-update] 单次追加 → update 实测延迟 ${measuredLatencyMs}ms（上限 ${UPDATE_DEADLINE_MS}ms）`);
});

test('实时跟随：2–3 次快速写入被 300ms 去抖合并（update <= 2 条）', async () => {
  await withLiveProject(async ({ sse, docsFile }) => {
    await sse.waitForCount('ready', 1, 1000);

    // 先做一次写入，避开"watcher 首个事件"与去抖窗口的边界，让计数基线稳定
    await fs.appendFile(docsFile, '\n- 基线写入\n');
    await sse.waitForCount('update', 1, UPDATE_DEADLINE_MS);
    const base = sse.countOf('update');

    // 三次快速写入（总耗时远小于 300ms 去抖窗口）
    await fs.appendFile(docsFile, '- 合并写入 1\n');
    await fs.appendFile(docsFile, '- 合并写入 2\n');
    await fs.appendFile(docsFile, '- 合并写入 3\n');

    await sleep(COALESCE_WINDOW_MS);
    const burst = sse.countOf('update') - base;

    assert.equal(burst >= 1, true, `3 次快速写入至少应产生 1 条 update，实际 ${burst} 条`);
    assert.equal(
      burst <= 2,
      true,
      `300ms 去抖应把 3 次快速写入合并为 <=2 条 update，实际 ${burst} 条`,
    );
    console.log(`[live-update] 3 次快速写入 → ${burst} 条 update（去抖 ${COALESCE_WINDOW_MS}ms 窗口内）`);
  });
});

test('实时跟随：关闭后不再监听端口（不留下 socket）', async () => {
  const project = await makeTempProject();
  const started = await startServer({ projectRoot: project.projectRoot, port: 0, webDir: null });
  const { port } = started;
  let closed = false;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/model`);
    assert.equal(res.status, 200, '关闭前服务应可访问');

    started.watcher.close();
    started.server.closeSseClients?.();
    await closeServer(started.server);
    closed = true;

    let refused = false;
    try {
      await fetch(`http://127.0.0.1:${port}/api/model`);
    } catch {
      refused = true;
    }
    assert.equal(refused, true, `关闭后端口 ${port} 不应再接受连接`);
  } finally {
    if (!closed) {
      started.watcher.close();
      started.server.closeSseClients?.();
      await closeServer(started.server);
    }
    await project.cleanup();
  }
});
