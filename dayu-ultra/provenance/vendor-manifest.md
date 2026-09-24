# Vendor 清单

本目录的参考文件来源于 `dayu` 技能。记录来源 md5，用于探测两份副本的漂移。
校验：`bash tools/preflight.sh --check-vendor`

## ultra 自有文件（非 vendor）

| 文件 | 说明 |
| --- | --- |
| `references/preflight.md` | 依赖检测、安装命令、降级策略 |
| `references/orchestration.md` | 委派协议、交接块、反模式 |
| `tools/preflight.sh` | 上述检测的可执行实现 |
| `provenance/dependency-matrix.md` | 四个依赖的实测证据 |
| `README.md` / `SKILL.md` | ultra 自有的入口与说明 |

## vendor 自 dayu 的文件

| 文件 | 来源 | 来源 md5 |
| --- | --- | --- |
| `references/00-context-protocol.md` | `dayu/references/00-context-protocol.md` | `df20769a8b04` |
| `references/01-requirements.md` | `dayu/references/01-requirements.md` | `475b3e26846d` |
| `references/02-planning.md` | `dayu/references/02-planning.md` | `01c4e1d544db` |
| `references/03-development.md` | `dayu/references/03-development.md` | `6a80ed8c87ed` |
| `references/04-testing.md` | `dayu/references/04-testing.md` | `4e9b48fe6166` |
| `references/05-acceptance.md` | `dayu/references/05-acceptance.md` | `2c82634a6f08` |
| `references/06-delivery.md` | `dayu/references/06-delivery.md` | `8c7c082e8a3c` |
| `references/decisions.md` | `dayu/references/decisions.md` | `73b0ba928d74` |
| `references/evidence.md` | `dayu/references/evidence.md` | `97592ba394d5` |
| `references/ids.md` | `dayu/references/ids.md` | `6bec4e465cd5` |
| `references/templates/00-index.md` | `dayu/references/templates/00-index.md` | `b66e438610ee` |
| `references/templates/01-decisions.md` | `dayu/references/templates/01-decisions.md` | `c7bbba100e6f` |
| `references/templates/02-requirements.md` | `dayu/references/templates/02-requirements.md` | `665300679e9e` |
| `references/templates/03-feasibility.md` | `dayu/references/templates/03-feasibility.md` | `8873c46cafc6` |
| `references/templates/04-adr.md` | `dayu/references/templates/04-adr.md` | `81aa6acc6286` |
| `references/templates/05-plan.md` | `dayu/references/templates/05-plan.md` | `a44775b12200` |
| `references/templates/06-test-matrix.md` | `dayu/references/templates/06-test-matrix.md` | `ed0cf7d7142c` |
| `references/templates/07-evidence-log.md` | `dayu/references/templates/07-evidence-log.md` | `e58dfa76b0ea` |
| `references/templates/08-readiness.md` | `dayu/references/templates/08-readiness.md` | `3ae2d67aae0e` |
| `references/templates/09-acceptance.md` | `dayu/references/templates/09-acceptance.md` | `688383917dd5` |
| `references/templates/10-delivery.md` | `dayu/references/templates/10-delivery.md` | `c4c037050387` |
| `references/templates/README.md` | `dayu/references/templates/README.md` | `624b2f9cd6ed` |
| `references/templates/contracts/M1-契约冻结模板.md` | `dayu/references/templates/contracts/M1-契约冻结模板.md` | `1b477675b99c` |
| `references/templates/contracts/README.md` | `dayu/references/templates/contracts/README.md` | `1c4f5c3d1e6b` |

## 有意的偏离

| 文件 | 偏离 | 理由 |
| --- | --- | --- |
| `references/templates/contracts/README.md` | 原文中的 `dayu/references/decisions.md` 改为 `dayu-ultra/references/decisions.md` | ultra 必须自包含；若仍指向 dayu，未装 dayu 时会误导读者去读不存在的文件 |

来源技能 `dayu` 的 SKILL.md md5：`3d47b037a464`
