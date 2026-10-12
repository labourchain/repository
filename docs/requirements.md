# Repository 产品要求

> **设计纠偏（2026-10）**：持久化 Runtime DB 采用 MongoDB 默认实现并经窄接口解耦；原独立 Contribution Recovery 已撤回，代码待删除；Asset 与 Asset Storage **延后实现／待返工**，旧代码和历史 Specs 不再作为已验收产品基线。本轮先修正文档，不更改运行代码。

Repository 是 LabourChain 中用于保存劳动成果（Asset）并对相关劳动进行仓库侧确证的仓库能力。本页定义 Repository MVP 的产品要求，是当前 Repository 产品行为的事实来源。

本文使用的领域概念定义在 [`concepts/`](./concepts/) 中。系统结构与插件边界见 [`architecture.md`](./architecture.md)。

## 范围

Repository MVP 包括：

- 最小 Member 协议能力，用于识别人类参与者；
- Repo 的建立、身份和重新加载；
- Repo creation provenance 与 Repo decision operator 留痕；
- Asset contribution；
- `repo.contribution@0.1.0` 的 Repo 侧正向采纳事实与 operator 留痕；
- 已接受 Asset 的持久保存与读取；
- Repo contribution history；
- Repo 可视化劳动记录测试所需的最小 labourRecord Protocol 能力；
- 对历史事实所引用 Protocol reference 与 exact ProtocolHash / verified artifact 的正确解析与验证。

Member 是人类参与者在协议与实现层的称呼，以 Core Entity identity 为身份锚点。`Worker` 保留为概念层的劳动主体描述，不作为程序中的人类实体类型。Core Record 是通用协议事实容器；描述劳动的领域事实暂称 `labourRecord`，作为适用 labour Protocol 下的一种 `Record.data`，由承担劳动的 Member 以其 Entity identity 产生或签署。Repo 自身作出的链上决定由 Repo identity 签名，并在相应 decision fact 中标注实际 operator。Record 被 Block 收录后获得这条链上的收录与确证顺序。Repository 不把 Record 作为另一类规范仓库内容保存，可以为日常查询和分析保留与 contribution 相关的 Record 投影。

## labour.record 最小劳动事实

Repository MVP 使用独立的 `labour.record@0.1.0` Protocol 表达一项已经发生的劳动。Core Record 继续负责 RecordId、Protocol reference/hash、`createdBy`、`createdAt` 与 signature；劳动 Protocol 只定义扁平的 `Record.data`：

```text
content
    -> 劳动者对“做了什么”的直接描述

duration
    -> 主观劳动投入标注，单位小时
    -> >= 0，v0.1.0 使用 0.5h 粒度
    -> 0 表示随手完成、未明显消耗注意力或精力的劳动

startAt / endAt
    -> optional observational time log
    -> 成对出现
    -> 使用 RFC 3339 UTC `Z` 格式
    -> 不接受本地时间或其他时区 offset
    -> 不用于推导或校正 duration

references[]
    -> optional confirmed upstream Asset references
    -> 表达这次劳动明确建立在什么已有劳动成果之上

assets[]
    -> optional directly associated result Asset references
    -> 表达这次劳动直接声明形成/留下的成果关联
```

`references` / `assets` 的引用完整性不能成为快速劳动记录的前置负担。缺少引用不阻止 labour Record 成立；上层产品可以根据 Git、聊天、计时器、当前打开的资料或 LLM 分析提出引用建议，但未经确认的推测不写入基础劳动事实。

`labour.record` 不记录 tags、Project、pid、assignee、status、priority、日报/周报、项目推进统计或 LLM 分类。它们属于组织、分析或 projection。`labour.record@0.1.0` 仍只把 Asset reference 当作 opaque reference 保存；旧 `asset.content@0.1.0` 曾将引用实现为 AssetId，但该通用身份方案当前延后返工。

## Asset 最小身份与内容

**状态：延后实现／待返工。** 前次基于 `asset.content@0.1.0` 的“完整字节对象、内容导出 AssetId、16 MiB 上限、独立文件存储”是未经充分产品讨论即进入实现的假设，不再作为已确认的 Repository 领域需求。

需要重新讨论 Asset（劳动成果）、成果的内容/表示、Repo 接收与实际仓库管理之间的关系，之后才能确定 Asset 身份、存储方式、资源限制、名称/元数据和读取/管理行为。

