import { renderOverview } from './views/overview.mjs';

const app = document.getElementById('app');
const conn = document.getElementById('conn');

export async function fetchModel(base = '') {
  const res = await fetch(`${base}/api/model`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function subscribe(base, onUpdate) {
  const es = new EventSource(`${base}/events`);
  es.addEventListener('update', () => onUpdate());
  es.addEventListener('open', () => { conn.textContent = '实时跟随中'; });
  es.addEventListener('error', () => { conn.textContent = '连接断开，重试中…'; });
  return es;
}

async function refresh() {
  try {
    const model = await fetchModel();
    app.innerHTML = renderOverview(model);
  } catch (err) {
    app.innerHTML = `<p class="error">加载失败：${String(err.message ?? err)}</p>`;
  }
}

await refresh();
subscribe('', refresh);
