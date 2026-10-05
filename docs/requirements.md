# Repository 产品要求

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

`labour.record` 不记录 tags、Project、pid、assignee、status、priority、日报/周报、项目推进统计或 LLM 分类。它们属于组织、分析或 projection。`labour.record@0.1.0` 仍只把 Asset reference 当作 opaque reference 保存；当前 `asset.content@0.1.0` 已将 MVP 的实际引用值收敛为 AssetId。

## Asset 最小身份与内容

Repository MVP 使用 `asset.content@0.1.0` 表达第一种最小 Asset。Asset 是精确 Protocol 语义下的不可变内容对象，最小值由 `id / protocol / protocolHash / contentHash / exact content bytes` 构成。

`contentHash` 由精确内容字节确定性派生；AssetId 再由 `protocol + protocolHash + contentHash` 按 RFC 8785 JCS + DoubleSHA256 确定性派生。AssetId 与 Core RecordId、EntityPublicKey、ProtocolHash 是不同 identity 空间；其中 exact ProtocolHash 与其 verified artifact 继续复用 Core/Repository 已建立的精确协议解析边界。

Asset 不重复劳动事实已经拥有的 `createdBy`、`createdAt`、signature 或关系字段，也不加入 `previous`、`pid`、Repo、Member、filename、MIME、tag 等字段。生产与使用关系继续由 labour Record 建立：`assets[]` 声明这次劳动直接留下的 AssetId，`references[]` 声明本次劳动明确建立在其上的既有 AssetId。

因此修改链自然表现为 `old Asset -> labour -> new Asset`；同一个 Asset 也可以被多个后续 labour Records 引用形成分支。若一次维护没有改变精确内容，同一个 AssetId 可以同时出现在该 Record 的 `references[]` 与 `assets[]` 中，不为了记录劳动而制造空洞版本。

内容或 exact ProtocolHash 改变时形成新的 AssetId，旧 Asset 不被原地改写。相同的精确 `protocol + protocolHash + content` 得到相同 AssetId；其生产者、被哪些 Repo 接受以及由哪些 Records 引用不进入 Asset identity。

最小 Asset Protocol 只建立内容 identity/integrity。任意可写入磁盘的 bytes 不会因此自动成为被接受的劳动成果；它仍需进入真实 labour/contribution facts 与 Repository acceptance 流程。

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

Member 向 Repo contribution 一个具体 Asset。当前 MVP 的一次 contribution
只需要三项输入：

```text
selected Asset
Member-signed labour.record@0.1.0
Repo-signed repo.contribution@0.1.0
```

Member 侧确认不再另设 confirmation fact。一个有效的
`labour.record@0.1.0` 已经由劳动 Member 以自己的 Entity identity 签名，
其 `references[]` 与 `assets[]` 就是当前 MVP 的已确认劳动—Asset 关系。

Repo 侧采纳使用一个具体正向事实：

```text
Record.protocol
= repo.contribution@0.1.0

Record.createdBy
= Repo EntityPublicKey

Record.signature
= Repo identity signature

Record.data
= {
    labourRecordId,
    assetId,
    operator
  }
```

其中 `labourRecordId` 指向本次贡献对应的 labour Record；
`assetId` 必须是该 labour Record 的 `assets[]` 中一个结果 Asset；
`operator` 是实际执行这次 Repo 行为的 Core EntityPublicKey。

Repo identity 不重复写入 data，因为已经由 `Record.createdBy` 表达；
劳动者 identity 不重复写入，因为已经由 labour Record 的 author 表达；
上游生产/引用关系不重复写入，因为已经由 `labour.references[]` 表达。

显式保留 `assetId` 是必要的 Repo 独立断言：一个 labour Record 可以产生多个
Asset，而 Repo 可以只采纳其中一个结果，不因此断言自己同时采纳了所有结果。

当前 `repo.contribution@0.1.0` 只表达正向采纳。不存在有效 acceptance
Record 只表示没有可用的正向采纳事实，不等于链上存在一个“拒绝”事实。
MVP 不为未来可能的 reject/revoke/reopen 预设 decision enum。

`operator` 只保留本次 Repo 行为的责任留痕。它必须是合法
EntityPublicKey，可以与 Repo identity 相同，但当前 Protocol 不要求它满足
Member capability，也不把它解释为 membership、role、delegation 或治理授权。
谁能够实际使 Repo key 完成签名属于 Runtime/signer 与未来组织治理问题。

一次 contribution 的 Asset 可用性规则为：

- `labour.references[]` 保留 labour 已明确建立在其上或引用的 confirmed
  upstream Asset 关系；当前 `repo.contribution@0.1.0` 不从该字段泛化推出
  “每个引用都必须已在本 Repo 本地持久化”的前置条件；
- `Record.data.assetId` 选中的结果 Asset 必须能够持久读取，并且必须出现在
  `labour.assets[]`；
- 同一 labour Record 中其他未被该 acceptance Record 选中的结果 Asset
  不会因此自动被该 Repo 接受，也不要求为了这一条 contribution 一并持久化；
- 一个 Asset 同时出现在 `references[]` 与 `assets[]` 时，如果它正是本次
  selected result，则当前请求对该 Asset 的 preserve/get 足以满足当前
  acceptance 的 Asset 可用性要求，不要求它因为 `references[]` 的出现而预先存在。

