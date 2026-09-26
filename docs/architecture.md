# Repository Architecture

Repository 采用 Cordis 的插件运行模型组织仓库能力。本页描述 Repository 的系统结构、插件边界、运行关系和数据流，是 `docs/requirements.md` 到 `specs/` 之间的 Design / Architecture 层。

当前 Architecture 只固定已经确认的结构原则。具体 Protocol 字段、包名、存储实现和 API 形式在进入 Spec 前不锁定。

## 架构原则

Repository 遵循 Cordis 的“万物皆插件”模型。能够独立装载、替换、声明依赖或管理生命周期的能力，默认以 Cordis plugin 组织。

Repository 不在 Cordis 之外再建立一套 Runner、Hoster、Plugin Manager、Service Container 或生命周期系统。插件发现、依赖、Context、Service、Effect 和生命周期由 Cordis 提供。

LabourChain 在 Cordis plugin 运行模型之上增加的是链上 Protocol 的稳定语义：需要被历史事实长期引用的协议行为以版本化 Protocol 声明，并由 Cordis plugin 作为其 executable implementation。

```text
LabourChain Protocol
└── executable implementation = Cordis plugin

Cordis plugins without chain-stable semantics
└── Runtime / product plugins
    └── 存储、索引、适配、展示等运行能力
```

Protocol 与 Cordis Plugin 描述不同层级：前者是链上稳定语义与身份，后者是唯一运行时插件抽象。不建立第二套插件类型系统。

## Bootstrap

Repository 的可执行运行环境由一个稳定版本的 bootstrap 代码启动。

Bootstrap 的特殊之处只有一点：它具有可以由 Node.js / 操作系统直接启动的入口，并在启动时创建 Cordis application。Cordis 启动后，其余能力仍按普通插件方式装载和运行。

Bootstrap 自身的稳定代码版本使用 Protocol 的格式声明。因此，一个正在运行的节点可以理解为某个 Bootstrap Protocol 版本的实例。

```mermaid
flowchart TD
    OS["Node.js / OS"]
    Bootstrap["Bootstrap Protocol instance"]
    Cordis["Cordis application"]
    Protocols["Protocol implementations\n(Cordis plugins)"]
    Runtime["Runtime / provider plugins"]
    Products["Product / adapter plugins"]

    OS --> Bootstrap
    Bootstrap --> Cordis
    Cordis --> Protocols
    Cordis --> Runtime
    Cordis --> Products
```

Bootstrap 不因此成为 Cordis 之外的协议管理层。它负责把运行环境启动起来，随后使用 Cordis 本身的插件机制。

Bootstrap 声明其兼容的 Cordis 版本范围，并与所加载插件共享同一个 Cordis runtime。当前不要求 Bootstrap Protocol 固定到某个精确的 Cordis patch 版本，也没有必要再建立独立的 execution-profile 或 runner-version 模型。

## Node

一个 LabourChain Repository node 是某个 Bootstrap Protocol 版本的运行实例，以及该实例加载的 Cordis plugins、providers 和配置。

```text
Repository Node
=
Bootstrap Protocol instance
+ Cordis
+ loaded plugins
+ runtime providers
+ configuration
```

节点具有哪些 Repository 能力，取决于实际加载了哪些插件，而不是一个固定的 Repository mega-service。

## Protocol implementation

LabourChain Protocol 定义链上稳定语义和协议版本；对应 executable implementation 是 Cordis plugin。

协议版本与实现一起演进。已经存在并可能被历史事实引用的协议版本不通过在同一个实现中修改分支语义来升级；新的协议语义使用新的版本实现。

```text
Protocol A v1 -> Cordis plugin implementation
Protocol A v2 -> Cordis plugin implementation
```

同一节点可以按需要同时加载多个协议版本或多个历史 Protocol artifacts。人类可读的 `name@version` 用于表达 Protocol reference，但历史解释和验证的机器权威是事实实际携带的 exact `ProtocolHash`。节点不能仅凭相同版本号、兼容范围或本地最新版本选择 implementation。

