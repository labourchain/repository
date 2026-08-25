# Repository 产品要求

Repository 是 LabourChain 中用于保存劳动成果（Asset）并对相关劳动进行仓库侧确证的仓库能力。本页定义 Repository MVP 的产品要求，是当前 Repository 产品行为的事实来源。

本文使用的领域概念定义在 [`concepts/`](./concepts/) 中。系统结构与插件边界见 [`architecture.md`](./architecture.md)。

## 范围

Repository MVP 包括：

- Repo 的建立、身份和重新加载；
- Repo operator 与成员关系；
- Asset contribution；
- Repo 侧劳动确证；
- 已接受 Asset 的持久保存与读取；
- Repo contribution history；
- 对历史事实所引用协议版本的正确解释与验证。

Record 是 Worker 的链上劳动事实，不作为 Repository 的另一类规范仓库内容保存。Repository 可以为日常查询和分析保留与 contribution 相关的 Record 投影。

## Repo 建立与身份

任何 Worker 都可以建立 Repo。每个 Repo 都有稳定身份，使使用方能够再次加载同一个 Repo，并与其他 Repo 区分。

每个 Repo 有一个 operator，负责维护允许向该 Repo contribution 的 Workers。MVP 不引入 owner、admin、maintainer、editor、viewer 等复杂角色层级。

Repo identity、operator 和成员关系在正常应用重启后必须能够恢复，不得只存在于进程内存中。

## 成员关系

Repo 维护允许向其 contribution 的 Workers。operator 可以添加和移除成员、检查某个 Worker 是否属于该 Repo，并查看当前成员关系。

成员关系只控制 Worker 是否可以向该 Repo contribution，不限制 Worker 在 Repo 之外产生 Record 或 Asset。

非成员的 contribution 不得进入已接受状态。

## Asset contribution

Worker 向 Repo contribution 一个 Asset。此次 contribution 同时关联描述相关劳动的、由 Worker 产生的 Record，以及适用协议要求的关系和确认。

Worker 在 Repository 之外产生 Record。Repository 不负责把 RawEntry 转换为 Record，也不因为一次 contribution 而成为 Record 的生产者。

一次 contribution 被 Repo 接受前必须满足：

- contributor 是该 Repo 的成员；
- Asset、相关 Record 和 contribution relation 符合它们各自引用的 LabourChain Protocol；
- 适用协议要求的 Worker confirmation 已满足；
- Repo 侧 confirmation 已满足；
- contribution 已成功提交为 canonical committed state；
- Repo 能够保存并再次读取被接受的 Asset。

失败、未完成或仍处于运行时处理中的 contribution 不得表现为已经被 Repo 接受。

Block packing 发生在 contribution commit 之后，不是 Repository 接受 contribution 的必要条件。

Repo contribution 描述的是包含 Asset 提交的劳动。没有形成或提交 Asset 的劳动仍然可以产生 Record，只是不构成 Repo contribution。

## 持久性与恢复

已经接受的 Asset 必须能够持久保存，并在正常应用重启后再次读取。

Repo identity、operator、成员关系以及已接受 contribution 所需的 Repository 状态，在正常应用重启后必须能够恢复。

应用重启或运行时故障不得把尚未成功 commit 的 contribution 错误地暴露为已接受状态。

Asset 的规范身份和语义由适用的 LabourChain Protocol 定义。Repository 不应为了存储、索引或展示方便而静默改写已经接受的 Asset、Record、confirmation 或 contribution relation。

Record 的规范事实仍在链上。Repository 可以保存本地 Record projection，使日常访问不需要为每次请求重新构建完整 contribution history。该 projection 必须可以与 canonical facts 区分，并且不能成为新的 Record 事实来源。

## Asset 读取与浏览

使用方可以通过稳定的 LabourChain identity 或 reference 获取已经接受的 Asset，并区分目标 Asset 是否存在。

MVP 还需要支持查看 Repo 当前的成员和 Assets。

高级搜索、分页、全文索引和复杂查询在出现实际规模需求之前，不属于当前产品要求。

## Contribution history

使用方可以查看与 Repo 相关的劳动历史，包括该 Repo 已接受并确证的 contributions。

Contribution history 来自链上与 Repo contribution 相关的 Records、Assets、confirmations 和 relations 的投影，而不是 Repository 自己维护的规范 `records[]` 集合。

日常访问不应要求每次都完整扫描整条链。可以使用可重建的 cache、index 或 projection 支持该视图，但这些数据不是 canonical facts。

## 协议有效性与版本

Repository 只接受符合适用 LabourChain Protocol 的事实和关系。

历史事实必须按照它实际引用的 Protocol identity 和 version 解释或验证。存在多个协议版本时，不得把历史事实隐式交给 `latest` 或其他未引用版本处理。

如果处理某个事实所需的协议版本在当前运行环境中不可用，Repository 必须明确失败，而不是使用不同版本猜测其语义。

Repository 不重新定义 Asset、Record、identity、signature、confirmation、commit 或 block 的协议语义。

## 与 LabourFlow 的关系

Personal Repo 属于 LabourFlow 的产品模块，不属于 `labourchain/repository` MVP 的特殊 Repo 模式。

LabourFlow 可以复用通用的 Asset、Asset-Record relation 等 LabourChain Protocol 能力实现 Personal Repo，但 Personal Repo 的建立、生命周期和产品行为由 LabourFlow 负责。

RawEntry 识别、自然语言输入和 Record drafting 同样属于 LabourFlow 或其他上层产品，不属于 Repository。

## 与 Project / Board 的关系

Project 是对 Worker、Record 和 Asset 的上层组织形式，不由 Repository 负责 canonical storage。

Project 的规划、分析、回顾和展示属于 LabourBoard 或其他上层产品。Repository 的 Asset retrieval、membership 和 contribution history 不应依赖 Project / Board 概念才能成立。

## MVP 范围外

当前 Repository MVP 不要求实现：

- Personal Repo 产品模块；
- Project / Board 的规划、分析和展示；
- 公开或公共使用的记账与收益分配；
- 通用 Private Repo 权限体系；
- 零知识证明；
- 高级 ACL 与复杂角色层级；
- 高级搜索与大规模索引；
- Block packing 内部实现；
- 节点同步与共识机制。

这些内容只有在进入明确产品范围后，才转化为新的 Requirements，并继续进入 Design、Spec 和实现。
