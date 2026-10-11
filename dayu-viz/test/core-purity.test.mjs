// 架构不变量守护：src/core/** 必须保持纯净——零 node:* IO、无时钟、无进程耦合。
// 这是全项目最吃重的一条架构规则：core 的输出必须只由输入决定，时间由调用方注入。
// 本文件自身位于 test/，可以自由使用 node:fs；受约束的是被测的 src/core。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

const here = nodePath.dirname(fileURLToPath(import.meta.url));
const CORE_DIR = nodePath.join(here, '..', 'src', 'core');

// 递归收集 src/core 下的每一个文件
function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = nodePath.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(abs));
    else if (entry.isFile()) out.push(abs);
  }
  return out.sort();
}

const CORE_FILES = fs.existsSync(CORE_DIR) ? listFiles(CORE_DIR) : [];
const CORE_MJS = CORE_FILES.filter((f) => f.endsWith('.mjs'));

// 在整份源码上做全局匹配再换算行号：跨行 import 也不会漏。
function scan(re) {
  const hits = [];
  for (const file of CORE_FILES) {
    const src = fs.readFileSync(file, 'utf8');
    const lines = src.split('\n');
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      const line = src.slice(0, m.index).split('\n').length;
      hits.push({
        file: nodePath.relative(CORE_DIR, file),
        line,
        text: lines[line - 1].trim(),
      });
      if (m.index === re.lastIndex) re.lastIndex++; // 零宽匹配保护，避免死循环
    }
  }
  return hits;
}

function describeHits(hits) {
  return hits.map((h) => `${h.file}:${h.line} → ${h.text}`).join('\n');
}

test('src/core 下确实存在 .mjs 文件（纯净性守护不得在空目录上空转通过）', () => {
  assert.equal(
    CORE_MJS.length >= 1,
    true,
    `未在 ${CORE_DIR} 找到任何 .mjs 文件，纯净性守护会空转通过`,
  );
});

test('src/core 不得导入任何 node: 内建模块', () => {
  const hits = scan(/\b(?:from|import|require)\s*\(?\s*['"]node:[^'"]+['"]/g);
  assert.equal(
    hits.length,
    0,
    `core 层出现 node: 导入（违反零 IO 不变量）：\n${describeHits(hits)}`,
  );
});

test('src/core 不得读取时钟（Date.now( / new Date(）', () => {
  const hits = scan(/\bDate\.now\s*\(|\bnew\s+Date\s*\(/g);
  assert.equal(
    hits.length,
    0,
    `core 层出现时钟调用（时间必须由调用方注入，如 parsedAt）：\n${describeHits(hits)}`,
  );
});

test('src/core 不得引用 process', () => {
  const hits = scan(/\bprocess\s*\./g);
  assert.equal(
    hits.length,
    0,
    `core 层引用 process（环境/进程耦合）：\n${describeHits(hits)}`,
  );
});
