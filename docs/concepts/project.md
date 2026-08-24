# Project

Project 是 LabourChain 中对劳动者、活劳动和死劳动进行组织的一种形式。它围绕某个目标组织 Workers、Records 和 Assets，但不取代这些对象原有的身份、归属和存储关系。

## 定义

Project 关注劳动如何被组织，而不是资料存放在哪里。一个 Project 可以关联参与劳动的 Workers、已经发生的 Records 和被使用或形成的 Assets。

```text
Project
├── Workers
├── Records
└── Assets
```

这里表示的是组织关系，不要求 Project 实体内部维护三个规范数组。

## 与 Repo 的区别

Repo 是仓库，以 Asset 存放、contribution 和相关劳动确证为中心。Project 以劳动目标和劳动过程的组织为中心。

| | Repo | Project |
| --- | --- | --- |
| 主要对象 | Asset | Worker、Record、Asset |
| 主要作用 | 存放劳动成果，接收 contribution | 组织劳动过程 |
| Record 关系 | contribution history 的来源 | 项目劳动的组成部分 |
| Asset 来源 | Repo 自身保存 | 可以来自多个 Repo 或授权来源 |

Project 不是 Repo 的目录，也不要求限制在一个 Repo 内。

## 资料来源

Project 可以使用单个或多个 Repo 中的 Assets，也可以读取劳动者授权的 Personal Repo Assets，以及链上已有的 Records。

Project 对资料的组织不表示取得资料所有权，也不要求把所有内容复制进 Project 专属仓库。

## Project 中的劳动

Project 可以围绕已有 Workers、Records 和 Assets 组织新的劳动：

```text
existing Workers + Records + Assets
              ↓
            Project
              ↓
       new labour activity
              ↓
            Records
              ↓
       new / changed Assets
```

规划、分析、会议和回顾本身也可以形成 Record。它们不需要另设 Summary 实体。

## 产品投影

Board 可以在 Project 基础上提供规划、分析、回顾和展示能力。这些功能属于产品投影，不改变 Project 对 Worker、Record 和 Asset 的基本组织关系。

## 相关条目

- [Worker / Member](./worker.md)
- [Record](./record.md)
- [Asset](./asset.md)
- [Repo](./repository.md)
- [访问、授权与使用](./access-and-use.md)