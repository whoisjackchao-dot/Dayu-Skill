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
      const rootAbs = path.resolve(webDir);
      if (!path.resolve(abs).startsWith(rootAbs + path.sep) && path.resolve(abs) !== rootAbs) {
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

  return server;
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}