历史解析必须以 `ProtocolHash` 精确取得对应 descriptor / executable artifact，使用 Core 提供的验证边界核对 descriptor、artifact 与 hash，并确认其人类可读 Protocol reference 与事实声明一致。缺失 exact hash 时必须失败，不能 fallback 到 `latest`、同版本的另一 artifact 或“看起来兼容”的实现。

Protocol 的具体发现形式和包命名在 Spec 阶段确定。Architecture 不建立第二套插件管理器；验证后的 executable implementation 仍通过 Cordis 被加载。

## 插件边界

Cordis plugins 不按照 CRUD 操作或单个 Requirement 机械拆分。

拆分主要服从协议边界、版本边界和生命周期。一起升级、一起加载、一起失效且没有独立运行价值的紧密协议可以由同一个 Cordis plugin 实现；能够被其他产品独立复用的协议应避免与 Repository 产品运行时绑定。

Member、Repo、Asset 和 contribution relation 都应首先按各自协议边界提供可组合能力。LabourFlow 等上层产品可以只加载所需协议，不应为了使用同 identity 的 Member + Repo 能力而加载完整 Repository 产品运行时。

Contribution history 属于事实的 view / projection。它可以由插件提供查询、索引或缓存能力，但不需要为了概念完整性固定建立一个 History Protocol。

## Core、Record ingress 与链确证边界

当前 LabourChain Core 提供 `core.protocol`、`core.record`、`core.entity`、`core.block` 等确定性协议原语。它们定义数据结构、身份表示、Record/Block 校验和密码学边界，但不因此成为一个固定的数据库、Record store、网络节点或 Repository 专用 commit service。

Core 当前同时明确：Block Chain 表达 Record 被这条链收录和确证的顺序；Runtime arrival / queue order 不具有链确证语义。因此 Repository 不把“本地持久接收 Record”和“Record 已被 Block 确认”混成一个 canonical 状态。

Repository node 需要区分三类运行能力：

```text
Durable Record ingress / journal
    -> 持久保存 exact accepted Records
    -> 在 Block packing 之前跨重启保留 pending-chain Records
    -> 不负责 Repository 领域关系验证
    -> 不宣称这些 Records 已经被链确证

Runtime Record database
    -> 提供同一 Repository Runtime 的 serialized Record ingress boundary
    -> 复用 journal 的 exact Record durability
    -> 具体关系、顺序/依赖和 pending packing state 由首个实际 Protocol consumer 定义
    -> 不预设通用关系 schema、查询语言或状态容器
    -> 不是 canonical chain state

Chain-state / Block-confirmation access
    -> 查询哪些 Records 已经被有效 Block 收录
    -> 提供链确证顺序与 block reference
    -> 用于状态升级、对账和 projection rebuild
```

三者可以由同一个未来 node/runtime 实现，也可以作为不同 Cordis providers 组合；Architecture 不锁定 package、数据库或网络实现。当前 Runtime Record database 只实现最小共享写入边界；待 #9 出现第一个具体 contribution relation consumer 时，再按实际需要定义最小关系状态，不预设通用 DAG schema、SQL 模型、namespace state framework 或 packer API。

Repository 领域插件消费这些运行能力，但不通过 `repo.records[]` 或第二套链来替代 Core Block / canonical-chain 语义。


## Repo Runtime 与链上信任边界

Repository Runtime 是正常节点生成、接收、校验、组织和打包候选事实的执行路径，但它不是 LabourChain 的最终可信执行边界。节点可以使用官方开源 Repository 与 Protocol plugins 形成自洽的候选 Records，也可以使用等价实现；一个恶意或非标准节点甚至可以绕过正常 Repository 流程手工构造候选 Block。链上有效性不能建立在“生产者确实运行了官方 Repo 代码”这一假设上。

Block 被其他节点接受之前，Repository 本地的 pending / candidate state 都可以继续被修订、替换或放弃。这里需要区分两种不同的不变性：

