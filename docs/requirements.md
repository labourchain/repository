# Repository 产品要求

Repository 是 LabourChain 中用于保存劳动成果（Asset）并对相关劳动进行仓库侧确证的仓库能力。本页定义 Repository MVP 的产品要求，是当前 Repository 产品行为的事实来源。

本文使用的领域概念定义在 [`concepts/`](./concepts/) 中。系统结构与插件边界见 [`architecture.md`](./architecture.md)。

## 范围

Repository MVP 包括：

- 最小 Member 协议能力，用于识别人类参与者；
- Repo 的建立、身份和重新加载；
- Repo ownership 与 Repo decision operator 留痕；
- Asset contribution；
- Repo 侧劳动确证；
- 已接受 Asset 的持久保存与读取；
- Repo contribution history；
- 对历史事实所引用 Protocol reference 与 exact ProtocolHash / verified artifact 的正确解析与验证。

Member 是人类参与者在协议与实现层的称呼，以 Core Entity identity 为身份锚点。`Worker` 保留为概念层的劳动主体描述，不作为程序中的人类实体类型。描述劳动的 Record 由承担劳动的 Member 以其 Entity identity 产生或签署；Repo 自身作出的链上决定由 Repo identity 签名，并在相应 decision fact 中标注实际 operator。Record 被 Block 收录后获得这条链上的收录与确证顺序。Repository 不把 Record 作为另一类规范仓库内容保存，可以为日常查询和分析保留与 contribution 相关的 Record 投影。

## Member 与身份组合

Member 不建立第二套 identity。一个 Member 以 Core `EntityPublicKey` 为唯一身份锚点，通过 `member`、`member.profile` 及未来其他协议组合形成完整的人类参与者能力。

`member.profile` 用于姓名、avatar 等可读信息，不是 identity 本身，也不应成为其他协议引用 Member 的替代标识。

同一个 Member Entity identity / keypair 可以同时组合 Repo 协议能力，用于暂时承载尚未进入集体 Repo 的 Record / Asset 关系与劳动成果。这种 Member-scoped Repo 不自动产生私人财产、排他权、转让权或收益权语义。

## Repo 建立、ownership 与操作留痕

一个有效 Member 可以建立 Repo。Repo 本身同样以 Core Entity identity 为身份锚点，并通过 Repo 及其他协议组合形成完整仓库能力。

集体 Repo 可以使用与 establishing Member 不同的 Entity identity。establishment 必须能够明确关联 establishing Member 与 Repo identity，并把 establishing Member 留作该 Repo 的初始 owner。

Repo ownership 只描述 Repo identity 的建立、控制与责任来源，不表示 owner 自动拥有 Repo 中的 Asset、劳动成果、排他权、转让权或收益权。

Repo 后续采取需要链上留痕的决定时，使用 Repo private key 对相应 Record 签名，并在该 decision fact 的签名内容中标注 `operator: EntityPublicKey`。operator 只用于记录这次决定实际由谁操作，不建立长期 operator 角色、ACL 或组织授权证明。owner 转移、多人治理、授权和复核规则属于后续组织治理问题。

Repo identity 和 ownership 在正常应用重启后必须能够从 durable facts 恢复。

## Repo 与劳动者关系

劳动者和 Repo 本身相互独立。Repository MVP 不建立 `repo.membership` 链上状态，也不以“是否为 Repo member”作为 contribution 的前置资格。

两者需要长期确证的关系是 Repo 是否采纳某一次 labour / Asset contribution。产品可以根据已接受 contribution 派生 contributors / members 视图；人工维护的人员分组、标签、筛选条件和组织名册属于软件运行数据，暂不上链，也不参与链级 validity。

组织中的成员资格、授权、角色和政治治理不由 Repository 技术层自动确权。技术层负责保存实际发生的 contribution、Repo decision、签名主体和 operator 留痕。

## Asset contribution

Member 向 Repo contribution 一个 Asset。此次 contribution 同时关联描述相关劳动的、由该 Member 产生的 Record，以及适用协议要求的关系和确认。

Record 在 Repository 之外产生。Repository 不负责把 RawEntry 转换为 Record，也不因为一次 contribution 而成为 Record 的生产者。

一次 contribution 被 Repo 接受前必须满足：

- Asset、相关 Record 和 contribution relation 符合它们各自引用的 LabourChain Protocol；
- 适用协议要求的 Member / Worker confirmation 已满足；
- Repo 侧 confirmation 已满足；由 Repo identity 签署的决定必须按适用 Protocol 留下 operator 身份；
- contribution 及其待上链事实已经进入可跨重启恢复的 Repository accepted / committed 状态；
- Repo 能够保存并再次读取被接受的 Asset。

