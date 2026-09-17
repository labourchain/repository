# Member / Worker

Member 是 LabourChain 中对人类参与者的协议与实现层描述。Member 不建立新的身份系统；它以 Core `EntityPublicKey` 为唯一身份锚点，通过适用协议组合获得人类参与者的领域语义。

`Worker` 保留为概念层的“劳动主体”描述，用于讨论谁实施了劳动、谁产生了 Record 或 Asset。由于 worker 在计算机系统中也广泛表示从机、子进程和运行时 worker，程序接口和协议中使用 `Member` 指代人类成员，避免混淆。

## 协议组合

一个 Member 首先具有 Core Entity identity：

```text
core.entity / EntityPublicKey
    ↓
Member
    ├─ member protocol
    ├─ member.profile
    └─ other protocols...
```

`member` 协议用于表达该 Entity identity 作为人类 Member 参与 LabourChain。`member.profile` 与 identity 分离，用于姓名、avatar 等可读资料；profile 的变化不会产生第二个 Member identity。

Member 可以继续组合其他协议，而不要求把全部能力固定进一个 Member object schema。

## 与 Record / Asset 的关系

在人类劳动场景中，Member 承担 Worker 的劳动主体角色，并以自己的 Entity identity 产生或签署相应的劳动事实。劳动历史来自与该 identity 相关的 Records，不依赖某个 Repo 内部保存一份个人 `records[]`。

劳动可以形成、修改或维护 Asset，也可以只形成 Record 而没有独立 Asset。

## 与 Repo 的关系

Member 可以 establishment 一个新的 Repo identity，也可以在**同一个 Entity identity / keypair** 上组合 Repo 协议能力：

```text
Entity K
├─ member.*
└─ repo.*
```

同 identity 的 Repo 能力可暂时承载尚未进入集体 Repo 的 Record / Asset 关系与成果。这种承载关系不等于私人财产关系；Asset 与某个 Member-scoped Repo 关联或存放其中，不自动产生所有权、排他权、转让权或收益权。

一个 Member 加入其他 Repo 时，Repo membership 是 Member 与 Repo 之间的关系，不会创建另一种人类主体类型，也不会改变 Member 的 Entity identity。

## 劳动主体边界

当前人类劳动主体通过 Member 协议表达。Repo、Project、Runtime、AI 和 Agent 可以参与组织、辅助、执行、存储或分析，但不能因为工程上的 `worker`、process 或 agent 概念而被自动视为人类 Member。

若未来需要承认其他劳动主体类型，应在概念和协议层明确扩展，而不是扩大 `Member` 的含义。

## 相关条目

- [Record](./record.md)
- [Asset](./asset.md)
- [Repo](./repository.md)
- [Project](./project.md)