```text
specific signed Record
    -> RecordId / signature 约束这个具体 Record 的内容
    -> 修改其签名覆盖的内容后，原 RecordId / signature 不再证明修改后的值
    -> 若要形成新的有效事实，应重新形成对应的有效 Record

candidate set before Block confirmation
    -> Repo 可以选择、替换、追加或放弃待打包 Records
    -> journal / Runtime database 只描述节点当前接受和准备处理的状态
    -> 这些状态本身不是 canonical chain truth
```

因此 Repository 的本地 validation 主要服务于正常节点的运行自洽、恢复、关系维护和打包准备。它可以尽早拒绝明显非法的事实，但 peer node 不信任生产节点已经执行过这些检查，也不把 Runtime database、journal、snapshot 或本地 plugin 执行结果作为链级证明。

当下一版 Core Block packing 能力实现后，Header 只增加由 Records 自身确定性派生的 `vroot`。Block 不保存第二份 ValidationManifest，也不在 Header 重复列出 Runtime plugin / Protocol composition：

```text
Block.records[]
    -> extract (protocol, protocolHash)
    -> reject same protocol / different hash ambiguity
    -> deduplicate
    -> canonical sort
    -> JCS
    -> DoubleSHA256
    -> Header.vroot

Peer validator
    -> L0: recompute recordsRoot + vroot and verify Block signature
    -> L1: read exact ProtocolHash values from actual Records
    -> resolve / verify exact Protocol implementations and dependencies
    -> independently validate Record semantics and Protocol-defined relations
    -> accept Block only after validation succeeds
```

Peer validation 不依赖生产节点之前使用了什么内存对象、snapshot 或执行路径，而只依赖 Block 实际提交的数据及其绑定的验证语义。当前 LabourChain 不要求像通用智能合约平台那样建立一套加密虚拟机或把所有 Repository 执行过程复制到链上；需要重放的是对应 Protocol 对 Block 内容及关系的确定性验证。

Block 内的 Records 可以按照适用 Protocol 建立一个或多个有逻辑的生产关系结构。劳动与 Asset 的输入/输出关系自然形成 tree / forest，必要时可表现为更一般的依赖图；L1 validation 必须使用 Records 直接引用的 exact Protocol semantics 重建并验证这些关系。Repo ownership、decision operator 等非生产因果事实不因此被强行塞入同一棵生产树，也不重新引入 `previous` 链。

当前 Repository MVP 只建立支持未来打包所需的 Runtime 边界，不实现完整 Block packer、`vroot` Core contract、peer validator、节点同步或共识。

## Repository 与其他 LabourChain 组件

```mermaid
flowchart LR
    subgraph Products["Products"]
        Flow["LabourFlow"]
        Board["LabourBoard"]
        Client["Repository Client"]
    end

    subgraph Node["Repository Node"]
        Bootstrap["Bootstrap"]
        Cordis["Cordis"]
        MemberProtocols["Member Protocol implementations"]
        RepoProtocols["Repo Protocol implementations"]
        Journal["Durable Record ingress / journal"]
        RuntimeDB["Runtime Record database"]
        ChainState["Chain-state / Block-confirmation adapter"]
        Providers["Asset / index / staging providers"]
        Views["Projection / adapter plugins"]
    end

    subgraph Core["LabourChain Core primitives"]
        Protocol["Protocol identity / verification"]
        Entity["Entity identity"]
        Record["Record validation / identity"]
        Block["Block validation / identity"]
    end

    Bootstrap --> Cordis
    Cordis --> MemberProtocols
    Cordis --> RepoProtocols
    Cordis --> Journal
    Cordis --> RuntimeDB
    Cordis --> ChainState
    Cordis --> Providers
    Cordis --> Views

    Flow --> Cordis
    Board --> Cordis
    Client --> Cordis

    MemberProtocols --> Protocol
    MemberProtocols --> Entity
    RepoProtocols --> Protocol
    RepoProtocols --> Entity
    RepoProtocols --> Record
    RepoProtocols --> RuntimeDB
    RuntimeDB --> Journal
    Views --> Journal
    Views --> ChainState
    ChainState --> Block
```

