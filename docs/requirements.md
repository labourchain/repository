# Repository 产品要求

> **设计纠偏（2026-10）**：持久化 Runtime DB 采用 MongoDB 默认实现并经窄接口解耦；原独立 Contribution Recovery 已撤回，代码待删除；Asset 与 Asset Storage **延后实现／待返工**，旧代码和历史 Specs 不再作为已验收产品基线。本轮先修正文档，不更改运行代码。

Repository 是 LabourChain 中用于保存劳动成果（Asset）并对相关劳动进行仓库侧确证的仓库能力。本页定义 Repository MVP 的产品要求，是当前 Repository 产品行为的事实来源。

本文使用的领域概念定义在 [`concepts/`](./concepts/) 中。系统结构与插件边界见 [`architecture.md`](./architecture.md)。

## 范围

Repository MVP 的当前确认与暂缓功能：

- Member 身份、Repo 创建与重启后读取；
- Repo creation provenance 与 operator 留痕；
- 最小签名劳动事实 `labour.record@0.1.0`；
- `repo.contribution@0.1.0` 对一项成果引用的正向采纳事实；
- exact ProtocolHash / verified artifact 解析；
- **一个 Repo 仅由一个 Node 维护**；
- 使用 MongoDB 默认持久化 Record，存储接口可由其他数据库实现；
- Contribution history（待 Runtime DB 改造后实现）；
- **Asset 身份、存储、浏览及实际仓库管理功能整体延后实现／待返工**，不是当前已验收功能或具体完成条件。

Member 是人类参与者在协议与实现层的称呼，以 Core Entity identity 为身份锚点。Core Record 是通用签名事实容器；`labour.record` 为具体劳动语义；Repo 签名决定由其自身 identity 表达并记录 operator。Repository 本地接收事实与后来由 Block 建立的链确证严格区分。

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

**Deferred — 延后实现／待返工。** 本轮不指定 Asset 的通用身份、内容、数字表示、仓库管理、持久存储、取回流程、资源限制或校验条件。原 `asset.content@0.1.0` 的字节对象及 16 MiB 边界是历史代码，不构成已接受的产品要求。

仅保留已确认的劳动记录 `references[] / assets[]` 与 Repo 采纳事实 `assetId` 等引用字段。字段保留不等于认可旧 Asset 类型或存储方式。

实际 Asset 设计应另行从真实仓库行为展开 Requirements → Architecture → Specs。现有 Asset 实现不在本轮修改。

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

Member 对劳动的确认是签名的 `labour.record@0.1.0` Record L；Repo 的正向采纳事实是另一条 Repo 签名的 `repo.contribution@0.1.0` Record D：

```text
L.createdBy = contributor EntityPublicKey
L.data.references[] = 已确认上游引用
L.data.assets[] = 此次劳动声明的成果引用

D.createdBy = Repo EntityPublicKey
D.data = { labourRecordId: L.id, assetId, operator }
```

`D.data.assetId` 明确选中 `L.data.assets[]` 中的一项成果引用，不自动采纳其他成果。Repo identity 由 `D.createdBy` 表达，劳动者由 L 的签名确认，`operator` 仅用于该次操作留痕。不存在额外 Member confirmation、ContributionId、`pid`、`previous` 或通用 relation model。

**Asset 相关的实体身份、内容上传、保管、读取、可用性与实际仓库操作均延后讨论。** 不能继续以旧的 `asset.content` 文件存储当作 Contribution 成立的必需条件。已确认的是上述签名事实与引用关系，不是完整的 Asset 端到端入库实现。

## Repository acceptance 与链确证

Repository acceptance 与 Block 确证是两种不同的完成边界：

```text
Repository acceptance
  = 已验证且由 Repo 签名的采纳事实 D
  + D 已由当前 Repo 所属 Node 的 Runtime DB 持久接收
  + 必需的已确认签名事实和引用关系有效

Block confirmed
  = 相关事实进入经过独立验证且被接受的 Block
```

D 不存在时，不得根据 L 或其他持久事实推断 Repo 已采纳。D 存在但必要的已持久化签名事实不可读取或损坏时，报告 storage/integrity 错误，而不是宣称健康接受或悄悄修复。签名采纳不自动完成尚未设计的 Asset 管理、存储或可用性保证。

只有 accepted Block/chain-state 证据可以使 `pending-chain` 升级为 `block-confirmed`；本地 DB 接收和 candidate Block 打包均不能替代。

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

**一个 Repo 由一个 Node 维护。** 当前没有多个 Node 同时管理、修改同一个 Repo 的模型，也不需要跨 Node 的冲突协调、共享 Repo 锁或分布式事务协议。

Node 默认使用 MongoDB 保存 Core signed Records，领域服务通过窄 Runtime DB 接口访问，其他数据库可以实现相同操作；不采用 Board 特有的 `pid`、Patch 或 SnapshotHead 字段。

**MongoDB 负责自身持久化与数据库故障恢复。** Node 只连接 DB、读取已持久保存的事实，按需验证 exact Protocol 并重建衍生索引/视图。不设计额外的数据库持久化策略、事务配置、DB 自检或应用层数据库恢复机制。

已撤回的 #10 独立 Contribution Recovery 不再属于系统：没有 persisted request staging、`recoverPending()`、自动续办未完成请求或恢复状态机。相关旧代码在后续清理任务中删除。

已持久化且有效的 D 是 Repo 采纳事实；D 不存在意味着未被当前 Repo 接受。调用方可以自行重试同一已签名的请求；使用现有 RecordId 幂等和单 Node 中的具体同键冲突检查即可。这不是启动时自动恢复用户操作。

本地接受不同于 Block confirmation；Block 投递、打包与网络同步不在本项范围内。

## Asset 读取与浏览

**全部延后实现／待返工。** 目前不确认通用 `preserve/get/has`、内容字节布局、Repo Asset 目录、检索、管理接口或资源大小限制。

Asset 是未来 Repository 的重要产品能力，但必须先讨论实际仓库管理方式，再制定身份和存储合同。本轮既不扩展旧 Asset 代码，也不把它列为已经完成的 MVP 验收项。

## Contribution history

使用方可以查看与 Repo 相关的劳动历史，包括该 Repo 已接受并确证的 contributions。

Contribution history 可以组合两类明确区分的数据来源：

- Repository 已接受、但仍等待 Block 收录的 durable pending/committed state；
- 已经由链上 Block 收录确证的签名 Records 及其已确认关系的投影；Asset 展示另行设计。

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
