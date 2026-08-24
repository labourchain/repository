# Asset

Asset 是 LabourChain 中的劳动成果，也就是已经对象化的劳动。它表示劳动形成、修改或维护后的成果及其链上表示。

## 定义

代码、文档、数据、模型、设计、构建产物，以及现实劳动成果的数字表示，都可以成为 Asset。Asset 与 Record 都是链上的规范对象，但二者记录的对象不同：

```text
Record = 活劳动
Asset  = 对象化后的劳动成果 / 死劳动
```

## 与 Worker 的关系

Asset 的形成、修改或维护应能够回到 Worker 的劳动过程。相关劳动可以由一个或多个 Records 描述。

Worker 默认通过 Personal Repo 管理尚未进入其他 Repo 的私人 Assets，也可以向自己所属的 Repo contribution Assets。

## 与 Record 的关系

Asset 可以与描述其形成、修改或维护过程的 Records 建立关系。一个 Asset 在后续劳动中继续被使用或改变时，可以与新的 Records 产生关系。

并非所有 Record 都需要对应 Asset。Record 描述劳动，Asset 描述劳动成果。

## 与 Repo 的关系

Repo 以 Asset 为存放对象。Worker 向 Repo contribution Asset 时，Repo 接收和保存 Asset，并参与对相关劳动记录的确证。

Repo 对相关 Record 的确证不会改变 Asset 的生产关系，也不会把 Record 变成 Repo 内部的规范存储对象。

## Asset 的边界

Asset 不是任意可保存数据的同义词。Runtime cache、临时 API response、LLM context 等内容不会因为技术上可以存储就自动成为 Asset。数据需要进入 LabourChain 的劳动成果关系，才具有 Asset 的领域含义。

## 相关条目

- [Worker / Member](./worker.md)
- [Record](./record.md)
- [Repo](./repository.md)
- [Project](./project.md)
- [访问、授权与使用](./access-and-use.md)