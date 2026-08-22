# @labourchain/repository

> Repository workspace and fact-storage capability for LabourChain, developed through a Requirements → Spec → Implementation workflow.
>
> LabourChain 的 Repository 工作区与事实存储能力，采用“需求 → Spec → 实现”的三层开发流程。

**Status / 状态:** early scaffold — not publishable yet / 早期脚手架——暂不发布

---

## English

### What this repository is

`@labourchain/repository` is the workspace and persistence boundary of LabourChain.

A Repository represents a workspace in which workers participate and contribute recognized LabourChain facts. It stores and validates Records and Assets, exposes stable retrieval capabilities, and maintains the worker-to-repository relationship required for contribution.

Its job is deliberately narrow:

- maintain a Repository workspace and its worker membership;
- accept already-recognized Records from upstream packages such as LabourFlow;
- store Records and Assets through replaceable persistence capabilities;
- validate accepted facts against LabourChain Core protocol rules;
- retrieve stored facts without imposing Project semantics.

### What this repository is not

Repository does **not**:

- turn raw natural-language entries into Records — that belongs to LabourFlow;
- group Records or Assets into Projects — that belongs to the Project/Board package;
- produce project plans, reviews, summaries, or other semantic analysis;
- define LabourChain Core protocol schemas;
- implement blockchain packing, consensus, peer sync, or chain settlement;
- treat MongoDB, Redis, indexes, caches, or other runtime state as canonical LabourChain facts.

A Project may organize Records and Assets that are available through one or more repositories or external sources. Repository itself remains storage- and validation-oriented rather than classification-oriented.

### Architecture boundary

```text
LabourFlow                    Board / Project
(raw entry -> Record)         (organize / plan / analyze)
       |                              |
       +------------+-----------------+
                    v
             Repository Service
       workspace / membership / store / verify
                    |
          +---------+---------+
          |                   |
          v                   v
   Core protocols       Runtime providers
   fact semantics       persistence / cache / IO
```

The dependency direction is intentional: Repository may consume Core validation and Runtime persistence capabilities, but Core and Runtime must not depend on Flow, Board, or Project semantics through Repository.

### Requirements → Spec → Implementation

This repository separates development into three maintained layers:

```text
Requirements / Features        Specifications              Implementation
        docs/                      specs/                  src/ + test/
          |                           |                         |
          | why / what                | exact contract          | executable behavior
          +-------------------------->+------------------------>+
```

1. **Requirements and features (`docs/`)** describe why the capability exists, what users need, the product boundary, and the feature catalog. Requirements use `REQ-*`; features use `FEAT-*`.
2. **Specifications (`specs/`)** translate accepted requirements/features into invariants, service contracts, error behavior, lifecycle rules, and acceptance tests. Specs use `SPEC-*` and must trace back to `REQ-*` / `FEAT-*`.
3. **Implementation (`src/`, `test/`)** satisfies the governing spec. Tests provide executable evidence that the contract is implemented.

The current documents are:

- [`docs/requirements.md`](./docs/requirements.md) — Repository requirements and product boundary;
- [`docs/features.md`](./docs/features.md) — MVP feature catalog and requirement mapping;
- [`specs/0001-repository-mvp.md`](./specs/0001-repository-mvp.md) — formal MVP contract.

If implementation reveals a missing product decision, move back up the chain and update Requirements/Features first rather than encoding the decision only in code.

### Source-only development artifacts

`docs/` and `specs/` are maintained in Git because they are useful development/vibe artifacts for humans and coding agents. They are **not runtime package contents**.

The npm package uses a positive `files` allowlist and CI verifies the actual tarball. `docs/`, `specs/`, tests, source files, agent instructions, contribution documents, and other development artifacts must not leak into the published plugin package.

The runtime package is intended to contain only built runtime files plus required package metadata/user-facing README/license.

### Development

Requirements:

- Node.js 22.20+ (or a compatible newer release)
- pnpm 11.7+

```bash
pnpm install
pnpm run check
pnpm run package:check
```

`pnpm run check` runs type checking, coverage-gated tests, and the production build. `pnpm run package:check` inspects the actual npm tarball and fails if development artifacts leak into it.

### Repository structure

```text
.github/             CI and contribution workflow
docs/                requirements and feature reasoning (source-only)
specs/               normative behavior specifications (source-only)
src/                 Cordis plugin implementation
test/                unit/lifecycle/contract tests
scripts/             development/release verification tools
AGENTS.md             invariants and agent contribution rules
CONTRIBUTING.md       human contribution workflow
CHANGELOG.md          user-visible changes
```

### Contribution policy

Small, reviewable changes are preferred. A behavior-changing PR should identify the governing requirement/feature/spec chain, add or update tests, and keep unrelated refactors separate. See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

## 中文

### 这个仓库是什么

`@labourchain/repository` 是 LabourChain 的**工作区与事实存储边界**。