Repository 不重新定义 Core 已有的 Protocol、Record、Entity identity、signature 或 Block 语义。Member、Repo、Asset、confirmation、Repo establishment、Repo decision 与 contribution relation 等领域语义由各自适用的上层 Protocol 定义。

Member 与 Repo 都是同一类组合原则：先有 Core Entity identity，再通过协议获得领域语义。一个 Entity identity/keypair 可以同时满足 Member 与 Repo 协议；这种组合不产生第二个 identity。Repo establishment 所表达的 ownership 只针对 Repo identity 的建立、控制与责任来源，不自动扩展为 Asset 或劳动成果的私人财产权。

LabourFlow 可以在同 identity Member + Repo 协议组合之上提供面向个人的产品体验，但它不需要创建一个嵌套 `PersonalRepo` entity，也不改变底层 Repo 协议。

## Repo establishment、ownership 与操作留痕

Repo 是以 Core `EntityPublicKey` 为身份锚点的协议组合，不继承或扩展 Core `Entity` 对象。

Repo establishment 的发起方必须是一个已经满足 Member 协议的 Entity identity。集体 Repo 可以使用另一个独立的 Repo Entity identity；Member-scoped Repo 也允许 Member 与 Repo 使用同一个 identity/keypair。

MVP 的 Repo establishment 使用一个 establishment Record 表达最小事实：

```text
Record.createdBy
= Repo EntityPublicKey
= signature authority for establishment

Record.data.owner
= initial owner Member EntityPublicKey
```

Repo establishment 由 Repo key 自签，因此建立事实能够证明对应 Repo identity 的 key participation；初始 owner 来自该 Repo-signed Record 的 `data.owner`。这里的 ownership 只描述 Repo identity 的建立、控制与责任来源，不表示 owner 拥有 Repo 中的 Asset 或劳动成果。Core `Entity.introducedBy` 也不用于表达 ownership、operator 或组织成员关系。

Repo 后续采取需要链上留痕的决定时，决定 Record 由 Repo identity 的 private key 签名，并在该 Protocol 的签名 payload / data 中标注实际 `operator: EntityPublicKey`。operator 是单次行为的责任留痕，不是持久角色、membership、ACL 或组织授权证明。谁可以操作 Repo key、owner 如何变更、多人如何治理属于后续组织治理层。

劳动者与 Repo 不建立额外链上 membership。产品可以从 accepted contributions 派生 contributor/member 视图，也可以在本地软件中维护人员分组、标签和筛选条件；这些运行数据不参与链级 validity。

一个 establishment Record 可以处于两个不同的确认层级：

```text
accepted/pending-chain
    -> 已进入 durable Record journal
    -> Repository 可以恢复并加载该 Repo

block-confirmed
    -> establishment Record 已被有效 Block 收录
    -> 获得链确证状态
```

建立与重新加载的数据流为：

```mermaid
sequenceDiagram
    participant Owner as Owner Member / Client
    participant Cordis as Cordis
    participant MemberProtocol as Member Protocol capability
    participant Repo as Repo Protocol capability
    participant Journal as Durable Record journal
    participant Index as Runtime Repo index
    participant Chain as Chain-state adapter

    Owner->>Cordis: submit Repo-signed establishment
    Cordis->>MemberProtocol: require owner Member
    MemberProtocol-->>Cordis: valid owner identity
    Cordis->>Repo: validate establishment Record
    Repo->>Journal: durably accept establishment Record
    Journal-->>Repo: accepted RecordId
    Repo->>Index: index Repo identity -> RecordId
    Repo-->>Owner: Repo established

    Owner->>Cordis: load Repo identity
    Cordis->>Repo: resolve Repo
    Repo->>Index: lookup RecordId
    Repo->>Journal: read accepted establishment Record
    Journal-->>Repo: establishment Record
    opt chain confirmation status requested/available
        Repo->>Chain: lookup RecordId inclusion
        Chain-->>Repo: pending or block-confirmed
    end
    Repo-->>Owner: Repo + owner/status
```