已经确认的是劳动记录通过 `references[]` 和 `assets[]` 表达明确引用与成果关系；不要求快速劳动记录强制解析所有引用，也不添加 `previous`、`pid` 或通用关系协议。Asset 具体 identity 与 storage contract 暂缓，详见标为 Deferred 的 `specs/asset.md` 和 `specs/asset-storage.md`。现有代码保持不变但**待返工**。

## Member 与身份组合

Member 不建立第二套 identity。一个 Member 以 Core `EntityPublicKey` 为唯一身份锚点，通过 `member`、`member.profile` 及未来其他协议组合形成完整的人类参与者能力。

`member.profile` 用于姓名、avatar 等可读信息，不是 identity 本身，也不应成为其他协议引用 Member 的替代标识。

同一个 Member Entity identity / keypair 可以同时组合 Repo 协议能力，用于暂时承载尚未进入集体 Repo 的 Record / Asset 关系与劳动成果。这种 Member-scoped Repo 不自动产生私人财产、排他权、转让权或收益权语义。

## Repo 建立与操作留痕

一个有效 Member 可以创建 Repo。Repo 本身同样以 Core Entity identity 为身份锚点，并通过 Repo 及其他协议组合形成完整仓库能力。

Repo establishment 只表达一个创建事实：创建者以自己的 Member Entity identity 作为 `Record.createdBy` 并以个人私钥签名；`Record.data.publicKey` 声明被创建的 Repo EntityPublicKey。这里的 `createdBy` 只保留创建来源/provenance，不推导 Repo 的所有权、永久控制权或治理权。

Member-scoped Repo 可以让创建者和 Repo 使用同一个 Entity identity/keypair；集体 Repo 也可以创建一个独立的 Repo Entity identity。两种情况都不自动产生 Asset、劳动成果、排他权、转让权或收益权语义。

Repo 后续采取需要链上留痕的决定时，才使用 Repo private key 对相应 Record 签名，并在该 decision fact 的签名内容中标注 `operator: EntityPublicKey`。operator 只用于记录这次 Repo 行为由谁实际操作，不建立长期 operator 角色、ACL 或组织授权证明。授权、复核和组织治理属于后续组织层问题。

Repo identity 和创建来源在正常应用重启后必须能够从 durable facts 恢复。

## Repo 与劳动者关系

劳动者和 Repo 本身相互独立。Repository MVP 不建立 `repo.membership` 链上状态，也不以“是否为 Repo member”作为 contribution 的前置资格。

两者需要长期确证的关系是 Repo 是否采纳某一次 labour / Asset contribution。产品可以根据已接受 contribution 派生 contributors / members 视图；人工维护的人员分组、标签、筛选条件和组织名册属于软件运行数据，暂不上链，也不参与链级 validity。

组织中的成员资格、授权、角色和政治治理不由 Repository 技术层自动确权。技术层负责保存实际发生的 contribution、Repo decision、签名主体和 operator 留痕。

## Asset contribution

当前已确认的最小 Repo 采纳事实由 Member 签署的劳动 Record 与 Repo 签署的接受 Record 建立。Repo 接受劳动者的一项明确成果，不自动接受同一次劳动所关联的所有成果。

```text
Member-signed labour.record@0.1.0 Record L
  -> Record.createdBy = contributor EntityPublicKey
  -> data.references[] = 确认引用的上游成果
  -> data.assets[] = 此次劳动声明的成果引用

Repo-signed repo.contribution@0.1.0 Record D
  -> Record.createdBy = Repo EntityPublicKey
  -> data = { labourRecordId: L.id, assetId, operator }
```

`D.data.assetId` 表示 Repo 选择 `L.data.assets[]` 中的一项成果。Repo identity 由 `createdBy` 表达，贡献者身份由 L 的签名和 `createdBy` 表达，`operator` 仅记录该次 Repo 行为的执行者，不自行证明成员资格、授权或所有权。Repo acceptance 是正向采纳事实，不为拒绝、撤销或重新打开创造预设 decision enum。

Member 的劳动事实与 Repo 的采纳事实相互独立。Repo 不代替 Member 签署劳动记录，不代替 Runtime/signer 持有 Repo 私钥；`Record.data` 的这些已确定字段不因数据库迁移而改变。没有新 ContributionId、额外 Member confirmation、generic relation 或 Patch。

**待返工边界：** 成果引用 `assetId` 所指对象的通用身份、存储、可用性、大小与具体管理语义必须在 Asset 产品设计完成后再固定。过去“选中结果必须由本地 `asset.content` provider 保留 exact bytes”等规则是原实现的耦合，不应继续当作已经验收的产品需求。原 #9 的签名关系原则保留，其与 Asset 存储的整合需要重新验收。

