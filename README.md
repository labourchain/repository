# LabourChain Repository

> Spec-driven Cordis service for LabourChain workspaces, worker relationships, records, and assets.

**Status:** pre-implementation. The repository is intentionally initialized from the specification before repository behavior is implemented.

[English](#english) · [中文](#中文)

---

## English

### What this repository is

`@labourchain/repository` is the workspace and fact-storage boundary of LabourChain.

Its job is deliberately narrow:

- represent a workspace/repository and its worker membership relationships;
- accept recognized LabourChain records and assets;
- validate stored objects through the relevant protocol capability;
- store, retrieve, and query records and assets;
- expose these capabilities as a lifecycle-managed Cordis service.

The Repository does **not** classify work into projects. A Project is an organization of records and assets implemented by the Board/project package above this layer.

The Repository also does **not** convert free-form input into a record. Raw input is transformed into a recognized record by LabourFlow before it reaches this service.

Runtime facilities such as MongoDB, Redis, external APIs, caches, or LLMs are replaceable providers. They are not Repository domain semantics. Runtime data may later be archived as LabourChain assets, but that archival decision is explicit.

### Position in LabourChain

```text
LabourFlow ── raw entry -> recognized record ──┐
                                               │
LabourBoard / Project ── records + assets ─────┼──> Repository
                                               │
Runtime providers ── storage / cache / I/O ────┘

Repository ── validates against ──> Core protocols
```

The dependency direction is intentional:

- Flow and Board may depend on Repository.
- Repository may depend on protocol capabilities and storage providers.
- Repository must not depend on Flow, Board, Project analysis, or DSH UI.

### MVP boundary

The first usable version is for a small team and only needs to close this loop:

1. create/open a workspace;
2. maintain worker membership;
3. accept an already-recognized record or asset;
4. reject invalid or unauthorized writes;
5. persist the accepted object;
6. retrieve/query it for Flow and Board.

Out of scope for the MVP:

- raw-entry parsing or LLM extraction;
- project grouping, planning, review, or analytics;
- blockchain consensus, block packing, P2P sync, or token logic;
- MongoDB/Redis-specific semantics in the domain API;
- implicit archival of runtime/cache data.

See [`SPEC.md`](./SPEC.md) for the normative requirements.

### Cordis design rules

This package follows Cordis as a capability/lifecycle framework:

- the public Repository API is exposed as a named `Service`;
- required capabilities are declared with `inject` rather than discovered through hidden globals;
- resources with cleanup requirements belong to the plugin lifecycle and must be disposed through Cordis effects/providers;
- storage implementations are replaceable providers rather than branches inside repository domain logic;
- service names are LabourChain-prefixed to avoid collisions in Cordis' shared namespace.

The planned service name is `labourchainRepository`.

### Spec-driven development

`SPEC.md` is normative for product and domain behavior.

For behavior changes:

1. change or extend the spec first;
2. assign/update requirement IDs;
3. review the semantic change independently from implementation details;
4. implement the smallest slice that satisfies the accepted requirements;
5. add tests that cite the corresponding requirement IDs;
6. run `pnpm check` before merge.

Implementation PRs must state which `REP-*` requirements they satisfy. Code that introduces behavior not described by the spec is incomplete, even if it passes tests.

### Repository layout

```text
.
├── SPEC.md                 # normative English specification
├── AGENTS.md               # contributor/agent engineering rules
├── CONTRIBUTING.md         # contribution workflow
├── src/                    # Cordis plugin/service implementation
├── tests/                  # behavior and lifecycle tests
└── .github/workflows/      # CI gates
```

### Development

Requirements:

- Node.js `^22.19.0 || >=24.0.0`
- pnpm `11.7.0`

```bash
pnpm install
pnpm check
```

Useful commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
```

The package remains private until the service contract and first MVP implementation are accepted. Publishing is a release decision, not part of repository initialization.

### Contributing

Read, in order:

1. [`SPEC.md`](./SPEC.md)
2. [`AGENTS.md`](./AGENTS.md)
3. [`CONTRIBUTING.md`](./CONTRIBUTING.md)

Prefer small, reviewable changes. Do not combine protocol redesign, repository behavior, runtime-provider work, and product UI work in one change.

---

## 中文

### 这个仓库是什么

`@labourchain/repository` 是 LabourChain 的工作区与事实存储边界。

它的职责刻意保持很薄：

- 表达 workspace/repository 及其劳动者成员关系；
- 接收已经被识别的 LabourChain Record 与 Asset；
- 通过对应协议能力验证待存对象；
- 存储、读取和查询 Record 与 Asset；
- 以受 Cordis 生命周期管理的 Service 对外提供这些能力。

Repository **不负责**按照 Project 对劳动进行分类聚合。Project 是对 records 与 assets 的组织，由更上层的 Board/project package 提供。

Repository 也**不负责**把自由文本转换成 Record。Raw Entry 必须先经过 LabourFlow 转换为可识别的 Record，再进入 Repository。

MongoDB、Redis、外部 API、缓存、LLM 等属于可替换的 Runtime Provider，而不是 Repository 的领域语义。Runtime 数据未来可以被明确归档为 LabourChain Asset，但这一过程必须是显式的，不能默认发生。

### 在 LabourChain 中的位置

```text
LabourFlow ── raw entry -> recognized record ──┐
                                               │
LabourBoard / Project ── records + assets ─────┼──> Repository
                                               │
Runtime providers ── storage / cache / I/O ────┘

Repository ── validates against ──> Core protocols
```

依赖方向是明确约束：

- Flow 与 Board 可以依赖 Repository；
- Repository 可以依赖协议能力与存储 Provider；
- Repository 不得反向依赖 Flow、Board、Project 分析逻辑或 DSH UI。

### MVP 边界

第一版只面向一个小团队，闭环如下：

1. 创建/打开一个 workspace；
2. 维护劳动者成员关系；
3. 接收已经识别完成的 Record 或 Asset；
4. 拒绝无效或无权写入的数据；
5. 持久化被接受的对象；
6. 为 Flow 与 Board 提供读取/查询。

MVP 当前不做：

- Raw Entry 解析或 LLM 提取；
- Project 分类、规划、复盘或分析；
- 区块链共识、区块打包、P2P 同步或 token 逻辑；
- 把 MongoDB/Redis 的具体实现写进领域 API；
- 自动把 Runtime/缓存数据当作 Asset 归档。

规范性要求见 [`SPEC.md`](./SPEC.md)。

### Cordis 设计规则

本包把 Cordis 作为能力与生命周期框架使用：

- Repository 公共 API 通过具名 `Service` 暴露；
- 必要依赖使用 `inject` 声明，不通过隐藏全局对象查找；
- 需要清理的资源必须进入 Cordis 生命周期，由 effect/provider 负责释放；
- 存储实现作为可替换 Provider，不在 Repository 领域逻辑中写 Mongo/Redis 分支；
- Service 名称使用 LabourChain 前缀，避免 Cordis 共享命名空间中的冲突。

计划使用的 Service 名称为 `labourchainRepository`。

### Spec Driven 开发

`SPEC.md` 是产品行为和领域行为的规范来源。

涉及行为变化时：

1. 先修改或扩展 spec；
2. 分配/更新 requirement ID；
3. 先独立审查语义变化，而不是直接讨论实现细节；
4. 只实现满足已接受要求的最小切片；
5. 测试中对应标明 requirement ID；
6. 合并前运行 `pnpm check`。

实现 PR 必须说明满足了哪些 `REP-*` 条目。即使代码测试通过，如果引入了 spec 未描述的新行为，也视为未完成。

### 仓库结构

```text
.
├── SPEC.md                 # 英文规范，唯一规范性定义
├── AGENTS.md               # 工程与 Agent 约束
├── CONTRIBUTING.md         # contribution 流程
├── src/                    # Cordis plugin/service 实现
├── tests/                  # 行为与生命周期测试
└── .github/workflows/      # CI 门禁
```

### 开发

环境要求：

- Node.js `^22.19.0 || >=24.0.0`
- pnpm `11.7.0`

```bash
pnpm install
pnpm check
```

常用命令：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
```

在 Service contract 与首个 MVP 实现完成评审之前，package 保持 private。发布属于后续 release 决策，不属于本次仓库初始化范围。

### 参与贡献

请按顺序阅读：

1. [`SPEC.md`](./SPEC.md)
2. [`AGENTS.md`](./AGENTS.md)
3. [`CONTRIBUTING.md`](./CONTRIBUTING.md)

优先提交小而可审查的修改。不要在同一个改动里同时做协议重构、Repository 行为、Runtime Provider 和产品 UI。