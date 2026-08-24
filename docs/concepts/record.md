# Record

Record 是 LabourChain 中的劳动记录，也是活劳动的数字记录。它描述 Worker 已经发生的劳动，并作为链上的规范事实存在。

## 定义

Record 记录劳动过程，而不是劳动完成后留下的成果。它可以描述一次形成 Asset 的劳动，也可以描述修改、维护、会议、沟通、组织、学习或其他没有形成独立新 Asset 的劳动。

LabourChain 因此同时记录劳动过程和劳动成果。Record 对应活劳动，Asset 对应对象化后的劳动成果。

```text
labour
  ↓
Record

labour
  └── may produce / change / maintain
              ↓
            Asset
```

## 与 Worker 的关系

Record 由 Worker 产生。Worker 的 labour history 可以从链上与该劳动者相关的 Records 重新构建。

Record 不需要存放在 Worker 的 `records[]` 字段中，也不依赖某个 Repo 才能成立。

## 与 Asset 的关系

Record 可以关联一个或多个 Asset，但这种关联不是 Record 存在的前提。没有独立 Asset 产出的劳动仍然可以形成 Record。

当 Worker 向 Repo contribution 一个 Asset 时，与这次劳动有关的 Record 可以同时参与该 contribution，并由 Repo 对相关劳动关系进行确证。

## 与 Repo 的关系

Repo 不把 Record 作为仓库中的规范存储内容。Repo 的 contribution history 来自链上与该 Repo 相关的 Records。

Repository、Board、Flow 等运行时服务可以缓存或索引这些 Records，用于日常查询和分析。缓存属于可重建投影，不改变 Record 的链上事实地位。

## 活劳动的数字孪生

现有系统普遍能够保存代码、文档、数据等劳动成果。LabourChain 在记录这些成果之外，还把劳动过程本身作为一等链上事实，使劳动者、劳动过程、劳动成果以及相关组织和确证关系能够重新构建。

这一部分构成 LabourChain 对活劳动的数字孪生。

## 相关条目

- [Worker / Member](./worker.md)
- [Asset](./asset.md)
- [Repo](./repository.md)
- [Project](./project.md)