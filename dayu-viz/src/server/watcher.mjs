import fs from 'node:fs';

/** 递归监听多个目录，去抖后回调一次。返回 { close() }。 */
export function createWatcher(paths, onChange, { debounceMs = 300 } = {}) {
  const watchers = [];
  let timer = null;

  const fire = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      try { onChange(); } catch { /* 回调异常不得杀死监听 */ }
    }, debounceMs);
  };

  for (const p of paths ?? []) {
    try {
      const w = fs.watch(p, { recursive: true }, fire);
      w.on('error', () => { /* 监听失败降级为手动刷新，不抛错 */ });
      watchers.push(w);
    } catch {
      // 目录不存在或平台不支持递归监听：降级，不抛错
    }
  }

  return {
    close() {
      if (timer) clearTimeout(timer);
      timer = null;
      for (const w of watchers) { try { w.close(); } catch { /* ignore */ } }
      watchers.length = 0;
    },
  };
}
