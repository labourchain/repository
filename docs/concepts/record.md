# Record

Record 是 LabourChain 中的通用签名事实容器。它本身不等同于劳动记录；一条 Record 表达什么，由它引用的 Protocol 以及 `Record.data` 决定。

## 定义

Core Record 提供稳定的事实外壳：

```text
Record
├─ protocol / protocolHash
├─ createdBy
├─ createdAt
├─ signature
└─ data
```

其中：

```text
protocol / protocolHash
-> 哪个 Protocol 解释这条事实

createdBy / signature
-> 哪个 Entity 对这条事实负责并签名

data
-> 由对应 Protocol 定义的具体事实内容
```

因此 Protocol 发布、Member declaration、Repo establishment、Repo decision、劳动事实等都可以使用 Record。不能仅因为一个对象是 Record，就推断它描述劳动、由劳动者产生，或属于某个生产关系。

## labourRecord

劳动记录是 Record 所承载的一类特殊领域事实。当前暂称其 `Record.data` 形式为 **labourRecord**。

```text
Record
└─ data = labourRecord
      ↓
   描述一次已经发生的劳动
```

labourRecord 的字段和正式 Protocol namespace 暂不在本概念页中冻结；它应由独立 labour Protocol 定义，并在 Repository 的可视化劳动记录测试之前实现。

一条 labourRecord 可以描述形成、修改或维护 Asset 的劳动，也可以描述没有形成独立 Asset 的劳动，例如会议、沟通、组织、分析或学习。

```text
labour
  ↓
Record<data = labourRecord>

labour
  └── may produce / change / maintain
              ↓
            Asset
```

## 与 Worker / Member 的关系

在人类劳动场景中，Member 承担 Worker 的劳动主体角色，并以自己的 Entity identity 产生或签署承载 labourRecord 的 Record。

劳动历史应由适用 labour Protocol 识别出的 labour Records 重建，而不是把某个 Entity 创建的所有 Records 都解释成劳动。

Record 不需要存放在 Worker 的 `records[]` 字段中，也不依赖某个 Repo 才能成立。

## 与 Asset 的关系

承载 labourRecord 的 Record 可以关联一个或多个 Asset，但这种关联不是 labour Record 存在的前提。没有独立 Asset 产出的劳动仍然可以形成 labourRecord。

Asset 与 labourRecord 之间的形成、修改、使用或维护关系由适用领域 Protocol 定义，不由 Core Record 外壳统一规定。

## 与 Repo 的关系

Repo 不把 Record 作为仓库中的规范存储内容。Repo 的 contribution history 从与 contribution 相关的 labour Records、Asset 和其他协议事实中投影得到。

Repository、Board、Flow 等运行时服务可以缓存或索引相关 Records，用于日常查询和分析。缓存属于可重建投影，不改变 Record 的链上事实地位。

## 活劳动的数字孪生

LabourChain 对活劳动的数字孪生来自 **labourRecord 这一类领域事实**，而不是 Core Record 类型本身。

现有系统普遍能够保存代码、文档、数据等劳动成果。LabourChain 通过 labour Protocol 把劳动过程作为一等事实写入 Record，使劳动者、劳动过程、劳动成果以及相关组织和确证关系能够重新构建。

## 相关条目

- [Worker / Member](./worker.md)
- [Asset](./asset.md)
- [Repo](./repository.md)
- [Project](./project.md)