## Repository acceptance 与链确证

MVP 区分两个不同完成边界：

```text
Repository committed
= Repo 已完成领域校验与所需确认
+ 待上链 Records 已被可靠持久接收
+ accepted Asset 可持久读取

Block confirmed
= 相关 Records 已被某个有效 Block 收录
+ 获得这条链上的确证顺序
```

Repository committed 是产品接受边界；Block confirmed 是链确证边界。两者不能混称为同一个 canonical 状态。

因此：

- Repository 可以在等待下一次 Block packing 时已经向使用方报告 contribution accepted；
- 运行时必须能够在重启后继续识别并处理这些已接受但尚未被 Block 收录的 Records；
- 一旦链状态可查询，Runtime/Projection 必须能够区分 pending-chain 与 block-confirmed；
- 本地持久化不会单独赋予 Record “已被链确证”的含义。


## 链上信任与独立验证

Repository 的正常运行路径负责尽早检查 Protocol 语义、维护关系并准备待打包 Records，但 Repository Runtime 本身不是链的最终信任根。Block 的有效性不得依赖“生产者运行了官方 Repository 代码”这一假设；能够生成 Block 的节点即使使用自定义实现或绕过正常 Repo 流程，其结果也只能在其他节点独立验证通过后成为有效链事实。

Block packing 与 peer validation 后续实现时必须满足：

- 下一版 Core Block Header 使用 `vroot` 提交由 Block Records 直接引用的 `(protocol, protocolHash)` 唯一集合；`vroot` 由 Records 确定性提取、去重、排序、JCS 编码并 DoubleSHA256 得到，不另设 ValidationManifest；
- 验证节点从 Block 实际 Records 取得 exact `ProtocolHash`，核对 `vroot` 后解析并验证对应 Protocol implementations，而不是使用本地 `latest` 猜测历史语义；
- 验证节点针对 Block 中实际包含的 Records 重新执行 Record、signature、Protocol 及关系验证，不信任生产节点的本地 validation 结果；
- Block 内相关 Records 按各自 Protocol 形成的生产关系 tree / forest 或其他明确依赖关系必须能够被重建并验证为自洽；
- 只有完成这些独立验证并接受 Block 后，相关事实才获得该链上的确证状态。

在 Block 被接受之前，Repository 可以继续修改其本地 candidate set：替换、追加或放弃待打包事实都属于 Runtime 行为。一个具体的签名 Record 仍受其 RecordId 与 signature 约束；如果修改了该 Record 的签名覆盖内容，修改后的值必须重新满足对应的 RecordId / signature 规则，不能沿用原 Record 身份冒充同一事实。

当前 MVP 不要求实现通用加密 VM、智能合约虚拟机或可信执行环境来证明 Repo Runtime 按某一固定过程运行。链级验证针对最终 Block 内容、由其 Records 派生并由 Header `vroot` 承诺的验证语义根，以及这些 Records 在 exact Protocol semantics 下的关系。

## 持久性与恢复

**默认持久化方案为 MongoDB，经可替换的 Runtime DB interface 使用。** 参考 Board 的领域 Repository 接口与 MongoDB provider 分离方式；Repository 的签名事实使用已确定的 Core Record 和各 Protocol 字段，不复用 Board 的 `pid`、tags、patch、SnapshotHead 等产品字段。

数据库负责已成功持久化数据的可靠性、故障恢复和必要的唯一性/条件写入。Node 不重做数据库存储恢复，不创建第二份 durable request，不运行独立 Contribution Recovery。重启时重新建立 Cordis 组合和数据库连接，从 DB 读取现有持久事实并按需验证 exact Protocol、重建可丢弃的索引/投影。

Repo acceptance Record `D` 经可靠持久写入后，才构成 Repo 已接受该项贡献的事实。仅有劳动 Record 或其他上游事实不构成 Repo acceptance；若 D 不存在，Node 不能从“看似遗留的”数据推断本次提交已成功，也无需自动续办未完成的用户请求。调用方显式重试同一 signed operation 时必须遵守幂等和同键冲突语义。D 存在但依赖持久状态不可读取/损坏时显式报告错误，不使用请求内容无声修复历史事实。

