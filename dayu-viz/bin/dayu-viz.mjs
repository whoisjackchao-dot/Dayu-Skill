#!/usr/bin/env node
import path from 'node:path';
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

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(USAGE);
    return;
  }

  const webDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
  const server = createHttpServer({ projectRoot: args.project, webDir });

  const watcher = createWatcher(
    [path.join(args.project, 'docs')],
    () => server.broadcastUpdate?.(),
    { debounceMs: 300 },
  );

  await new Promise((r) => server.listen(args.port, '127.0.0.1', r));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/`;
  process.stdout.write(`dayu-viz 已启动：${url}\n项目：${args.project}\n按 Ctrl+C 退出\n`);

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
