# LabourChain concepts

`docs/concepts/` 记录 LabourChain 使用的基础概念和术语。这里描述对象是什么、对象之间有什么关系，以及哪些性质属于领域模型本身。

概念文档不定义具体版本的产品功能，也不规定工程实现。Repository 的产品要求见 [`../requirements.md`](../requirements.md)。工程实现以相应 Spec 为准。

## 核心概念

| 条目 | 中文 | 定义 |
| --- | --- | --- |
| [Worker / Member](./worker.md) | 劳动者 / 劳动主体 | 能够产生劳动记录和劳动成果的劳动主体 |
| [Record](./record.md) | 劳动记录 / 活劳动 | 对劳动过程的链上事实记录 |
| [Asset](./asset.md) | 劳动成果 / 死劳动 | 劳动对象化后形成的成果及其链上表示 |
| [Repo](./repository.md) | 仓库 | 存放劳动成果，并在 contribution 中参与相关劳动的确证 |
| [Project](./project.md) | 项目 | 对劳动者、活劳动和死劳动的组织形式 |

## 关系条目

[`access-and-use.md`](./access-and-use.md) 说明 Asset 的私人、公开、公共状态，以及授权和使用关系。

## 基本关系

```text
Worker
  ├── produces Record
  └── produces / changes Asset

Repo
  ├── stores Asset
  └── confirms labour related to accepted contributions

Project
  └── organizes Workers + Records + Assets
```

Record 和 Asset 都是链上的规范对象。Repo 以 Asset 为存放对象，与 Repo 有关的 Record 通过链上关系形成 contribution history。Project 组织这些对象，但不取代它们原有的归属和存储关系。

## 文档约定

每个核心概念单独成页。条目通常按定义、关系、性质和相关条目组织。只有紧密依赖彼此才能解释的关系，才放在同一篇文档中。

概念发生变化时，应检查依赖它的 requirements 和 specs。产品需求与概念模型不一致时，先处理两者的差异，再修改实现。