如果未来某个 concrete Protocol 确实需要某类 referenced Asset 作为本地执行
前置条件，该 Protocol 必须显式定义这条可用性语义，Repository 不从
`references[]` 本身统一推导。

因此一个上游 Asset 可以被多个后续 labour Records 引用，一个 labour Record
也可以产生多个结果 Asset，而无需 `previous`、`pid`、reverse edge 或 generic
relation Protocol。

缺失某个仅出现在 `labour.references[]` 的本地 Asset，不会使原本有效的
`labour.record@0.1.0` 失效，也不会仅凭这一点阻止当前
`repo.contribution@0.1.0` 达到 Repository committed。当前 acceptance
明确要求本地可用的是被 `Record.data.assetId` 选中的结果 Asset。

当前 labour + Asset contribution 不需要 Patch。Patch 继续作为未来某个具体
Protocol 的状态演化机制保留，但 #9 不定义 generic Patch schema，也不以
“未来可能需要 Patch”为当前实现前置条件。

Record 在 Repository 之外产生。Repository 不负责把 RawEntry 转换为 Record，
也不因为一次 contribution 而成为 labour Record 或 Repo acceptance Record
的事实生产者。Repo acceptance Record 的签名由外部 Runtime/signer 流程完成；
Repository #9 只消费并验证已经签名的事实。

Repo contribution 描述的是包含 Asset 提交的劳动。没有形成或提交 Asset 的劳动
仍然可以产生 labour Record，只是不构成当前 Repo contribution。

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

已经接受的 Asset 必须能够持久保存，并在正常应用重启后再次读取。

Member / Repo identity、Repo creation provenance 以及已接受 contribution 所需的 Repository 状态，在正常应用重启后必须能够恢复。Repo contributor 分组、标签和筛选条件属于产品软件数据，不构成链上恢复前提。

Repository 可以为正常运行和恢复持久保存 Repo-local operational/business state，例如未完成 request/submission 的 staging、处理阶段、retry/correlation、待投递状态以及人工维护的组织管理数据。它们是节点本地软件状态，可以跨重启存在，但不是 Protocol fact、Repository acceptance truth 或 chain consensus。具体数据库、collection、document identity 和 schema 不由产品要求固定。

对于 interrupted contribution，Runtime 可以用本地 staging/correlation 保存足以继续本节点原始操作的上下文，并在重启后与 durable Asset/Record facts 对账。只要最终 Repo acceptance Record `D` 尚未 durable accept，这些 staged state 都不能使 contribution 成为 Repository committed；`D` 已 durable 后，staging 清理或调用方回复失败也不能抹去已经成立的 committed。Runtime-local document identity 只用于本地存储/关联，不成为 canonical `ContributionId`。

Block/message 的本地打包、broadcast pending/retry 属于后续 chain/network delivery，不是 contribution acceptance 或 #10 recovery。网络投递失败不能把已经成立的 Repository `COMMITTED` 重新解释为未接受。

应用重启或运行时故障不得把尚未成功进入 Repository committed state 的 contribution 错误地暴露为已接受状态，也不得丢失已经 Repository committed、正在等待链收录的事实。

Repository Runtime 必须维护经过适用 Protocol 验证的 Record 关系、顺序/依赖和待打包状态。新的 Repository 领域 Record 在进入正常 accepted/pending-chain 路径时，应在同一 Runtime 写入边界内完成关系验证并可靠持久接收；这些关系状态用于后续验证、追溯和 Block packing，但不因此成为链确证来源。

Asset 的规范身份和语义由适用的 LabourChain Protocol 定义。当前 `asset.content@0.1.0` 要求 AssetId 与内容完整性可由持久内容重新验证；成功持久化后，重启不得得到不同 identity 或不同 bytes。精确重复写入应安全收敛为同一 Asset；同一 claimed AssetId 下出现不同 descriptor/bytes 时必须失败，不能静默替换。Repository 不应为了存储、索引或展示方便而改写已经接受的 Asset、Record、confirmation 或 contribution relation。


当前 #9 contribution 不需要 Patch：它的事实来源是 Member-signed labour Record 与 Repo-signed acceptance Record。Patch 只在未来某个具体 Protocol 真正定义可变状态演化时进入范围。Snapshot 仍只允许作为节点 Runtime 对 durable facts 的可重建物化结果，用于恢复、查询、索引或计算加速；Snapshot 不进入 Record 历史，不作为独立链上事实，也不得反向替代或覆盖事实历史。

被 Block 收录的 Record 确证事实来自链状态。Repository 可以保存本地 pending state、Record projection 和查询索引，使日常访问与恢复不需要为每次请求重新扫描完整链；这些运行时数据必须能够与 Block-confirmed facts 区分，不能成为新的链确证来源。

## Asset 读取与浏览

使用方可以通过稳定 AssetId 获取已经接受的 Asset，并区分目标 Asset 是否存在、存储读取是否失败以及持久内容是否损坏。

MVP 还需要支持查看 Repo 的 contributors 视图和 Assets。contributors 与 Repo Asset 列表都可以从已接受 contribution 派生；因此底层 Asset storage 只需要精确 preserve/get/has 能力，不为了浏览需求建立第二套 Repo→Asset registry。人工分组和筛选属于本地软件数据。

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