Runtime Repo index 只是加速 lookup 的可替换数据。initial owner 来自 Repo-signed establishment Record 的 `data.owner`。缺失或陈旧的 index 不能创造第二个 owner；index 可以通过 durable journal，以及在可用时通过 chain state 重新对账。

## Contribution 数据流

Repo contribution 不是普通 CRUD。Member 已经在 Repository 之外产生 Record，并可形成或修改 Asset；Repository 接收的是 Asset contribution，并参与该劳动的 Repo 侧确证。

当前流程为：

```mermaid
sequenceDiagram
    participant Consumer as Flow / Contributor
    participant Cordis as Cordis
    participant Protocol as Repository Protocol implementation
    participant Stage as Runtime staging provider
    participant Assets as Asset provider
    participant Journal as Durable Record journal
    participant Chain as Chain-state adapter

    Consumer->>Cordis: Asset + Record + relations
    Cordis->>Protocol: execute applicable protocol semantics
    Protocol->>Protocol: validate labourer, Asset and contribution relations
    Protocol->>Stage: stage contribution
    Protocol->>Protocol: verify required labour-subject and Repo confirmations; retain Repo operator trace
    Protocol->>Journal: durably accept resulting Records
    Journal-->>Protocol: accepted/pending-chain
    Protocol->>Assets: finalize durable accepted Asset
    Assets-->>Protocol: retrievable
    Protocol->>Stage: reconcile / clear runtime state
    Protocol-->>Consumer: Repository committed / accepted

    Note over Journal,Chain: Later, outside Repository acceptance and this MVP flow
    Note over Journal,Chain: A future chain runtime may pack candidate Records and peers independently validate the resulting Block
    Chain-->>Protocol: block-confirmed status only after accepted-chain evidence includes the Records
```

Contribution 的协议语义由对应 Protocol 定义；其 implementation 由 Cordis 负责运行，不额外引入一个把状态机写死的 Repository Runner。Record ingress/journal、Runtime Record database 与 chain-state access 是三个不同职责：journal 保存 exact accepted Records；当前 Runtime Record database 提供共享 serialized ingress boundary；#9 出现首个具体 relation consumer 后，再由相应 Protocol 定义实际需要维护的关系、顺序/依赖和待打包状态；chain state 回答已收录 Block 的链确证状态。Runtime Record database 不是第二条 blockchain，也不取代 Core Block / canonical-chain 语义。

## Contribution 状态

Repository execution 与 chain confirmation 是两个不同维度，不再串成一个把“本地打包”误当作“链确证”的单一状态机。

Repository execution：

```mermaid
stateDiagram-v2
    [*] --> STAGED
    STAGED --> DOMAIN_CONFIRMED: required domain confirmations satisfied
    DOMAIN_CONFIRMED --> COMMITTED: durable Record ingress + accepted Asset durable
```

`STAGED` 是临时运行时处理状态，不是已接受 contribution。

`DOMAIN_CONFIRMED` 表示 contribution 已满足适用 Protocol 要求的领域确认条件，但仍未达到 Repository acceptance。这个名称明确区别于链上的 Block confirmation。

`COMMITTED` 是 Repository 的 durable acceptance 边界：所需 Records 已进入可跨重启恢复的 durable journal，accepted Asset 已可持久读取。

Chain confirmation 另行表示：

```text
pending-chain
    -> block-confirmed
```

`pending-chain` 表示 Repository 已接受但尚无 accepted-chain evidence。只有 chain-state / accepted Block evidence 表明相关 Records 已进入一个经过独立验证并被接受的 Block，才能标记为 `block-confirmed`。

