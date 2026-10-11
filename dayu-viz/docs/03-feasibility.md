# dayu-viz：可行性核查与证据记录

> 日期：2026-10-11
> **结论范围：文档／源码／本机隔离验证，不是端到端验收。**

## 1. 证据分级

| 标记 | 含义 |
| --- | --- |
| 实测 | 本次实际运行命令所得 |
| 官方文档 | 上游明确声明 |
| 未验证 | 尚需验证 |

## 2. 环境基线

| 类别 | 记录内容 |
| --- | --- |
| 系统 | Windows；工作区 D:\DSH |
| 文件系统 | D: 为 exFAT（实测 Get-Volume）；不支持硬链接与 junction（实测） |
| Node | v24.16.0（实测 node --version），含 zlib.zstdDecompressSync |
| 包管理 | npm 11.13.0；registry 经代理 198.18.0.101 可达（实测 npm view vite → 8.3.4） |
| Git | 2.54.0；github.com 可达（实测 git ls-remote） |
| 本次边界 | 未在任何非 Windows 平台验证；未验证多用户并发 |

## 3. 隔离实验

| ID | 操作 | 观察 | 可得结论 |
| --- | --- | --- | --- |
| E01 | 在 D: 用硬链接原子写创建文件 | EISDIR: illegal operation on a directory, link | 不能宣称 D: 支持硬链接原子写 |
| E02 | 在 D: 创建目录 junction | 函数不正确 | exFAT 不支持 junction |
| E03 | 在 D: 原地修改同一文件 | 成功 | 原地编辑在 D: 可用 |

## 4. 已知缺口

| ID | 缺口 | 需要的证据 | 当前处理 |
| --- | --- | --- | --- |
| B01 | 真实文档格式漂移导致解析降级 | 在 ≥3 个不同作者风格的项目上跑解析器 | 现阶段按 §7 韧性规则处理；降级为 unknown 并记 warning |
| B02 | 多平台行为（macOS/Linux） | 在非 Windows 平台运行 | 不提供跨平台承诺 |