一个 Repository 表示一个劳动者可以加入并贡献事实的工作区。它保存和验证 Record 与 Asset，提供稳定的读取能力，并维护“劳动者属于哪个 Repository”这一贡献关系。

它的职责刻意保持很薄：

- 维护 Repository 工作区及劳动者成员关系；
- 接收已经被 LabourFlow 等上游包识别完成的 Record；
- 通过可替换的持久化能力保存 Record 与 Asset；
- 按 LabourChain Core 协议规则验证进入仓库的事实；
- 提供事实读取能力，但不附加 Project 语义。

### 这个仓库不做什么

Repository **不负责**：

- 把自然语言 Raw Entry 转换成 Record——这是 LabourFlow 的职责；
- 按 Project 对 Record 或 Asset 分类聚合——这是 Project/Board 包的职责；
- 生成项目规划、回顾、总结或其他语义分析；
- 定义 LabourChain Core 协议 Schema；
- 实现区块打包、共识、节点同步或上链结算；
- 把 MongoDB、Redis、索引、缓存等运行时状态直接视为 LabourChain 的规范事实。

Project 可以组织来自 Repository、其他 Repository 或外部来源的 Records 与 Assets；Repository 本身只负责存放、验证与读取，不负责项目分类。

### 架构边界

```text
LabourFlow                    Board / Project
(raw entry -> Record)         (组织 / 规划 / 分析)
       |                              |
       +------------+-----------------+
                    v
             Repository Service
       工作区 / 成员关系 / 存放 / 验证
                    |
          +---------+---------+
          |                   |
          v                   v
      Core 协议            Runtime providers
      事实语义              持久化 / 缓存 / IO
```

依赖方向是刻意约束的：Repository 可以消费 Core 的验证能力和 Runtime 的持久化能力，但不得让 Core 或 Runtime 通过 Repository 反向依赖 Flow、Board 或 Project 语义。

### 需求 → Spec → 实现

本仓库把开发过程明确拆成三个长期维护的层次：

```text
需求 / 功能                  Spec                    实现
  docs/                     specs/                src/ + test/
    |                          |                       |
    | 为什么 / 要什么          | 精确可验证契约          | 可执行行为
    +------------------------->+---------------------->+
```

1. **需求与功能（`docs/`）**：说明为什么需要这个能力、用户要完成什么、产品边界在哪里，以及有哪些明确功能。需求使用 `REQ-*` 编号，功能使用 `FEAT-*` 编号。
2. **Spec（`specs/`）**：把已接受的需求/功能翻译成不变量、Service Contract、错误行为、生命周期规则和验收测试。Spec 使用 `SPEC-*` 编号，并必须能追溯到 `REQ-* / FEAT-*`。
3. **实现（`src/`、`test/`）**：只负责满足对应 Spec。测试是 Spec 被实现的可执行证据。

当前维护：

- [`docs/requirements.md`](./docs/requirements.md)：Repository 需求与产品边界；
- [`docs/features.md`](./docs/features.md)：MVP 功能清单与需求映射；
- [`specs/0001-repository-mvp.md`](./specs/0001-repository-mvp.md)：Repository MVP 的正式契约。

如果实现过程中发现缺少产品决策，应该沿链向上返回需求层补充，而不是只在代码里偷偷增加行为。

### docs/spec 是源码仓库副产物，不进入插件包

`docs/` 和 `specs/` 会保留在 Git 工程中，因为它们是人与 Coding Agent 在需求推理、Spec-Driven / vibe 开发过程中的开发资产。但它们**不是运行时产物**。

npm 包使用正向 `files` 白名单，并由 CI 检查真实 tarball。`docs/`、`specs/`、测试、源码、Agent 指令、贡献文档等开发副产物都不得进入最终插件包。

最终运行时包只应包含构建后的 runtime 文件，以及必要的 package metadata、用户 README 与 LICENSE。

### 开发

环境要求：

- Node.js 22.20+（或兼容的更新版本）
- pnpm 11.7+

```bash
pnpm install
pnpm run check
pnpm run package:check
```

`pnpm run check` 会依次执行类型检查、带覆盖率门禁的测试和生产构建；`pnpm run package:check` 会检查真实 npm tarball，如果开发副产物被误打包则直接失败。

### 仓库结构

```text
.github/             CI 与贡献流程
docs/                需求与功能文档（仅源码仓库）
specs/               规范性行为 Spec（仅源码仓库）
src/                 Cordis 插件实现
test/                单元 / 生命周期 / Contract 测试
scripts/             开发与发布验证工具
AGENTS.md             不变量与 Agent 开发规则
CONTRIBUTING.md       人类贡献流程
CHANGELOG.md          用户可见变更记录
```

### 贡献原则

优先小步、可审查的修改。任何改变行为的 PR 都应指出对应的“需求 → 功能 → Spec”链路，同步补充或修改测试，并把无关重构拆开。具体见 [`CONTRIBUTING.md`](./CONTRIBUTING.md)。