本地把 Records 放入 candidate Block、生成 Block 文件或完成打包动作本身都不构成这个状态跃迁。Block packing 是未来链运行过程中的生产步骤；peer validation / accepted-chain evidence 才决定链确证。

## 数据与投影

Repository 不以领域 service-owned state 复制链确证事实。

需要区分四类 Runtime 数据：

```text
1. durable pending/accepted journal
   - 保存 Repository 已接受但可能尚未被 Block 收录的 exact Records
   - 在其安全进入链或交给等价 durable node runtime 前不能任意丢弃
   - 不是 Block confirmation

2. Runtime Record database
   - 维护通过适用 Protocol 验证后的 Record 关系、顺序/依赖与 pending packing state
   - Repository 的关系验证、追溯和后续 Block packing 消费这一层
   - 可以从 durable Records + exact Protocol semantics 重建/对账，但运行时不是纯查询缓存
   - 不自行赋予 Block confirmation，也不是 canonical-chain 数据库

3. staging
   - contribution 处理中的临时/恢复状态
   - 未达到 Repository acceptance

4. index / cache / projection
   - 查询与展示加速数据
   - 可由 Runtime Record database、journal 与 chain state 派生或重建
```

Runtime 还可以保存：

- Asset payload 或其他协议允许的持久内容；
- Repo identity -> establishment RecordId 等领域关系索引；
- 用于验证与打包的 Record relationship / dependency indexes；
- Asset 查询索引；
- contribution history projection；
- cache 和其他可重建运行数据。

本地持久化不会使 pending Record 自动变成 Block-confirmed fact。相反，chain-state adapter 也不负责 Repo 领域语义；它只回答 Record 是否已被链收录等链状态问题。

Contribution history 可以同时展示 Repository committed/pending-chain 与 block-confirmed contributions，但必须明确区分状态。

Repository 不维护一个将所有链 Records 归 Repository 所有的规范 `repo.records[]`。


Repo 中需要更新的事实状态沿用 Record + Patch 的演化方式，而不是把某个完整 Snapshot 反复写回事实历史。具体 Patch Protocol / schema 由相应领域 Spec 定义，但 Architecture 固定以下数据角色：

```text
Record + Patch history
    -> 可验证的事实与事实变更来源
    -> 进入 Block 时按适用 Protocol 被独立验证

Snapshot
    -> 节点按当前可用事实和 exact Protocol semantics 物化出的运行时状态
    -> 用于快速恢复、读取、索引或计算
    -> 可以丢弃并重新计算
    -> 不进入 Record history，也不作为新的事实来源
```

Snapshot 因此不能反向覆盖 Record / Patch history，也不能仅因被某个 Repo Runtime 缓存就获得链上权威。节点升级、插件切换或缓存重建时，可以重新从事实历史计算 Snapshot，而不改写已经存在的事实。

## Cordis 生命周期

插件资源、依赖和运行时副作用服从 Cordis 生命周期。

Repository Architecture 不另行定义插件 activate / deactivate、依赖注入或 HMR 体系。插件需要的外部资源通过 Cordis 生命周期获取和释放，避免重复激活造成资源泄漏或全局状态污染。

## MVP 边界

Architecture 当前不锁定：

- 具体 npm package 名称和 monorepo 目录；
- Protocol metadata 最终字段；
- `member.profile` 的完整字段、更新和隐私模型；
- durable Record journal 的最终 package/service/API 形式；
- chain-state adapter 的最终 package/service/API 形式；
- MongoDB、PostgreSQL、filesystem 等持久化实现；
- HTTP / REST / WebSocket 接口；
- UI；
- 高级 ACL 和角色体系；
- 所有权、私人财产和收益分配协议；
- 搜索引擎；
- Project / Board 业务；
- Block packing 内部实现；
- 节点同步；
- 私有证明、收益分配和结算机制。

这些内容只有在 Requirement 明确进入范围后，或现有 Requirement 的实现确实需要稳定的结构边界时，才继续投影到 Design、Spec 和实现。
