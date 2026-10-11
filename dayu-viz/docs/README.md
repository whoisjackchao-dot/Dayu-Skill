# 模板集

把本目录整体复制到新项目的 `docs/` 下，然后**按编号顺序填**。不要一次填完——每个文件在它所属阶段才填。

```
docs/
├── 00-index.md           ← 任何会话的第一个入口，必须保持一屏
├── 01-decisions.md       ← 决策登记（全程维护）
├── 02-requirements.md    ← 阶段 1
├── 03-feasibility.md     ← 阶段 0
├── 04-adr.md             ← 阶段 2 起，一事一档
├── contracts/
│   ├── README.md         ← 冻结时间表
│   └── M1-<名称>.md      ← 阶段 2 起逐个里程碑
├── 05-plan.md            ← 阶段 2
├── 06-test-matrix.md     ← 阶段 4
├── 07-evidence-log.md    ← 阶段 3 起持续追加
├── 08-readiness.md       ← 阶段 2 末
├── 09-acceptance.md      ← 阶段 5
└── 10-delivery.md        ← 阶段 6
```

## 填写顺序

| 顺序 | 文件 | 出口条件 |
| --- | --- | --- |
| 1 | `03-feasibility.md` | 每条结论有证据等级；缺口台账已建立 |
| 2 | `02-requirements.md` | 每条需求可被单独引用；门槛可判定 |
| 3 | `01-decisions.md` | 未决项都写明"卡在谁那里、最迟何时" |
| 4 | `05-plan.md` | 首个故事 DoR 七条满足 |
| 5 | `contracts/` | 首个节点所需契约已冻结 |
| 6 | `06-test-matrix.md` | 每条需求至少一条用例 |
| 7 | `07-evidence-log.md` | 随开发持续追加 |
| 8 | `08-readiness.md` | 进入编码前 |
| 9 | `09-acceptance.md` | 每条门槛有记录 |
| 10 | `10-delivery.md` | DoD 自检全绿 |

## 三条使用纪律

1. **`00-index.md` 超过一屏就失效**——它是指针，不是内容。
2. **未批准的内容一律带"（拟定）"**，不要为每条加状态列。
3. **`TBD` 是合法值，编造不是。** 填不出来就留空并登记到决策表或缺口台账。
