---
description: 加载 dayu-ultra skill：先跑依赖 preflight，再按编排推进项目
---

先调用 skill 工具加载 skill `dayu-ultra`，然后严格按它的要求工作。

**第一步是 preflight，不要跳过：**

```bash
bash ~/.config/opencode/skills/dayu-ultra/tools/preflight.sh --install
```

缺什么装什么；装不上就按 `references/preflight.md` §5 显式降级，并在项目索引的
「已知不可信」里写明本次哪几项不可用。**不得声称加载了实际未加载的技能。**

之后：

- 确认本会话**没有**同时加载 `dayu` —— 两者互斥，ultra 是超集
- 按编排表委派协作技能；每次委派写清 目标 / 输入 / 期望产物 / 边界 / 回写
- 未批准的取值一律登记为待决，**不得当事实使用**
- 收工前把决策、缺口、证据、状态写回文档

用户的任务 / 问题：

$ARGUMENTS
