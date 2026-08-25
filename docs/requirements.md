# Repository 产品要求

Repository 是 LabourChain 中用于管理劳动成果（Asset）的仓库能力。本页定义 Repository MVP 的产品要求，是当前 Repository 产品行为的事实来源。

本文使用的领域概念定义在 [`concepts/`](./concepts/) 中。相关条目包括 [Repo](./concepts/repository.md)、[Worker / Member](./concepts/worker.md)、[Record](./concepts/record.md) 和 [Asset](./concepts/asset.md)。

## 范围

Repository MVP 包括 Repo 的建立与加载、成员关系、Asset contribution、Repo 侧劳动确证、Asset 的持久保存与读取，以及 Repo contribution history。

Record 是链上的劳动事实，不与 Asset 一样作为 Repository 的规范内容保存。Repository 可以为日常查询和分析保留与自身 contribution 相关的 Record 投影。

## Repo 建立与身份

任何 Worker 都可以建立 Repo。每个 Repo 都有稳定身份，使客户端能够再次加载同一个 Repo，并与其他 Repo 区分。

每个 Repo 有一个 operator，负责维护允许向该 Repo contribution 的 Worker。MVP 不引入更复杂的角色层级。

## Personal Repo

每个 Worker 默认拥有一个 Personal Repo，用于保存尚未 contribution 到其他 Repo 的私人 Asset。

Personal Repo 与其他 Repo 使用相同的基本仓库模型，但在当前产品模型中保持私有。它存储 Asset，不维护独立的个人 Record 仓库。Worker 的 labour history 仍由链上的 Record 构建。

## 成员关系

Repo 维护允许向其 contribution 的 Worker。operator 可以添加和移除成员、检查某个 Worker 是否属于该 Repo，并查看当前成员关系。

成员关系只控制 Worker 是否可以向该 Repo contribution，不限制 Worker 在 Repo 之外产生 Record 或 Asset。

## Asset contribution

Worker 向 Repo contribution 一个 Asset。此次 contribution 同时关联描述相关劳动的、由 Worker 产生的 Record。

contributor 必须已经是该 Repo 的成员。一次被接受的 contribution 需要满足以下产品行为：

- 能够识别 contribution 的 Worker 及其成员关系；
- Asset、相关 Record 和 contribution 关系符合适用的 LabourChain 协议；
- Repo 接受并保存 Asset，不改变其协议含义；
- Repo 对该 contribution 相关的劳动进行确证；
- 此次 contribution 此后可以出现在 Repo contribution history 中。

失败的 contribution 不得表现为已经被 Repo 接受。

Repo contribution 描述的是包含 Asset 提交的劳动。没有提交 Asset 的劳动仍然可以产生 Record。

## 保存

Repo identity、operator、成员关系和已接受的 Asset 都属于需要持久保存的 Repository 状态。在可用部署中，正常的应用重启不应导致这些状态消失。

Record 的规范事实仍在链上。Repository 可以保存本地 Record 投影，使日常访问不需要为每次请求重新构建完整 contribution history。该投影可以从链上重新建立，不是 Record 的事实来源。

Asset 或 Record 的修正和版本关系由对应协议定义。Repository 不应为了存储或展示方便而静默改写已经接受的事实。

## Asset 读取与浏览

使用方可以通过稳定的 LabourChain identity 或 reference 获取已经接受的 Asset，并区分目标 Asset 是否存在。

MVP 还需要支持查看 Repo 当前的成员和 Assets。高级搜索、分页和索引在出现实际使用方或规模需求之前，不属于当前产品要求。

## Contribution history

使用方可以查看与 Repo 相关的劳动历史，包括该 Repo 已接受并确证的 contributions。

Contribution history 来自链上与 Repo contribution 相关的 Records，而不是 Repository 自己维护的规范 `records[]` 集合。日常访问不应要求每次都完整重建整条链；Runtime cache 或 index 可以为该视图提供支持。

## 协议有效性

只有当 Asset、相关 Record 和必要的 contribution 关系符合适用的 LabourChain 协议时，Repository 才接受此次 contribution。

Repository 不重新定义 Asset、Record、identity 或 confirmation 的协议语义。

## MVP 范围外

当前 Repository MVP 不要求实现公开或公共使用的记账、收益分配、通用 Private Repo、零知识证明，以及 Project 或 Board 的规划、分析和展示能力。

这些概念可以继续保留在 [`concepts/`](./concepts/) 中，并在进入明确产品范围后再转化为产品要求。
