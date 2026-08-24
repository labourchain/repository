# Repository requirements

Repository 是 LabourChain 中用于保存 Asset 的仓库能力。本页定义 Repository MVP 的产品要求，是当前 Repository 产品行为的事实来源。

相关领域概念见 [`concepts/`](./concepts/)。其中 [Repo](./concepts/repository.md)、[Worker / Member](./concepts/worker.md)、[Record](./concepts/record.md) 和 [Asset](./concepts/asset.md) 定义本页使用的术语。

## 范围

Repository MVP 覆盖 Repo 的建立和加载、成员关系、Asset contribution、仓库侧劳动确证、Asset 持久保存和读取，以及 Repo contribution history。

Record 是链上的劳动事实，不作为 Repo 中与 Asset 并列的规范存储内容。Repository 可以维护与自身 contribution 有关的 Record 投影，用于日常查询和分析。

## Repo 建立与身份

任何 Worker 都可以建立 Repo。每个 Repo 具有稳定身份，客户端能够在之后重新加载同一个 Repo，并与其他 Repo 区分。

每个 Repo 有一个 operator。operator 负责维护能够向该 Repo contribution 的 Workers。MVP 不要求更复杂的角色体系。

## Personal Repo

每个 Worker 默认具有一个 Personal Repo，用于保存尚未进入其他 Repo 的私人 Assets。

Personal Repo 使用与其他 Repo 相同的基本仓库模型，但当前默认保持私人状态。它保存 Assets，不维护独立的个人 Record 仓库。Worker 的 labour history 仍由链上的 Records 构成。

## 成员关系

Repo 维护允许向其 contribution 的 Workers。operator 能够添加和移除成员、检查某个 Worker 是否为成员，并查看当前成员。

成员关系只决定某个 Worker 是否可以向该 Repo contribution。它不限制 Worker 在 Repo 之外产生 Record 或 Asset。

## Asset contribution

Worker 向 Repo contribution 的对象是 Asset。一次 contribution 同时关联描述相关劳动的 Record。

贡献者必须已经是该 Repo 的成员。成功的 contribution 需要满足以下产品行为：

- 能够识别贡献者及其 Repo 成员关系；
- Asset、相关 Record 和 contribution 关系符合对应的 LabourChain 协议；
- Repo 接受并保存 Asset，且不改变其协议含义；
- Repo 对相关劳动形成仓库侧确证；
- 该 contribution 能够在之后从 Repo contribution history 中看到。

失败的 contribution 不得表现为已经被 Repo 接受。

Repo contribution 只描述包含 Asset 提交的劳动。没有形成或提交 Asset 的劳动仍然可以产生 Record。

## 持久保存

Repo 身份、operator、成员关系和已接受的 Assets 属于需要长期保留的 Repository 状态。普通应用重启不得导致这些状态消失。

Record 的规范事实保留在链上。Repository 可以保存本地 Record projection，以免日常查询每次都重新构建完整 contribution history。该 projection 属于可重建数据，不成为 Record 的事实来源。

Asset 或 Record 的修订和版本关系由对应协议定义。Repository 不为存储或展示方便而静默改写已经接受的事实。

## Asset 读取与浏览

消费者能够通过稳定的 LabourChain 身份或引用读取 Repo 中已经接受的 Asset，并能够区分 Asset 存在与不存在的情况。

MVP 需要能够查看 Repo 当前的成员和 Assets。高级搜索、分页和索引不是当前产品要求，直到出现实际消费者或规模需求。

## Contribution history

消费者能够查看与 Repo 有关的劳动历史，包括 Repo 接受和确证过的 contribution。

Contribution history 来自与 Repo contribution 相关的链上 Records，而不是 Repo 自有的 `records[]` 集合。日常读取不应要求每次重新扫描完整链数据，运行时可以使用缓存或索引提供该视图。

## 协议有效性

Repository 只接受符合 LabourChain 协议的 contribution。Asset、相关 Record 以及 contribution 所需关系均受对应协议约束。

Repository 不定义另一套 Asset、Record、身份或确证语义。

## MVP 之外

当前 Repository MVP 不要求实现公开或公共 Asset 的使用核算、收益分配、通用 Private Repo、零知识证明，也不承担 Project 或 Board 的规划、分析和展示能力。

这些概念可以继续保留在 [`concepts/`](./concepts/) 中，在进入具体产品范围时再加入相应 requirements。