**撤回 #10 独立 Recovery。** 原 `ContributionStagingService`、`RepositoryContributionRecoveryService`、`recoverPending()`、请求副本和进度恢复测试均属待删除旧代码。它们不是新的 Runtime DB 架构的一部分。无需定义 staging、phase、retry/correlation 或恢复状态机。

MongoDB 默认实现应通过窄 DB contract 与领域服务解耦，其他 DB 只需满足相同持久性、完整性、查询及并发唯一性能力。MongoDB 的跨文档写入不是无条件原子的，领域所需一致性必须由实际 provider 的原子写入/索引或正式部署支持的事务保障，不能只依赖 Node 单进程锁。具体可见 `specs/runtime-record-database.md`。

Record 的 Repository 本地接收不同于链上 Block-confirmed；只有 accepted Block/chain-state 能证明后者。Block/message 广播与重试属于之后的网络层，不属于 Repository Recovery。

## Asset 读取与浏览

**延后实现／待返工。** 之前把 `get(assetId) / has(assetId) / preserve(asset)` 当作完整 Repo Asset 管理合同缺乏产品论证，暂不把它作为 MVP 通过标准。

需要从真实仓库行为明确：哪些成果可被管理、如何入库/取用、成果 identity 与内容副本有什么区别、按什么方式查询、哪些字段只是本地 DB/展示元数据。现有 `AssetStorageService` 不删除但不计为已验收的目标功能。Asset 浏览与后续历史查询应在完成这项讨论后统一设计。

## Contribution history

使用方可以查看与 Repo 相关的劳动历史，包括该 Repo 已接受并确证的 contributions。

Contribution history 可以组合两类明确区分的数据来源：

- Repository 已接受、但仍等待 Block 收录的 durable pending/committed state；
- 已经由链上 Block 收录确证的 Records、Assets、confirmations 和 relations 的投影。

两者在视图中不得被混称为同一种链确证状态。Repository 不因此维护规范的 `records[]` 集合。

日常访问不应要求每次都完整扫描整条链。可以使用可重建或可对账的 cache、DB index 或 projection 支持该视图，但这些运行时数据不是 Block confirmation 本身。

## 协议有效性与版本

Repository 只接受符合适用 LabourChain Protocol 的事实和关系。

历史事实必须按照它实际引用的 Protocol reference 与 exact `ProtocolHash` 解释或验证。人类可读的 identity/version 用于表达协议引用，但不能替代机器权威的 hash。存在多个版本或 artifact 时，不得把历史事实隐式交给 `latest`、同版本的其他 artifact 或任何未被该事实精确引用的实现。

如果处理某个事实所需的 exact Protocol descriptor / artifact 在当前运行环境中不可解析或无法通过 Core 的 hash / artifact 验证边界，Repository 必须明确失败，而不是使用不同版本或兼容实现猜测其语义。

Repository 不重新定义 Member、Asset、Record、identity、signature、confirmation 或 block 的协议语义。Repository 自己定义的是仓库领域的 establishment、Repo decision 留痕、contribution acceptance 等业务语义。

## 与 LabourFlow 的关系

同 identity 的 Member + Repo 协议组合属于通用协议能力。LabourFlow 可以在其上提供面向个人的 Repo 产品体验，用于组织尚未进入集体 Repo 的内容，但不需要创造第二个 Personal Repo identity 或 keypair。

该产品空间不应仅因“个人使用”被解释为私人财产空间。访问、使用、收益和其他权利关系应由相应协议另行表达。

RawEntry 识别、自然语言输入和 Record drafting 属于 LabourFlow 或其他上层产品，不属于 Repository。

## 与 Project / Board 的关系

Project 是对 Member、Record 和 Asset 的上层组织形式，不由 Repository 负责 canonical storage。

Project 的规划、分析、回顾和展示属于 LabourBoard 或其他上层产品。Repository 的 Asset retrieval 和 contribution history 不应依赖 Project / Board 概念才能成立。

## MVP 范围外

当前 Repository MVP 不要求实现：

- 完整的个人 Repo 产品 UX；
- `member.profile` 的完整字段与隐私模型；
- Project / Board 的规划、分析和展示；
- 公开或公共使用的记账与收益分配；
- 通用 Private Repo 权限体系；
- 零知识证明；
- 高级 ACL、复杂角色层级以及链上 Repo membership / 组织治理；
- 高级搜索与大规模索引；
- Block packing 内部实现；
- 节点同步与共识机制。

这些内容只有在进入明确产品范围后，才转化为新的 Requirements，并继续进入 Design、Spec 和实现。
