#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHttpServer } from '../src/server/server.mjs';
import { createWatcher } from '../src/server/watcher.mjs';

export function parseArgs(argv) {
  const out = { project: process.cwd(), port: 0, open: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--open') out.open = true;
    else if (a === '--project') out.project = path.resolve(argv[++i] ?? '.');
    else if (a === '--port') out.port = Number(argv[++i] ?? 0);
  }
  return out;
}

const USAGE = `用法: dayu-viz [--project <目录>] [--port <端口>] [--open]

  --project <目录>   含 docs/ 的 dayu 项目根目录（默认：当前目录）
  --port <端口>      监听端口（默认 0 = 随机空闲端口）
  --open             启动后用默认浏览器打开
`;

const USAGE_HINT = '用法: dayu-viz --project <含 docs/ 的 dayu 项目根目录>';

// 面向终端用户的致命错误：message 是可直接展示的报错，exitCode 是进程应使用的退出码。
// 不用堆栈：缺 docs/ 和端口占用都是可预期、可操作的失败，堆栈只会淹没行动项。
function fatalError(message, exitCode = 2) {
  const err = new Error(message);
  err.userMessage = message;
  err.exitCode = exitCode;
  return err;
}

/**
 * 完成启动所需的全部接线：校验 → HTTP server → watcher → listen(127.0.0.1)。
 * 抽成导出函数是为了让"实时跟随"这条链路（watcher → broadcastUpdate → SSE）可被自动化测试真实驱动，
 * 而不是只靠手工验证。
 */
export async function startServer({ projectRoot, port = 0, webDir, debounceMs = 300 }) {
  const root = path.resolve(projectRoot);
  const docsDir = path.join(root, 'docs');

  // 先校验再监听：项目缺 docs/ 属于"启动前置条件不满足"，必须在监听之前失败，
  // 否则用户会拿到一个能启动、却在 /api/model 上返回 500 的服务。
  let stat = null;
  try {
    stat = await fs.stat(docsDir);
  } catch {
    stat = null;
  }
  if (!stat?.isDirectory()) {
    throw fatalError(`错误：项目目录缺少 docs/ 子目录：${docsDir}\n${USAGE_HINT}`);
  }

  const server = createHttpServer({ projectRoot: root, webDir });

  const watcher = createWatcher(
    [docsDir],
    () => server.broadcastUpdate?.(),
    { debounceMs },
  );

  try {
    await new Promise((resolve, reject) => {
      const onError = (err) => {
        server.removeListener('listening', onListening);
        reject(err);
      };
      const onListening = () => {
        server.removeListener('error', onError);
        resolve();
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, '127.0.0.1');
    });
  } catch (err) {
    // 监听失败必须回收已建好的资源，绝不留下半启动状态
    watcher.close();
    if (server.listening) server.close(); // 未监听时 close() 会抛 ERR_SERVER_NOT_RUNNING
    if (err?.code === 'EADDRINUSE') {
      throw fatalError(
        `错误：端口 ${port} 已被占用，无法启动服务\n`
        + `提示: 换一个端口（--port <其他端口>），或先关闭占用 ${port} 端口的程序`,
      );
    }
    throw fatalError(`错误：无法监听 127.0.0.1:${port}：${err?.message ?? err}`);
  }

  const { port: actualPort } = server.address();
  const url = `http://127.0.0.1:${actualPort}/`;
  return { server, watcher, port: actualPort, url, projectRoot: root };
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(USAGE);
    return;
  }

  const webDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');

  let started;
  try {
    started = await startServer({ projectRoot: args.project, port: args.port, webDir });
  } catch (err) {
    const code = err?.exitCode ?? 1;
    process.exitCode = code;
    // stderr 在管道下是异步 flush 的：先写出去、待回调确认落地，再按约定退出码结束进程。
    process.stderr.write(`${err?.userMessage ?? err?.stack ?? err}\n`, () => process.exit(code));
    return;
  }

  const { server, watcher, url, projectRoot } = started;
  process.stdout.write(
    [
      'dayu-viz 已启动',
      `项目：${projectRoot}`,
      `地址：${url}`,
      '（地址可整行复制到浏览器；加 --open 可自动打开）',
      '按 Ctrl+C 停止服务',
      '',
    ].join('\n'),
  );

  if (args.open) {
    const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const cmdArgs = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    try { spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true }).unref(); } catch { /* 打开失败不影响服务 */ }
  }

  const shutdown = () => {
    watcher.close();
    // 先断开 SSE 长连接，否则 server.close() 会一直等待浏览器端 /events 连接
    server.closeSseClients?.();
    // 兜底：即使仍有残留 socket，进程也必须在 ~1s 内退出
    const force = setTimeout(() => process.exit(0), 1000);
    force.unref();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((err) => { process.stderr.write(String(err.stack ?? err) + '\n'); process.exit(1); });
}