失败、未完成或仍处于临时处理中的 contribution 不得表现为已经被 Repo 接受。

Repository acceptance 不要求等待 Block packing。Block 收录发生在 Repository commit 之后，为相关 Records 提供链上的收录与确证；在此之前，Repository committed state 必须明确属于 durable Runtime / pending-chain state，不能冒充已经被 Block 确认的 canonical chain state。

Repo contribution 描述的是包含 Asset 提交的劳动。没有形成或提交 Asset 的劳动仍然可以产生 Record，只是不构成 Repo contribution。

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

- Block Header 记录打包时 Repo 实际采用的 Protocol composition，并提交能够精确绑定对应 Protocol implementations / artifacts 的 hashes；
- 验证节点能够根据 Header 获取或解析 exact Protocol implementations，重新计算对应 hashes，而不是使用本地 `latest` 猜测历史语义；
- 验证节点针对 Block 中实际包含的 Records 重新执行 Record、signature、Protocol 及关系验证，不信任生产节点的本地 validation 结果；
- Block 内相关 Records 按各自 Protocol 形成的生产关系 tree / forest 或其他明确依赖关系必须能够被重建并验证为自洽；
- 只有完成这些独立验证并接受 Block 后，相关事实才获得该链上的确证状态。

在 Block 被接受之前，Repository 可以继续修改其本地 candidate set：替换、追加或放弃待打包事实都属于 Runtime 行为。一个具体的签名 Record 仍受其 RecordId 与 signature 约束；如果修改了该 Record 的签名覆盖内容，修改后的值必须重新满足对应的 RecordId / signature 规则，不能沿用原 Record 身份冒充同一事实。

当前 MVP 不要求实现通用加密 VM、智能合约虚拟机或可信执行环境来证明 Repo Runtime 按某一固定过程运行。链级验证针对最终 Block 内容及其声明的 Protocol composition。

## 持久性与恢复

已经接受的 Asset 必须能够持久保存，并在正常应用重启后再次读取。

Member / Repo identity、Repo ownership 以及已接受 contribution 所需的 Repository 状态，在正常应用重启后必须能够恢复。Repo contributor 分组、标签和筛选条件属于产品软件数据，不构成链上恢复前提。

应用重启或运行时故障不得把尚未成功进入 Repository committed state 的 contribution 错误地暴露为已接受状态，也不得丢失已经 Repository committed、正在等待链收录的事实。

Repository Runtime 必须维护经过适用 Protocol 验证的 Record 关系、顺序/依赖和待打包状态。新的 Repository 领域 Record 在进入正常 accepted/pending-chain 路径时，应在同一 Runtime 写入边界内完成关系验证并可靠持久接收；这些关系状态用于后续验证、追溯和 Block packing，但不因此成为链确证来源。

Asset 的规范身份和语义由适用的 LabourChain Protocol 定义。Repository 不应为了存储、索引或展示方便而静默改写已经接受的 Asset、Record、confirmation 或 contribution relation。


Repo 可更新状态采用 Record + Patch 的事实演化方式。Snapshot 只允许作为节点 Runtime 对这些事实的可重建物化结果，用于恢复、查询、索引或计算加速；Snapshot 不进入 Record 历史，不作为独立链上事实，也不得反向替代或覆盖 Record + Patch history。具体 Patch 数据结构由相应 Protocol / Spec 在进入实现范围时定义。

被 Block 收录的 Record 确证事实来自链状态。Repository 可以保存本地 pending state、Record projection 和查询索引，使日常访问与恢复不需要为每次请求重新扫描完整链；这些运行时数据必须能够与 Block-confirmed facts 区分，不能成为新的链确证来源。

## Asset 读取与浏览

使用方可以通过稳定的 LabourChain identity 或 reference 获取已经接受的 Asset，并区分目标 Asset 是否存在。

MVP 还需要支持查看 Repo 的 contributors 视图和 Assets。contributors 可以从已接受 contribution 派生；人工分组和筛选属于本地软件数据。

高级搜索、分页、全文索引和复杂查询在出现实际规模需求之前，不属于当前产品要求。

## Contribution history

使用方可以查看与 Repo 相关的劳动历史，包括该 Repo 已接受并确证的 contributions。

Contribution history 可以组合两类明确区分的数据来源：

- Repository 已接受、但仍等待 Block 收录的 durable pending/committed state；
- 已经由链上 Block 收录确证的 Records、Assets、confirmations 和 relations 的投影。

两者在视图中不得被混称为同一种链确证状态。Repository 不因此维护规范的 `records[]` 集合。

日常访问不应要求每次都完整扫描整条链。可以使用可重建或可对账的 cache、index、pending journal 或 projection 支持该视图，但这些运行时数据不是 Block confirmation 本身。

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
