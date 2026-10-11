import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadProject } from './project.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

export function createHttpServer({ projectRoot, webDir }) {
  const clients = new Set();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);

    try {
      if (pathname === '/api/model') {
        const model = await loadProject(projectRoot);
        return sendJson(res, 200, model);
      }

      if (pathname === '/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write('event: ready\ndata: {}\n\n');
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }

      if (!webDir) return sendJson(res, 404, { error: 'not found' });

      const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const abs = path.join(webDir, rel);
      if (!isInsideDir(webDir, abs)) {
        return sendJson(res, 403, { error: 'forbidden' });
      }
      const data = await fs.readFile(abs);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(abs)] ?? 'application/octet-stream' });
      return res.end(data);
    } catch (err) {
      if (err.code === 'ENOENT') return sendJson(res, 404, { error: 'not found' });
      return sendJson(res, 500, { error: String(err.message ?? err) });
    }
  });

  // 供 watcher 调用：向所有 SSE 客户端广播
  server.broadcastUpdate = () => {
    for (const res of clients) {
      try { res.write('event: update\ndata: {}\n\n'); } catch { clients.delete(res); }
    }
  };

  // 供退出流程调用：主动结束所有 SSE 长连接。
  // server.close() 会等待所有连接断开，而 /events 常驻不关，必须先断开 SSE 客户端。
  server.closeSseClients = () => {
    for (const res of clients) {
      try { res.end(); } catch { /* 客户端已断开 */ }
    }
    clients.clear();
  };

  // 测试/调用方可观测的连接数（不暴露内部 Set 本体）
  server.sseClientCount = () => clients.size;

  return server;
}

// 纯函数：判断 targetPath 是否位于 rootDir 之内（含 root 本身）。
// 显式导出以便直接单测——URL 解析会归一化 `..`，请求路径永远走不到拒绝分支。
export function isInsideDir(rootDir, targetPath) {
  const root = path.resolve(rootDir);
  const target = path.resolve(targetPath);
  return target === root || target.startsWith(root + path.sep);
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}
