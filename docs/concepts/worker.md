# Worker / Member

Worker 是 LabourChain 中的劳动者，也是劳动主体。当前概念模型中，只有 Worker 能够产生 Record 和 Asset。

## 定义

Worker 表示承担劳动行为并与劳动记录、劳动成果建立生产关系的主体。Repo、Project、Runtime、AI 和 Agent 可以参与劳动的组织、辅助、执行、存储或分析，但不因此成为 Worker。

Member 是从 Repo 关系中观察 Worker 时使用的称呼。一个 Worker 成为某个 Repo 的 Member，表示该劳动者被允许向该 Repo contribution。Member 不构成另一种劳动主体类型。

## 与 Record 的关系

Record 记录 Worker 已经发生的劳动。劳动者的 labour history 由链上与该 Worker 相关的 Records 构成，不依赖某个 Repo 内部保存一份个人记录集合。

Worker 可以产生不对应新 Asset 的 Record，例如会议、沟通、组织、学习或检查等劳动记录。

## 与 Asset 的关系

Asset 是劳动对象化后形成的成果。Asset 的形成、修改或维护应能够回到 Worker 的劳动过程。

Worker 可以把 Asset 保存在 Personal Repo，也可以在成为其他 Repo 的 Member 后向这些 Repo contribution。

## 劳动主体边界

当前模型不把组织实体或技术系统直接建模为劳动主体。若以后需要承认新的劳动主体类型，应修改概念模型，而不是通过工程类型定义扩大 `Worker` 的含义。

## 相关条目

- [Record](./record.md)
- [Asset](./asset.md)
- [Repo](./repository.md)
- [Project](./project.md)