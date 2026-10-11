import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { parseArgs } from '../bin/dayu-viz.mjs';

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
