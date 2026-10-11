import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs, startServer } from '../bin/dayu-viz.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, 'fixtures', 'sample-project');
const CLI = path.join(here, '..', 'bin', 'dayu-viz.mjs');

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

test('默认 project 为当前目录，port 为 0（随机）', () => {
  const a = parseArgs([]);
  assert.equal(a.project, process.cwd());
  assert.equal(a.port, 0);
  assert.equal(a.open, false);
});

test('--project / --port / --open 被正确解析', () => {
  const a = parseArgs(['--project', 'D:/x', '--port', '8080', '--open']);
  // brief 原文断言 'D:/x'。path.resolve('D:/x') 在 win32 返回 'D:\x'、在 POSIX 返回绝对化后的路径，
  // 两者都不等于 'D:/x'，故按平台构造期望值；断言语义（--project 被绝对化）不变。
  assert.equal(a.project, path.resolve('D:/x'));
  assert.equal(a.port, 8080);
  assert.equal(a.open, true);
});

test('--help 置位且不报错', () => {
  assert.equal(parseArgs(['--help']).help, true);
});

// 回归目标：过去 --project 指向缺少 docs/ 的目录时，CLI 会照常启动，
// 只在稍后的 /api/model 上以 500 暴露问题；用户看到的是"打不开的看板"而非"路径选错了"。
test('startServer 拒绝缺少 docs/ 的项目根目录，并在报错里点名 docs 与解析后的路径', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dayu-viz-nodocs-'));
  try {
    const expectedDocs = path.resolve(dir, 'docs');
    const err = await startServer({ projectRoot: dir, port: 0, webDir: null }).then(
      () => null,
      (e) => e,
    );
    assert.notEqual(err, null, '缺少 docs/ 时 startServer 必须失败，而不是启动服务');
    assert.match(err.message, /docs/, `报错必须点名 docs，实际：${err.message}`);
    assert.match(err.message, /错误：项目目录缺少 docs\/ 子目录/, `报错必须可操作，实际：${err.message}`);
    assert.equal(
      err.message.includes(expectedDocs),
      true,
      `报错必须给出解析后的绝对路径 ${expectedDocs}，实际：${err.message}`,
    );
    assert.match(err.message, /用法: dayu-viz --project/, `报错必须给出正确用法，实际：${err.message}`);
    // 退出码契约：缺 docs/ 属于用法/前置条件错误，进程应以 2 结束（main() 读取该字段）
    assert.equal(err.exitCode, 2, `缺 docs/ 的退出码应为 2，实际 ${err.exitCode}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('startServer 在合法项目上解析出 http://127.0.0.1:<port>/ 并能干净关闭', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dayu-viz-ok-'));
  const projectRoot = path.join(dir, 'sample-project');
  await fs.cp(FIXTURE, projectRoot, { recursive: true });
  let started = null;
  try {
    started = await startServer({ projectRoot, port: 0, webDir: null });
    assert.match(started.url, /^http:\/\/127\.0\.0\.1:\d+\/$/, `url 形态异常：${started.url}`);
    assert.equal(started.url, `http://127.0.0.1:${started.port}/`, 'url 必须与返回的 port 一致');
    assert.equal(started.port > 0, true, `port 应是被系统分配的真实端口，实际 ${started.port}`);
    assert.equal(started.projectRoot, path.resolve(projectRoot), 'projectRoot 应为解析后的绝对路径');

    // 真的在监听：/api/model 可访问且返回解析后的模型
    const res = await fetch(`${started.url}api/model`);
    assert.equal(res.status, 200, '/api/model 应返回 200');
    assert.equal((await res.json()).status.phase, 2);

    started.watcher.close();
    started.server.closeSseClients?.();
    await closeServer(started.server);
    started = null;
  } finally {
    if (started) {
      started.watcher.close();
      started.server.closeSseClients?.();
      await closeServer(started.server);
    }
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('startServer 在端口被占用时快速失败：点名端口、退出码 2、不抛裸堆栈', async () => {
  // 先用一个 net server 占住随机端口，让 EADDRINUSE 可确定复现（本机 5/5 稳定复现）
  const blocker = net.createServer();
  await new Promise((r) => blocker.listen(0, '127.0.0.1', r));
  const { port } = blocker.address();
  let started = null;
  try {
    const err = await startServer({ projectRoot: FIXTURE, port, webDir: null }).then(
      (s) => { started = s; return null; },
      (e) => e,
    );
    assert.notEqual(err, null, `端口 ${port} 已被占用时 startServer 必须失败，而不是静默换端口或启动`);
    assert.match(err.message, new RegExp(`端口 ${port} 已被占用`), `报错必须点名端口，实际：${err.message}`);
    assert.equal(/^\s+at\s/m.test(err.message), false, `应是可操作报错而不是裸堆栈，实际：${err.message}`);
    assert.equal(err.exitCode, 2, `端口占用的退出码应为 2，实际 ${err.exitCode}`);
  } finally {
    if (started) {
      started.watcher.close();
      started.server.closeSseClients?.();
      await closeServer(started.server);
    }
    await new Promise((r) => blocker.close(r));
  }
});

// 进程级契约：真实 CLI 以退出码 2 结束，并把可操作报错写到 stderr（而不是抛堆栈）。
// 本机已实测 spawnSync 的管道捕获可用（stdio:'pipe' 能拿到子进程输出），故直接断言 stdio；
// spawnSync 带 timeout 兜底：万一校验失效导致 CLI 真的起服务不返回，超时会杀死子进程而不是挂住测试。
test('CLI 进程在 --project 缺 docs/ 时退出码 2，并在 stderr 打印可操作报错', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dayu-viz-cli-'));
  try {
    const r = spawnSync(process.execPath, [CLI, '--project', dir], {
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 15000,
    });

    assert.equal(
      r.error,
      undefined,
      `子进程未能正常结束（${r.error?.code ?? ''} ${r.error?.message ?? ''}）；signal=${r.signal}`,
    );
    assert.equal(r.status, 2, `缺 docs/ 时 CLI 必须以退出码 2 结束，实际 ${r.status}；stderr=${r.stderr}`);

    const stderr = r.stderr ?? '';
    assert.match(stderr, /错误：项目目录缺少 docs\/ 子目录/, `stderr 必须给出可操作报错，实际：${stderr}`);
    assert.equal(
      stderr.includes(path.resolve(dir, 'docs')),
      true,
      `stderr 必须给出解析后的 docs 路径 ${path.resolve(dir, 'docs')}，实际：${stderr}`,
    );
    assert.match(stderr, /用法: dayu-viz --project <含 docs\/ 的 dayu 项目根目录>/, `stderr 必须给出正确用法，实际：${stderr}`);
    assert.equal(/^\s+at\s/m.test(stderr), false, `不应打印堆栈帧，实际：${stderr}`);
    assert.equal((r.stdout ?? '').trim(), '', `校验失败时不应打印启动横幅，实际：${r.stdout}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
