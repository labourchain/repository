# @labourchain/repository

> Repository workspace and fact-storage capability for LabourChain, built as a spec-driven Cordis plugin.
>
> LabourChain 的 Repository 工作区与事实存储能力，采用 Spec-Driven Development，并以 Cordis 插件形式实现。

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
- retrieve stored facts without imposing project semantics.

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

### Spec-driven development

Behavior is specified before implementation.

The initial contract is defined in [`specs/0001-repository-mvp.md`](./specs/0001-repository-mvp.md). Any change that alters observable Repository behavior, invariants, or public service contracts must update or supersede the relevant spec before the implementation is considered complete.

Current scaffold rules:

1. no speculative domain model outside the accepted spec;
2. no import-time side effects;
3. Cordis-owned resources must be acquired and disposed through the plugin lifecycle;
4. service/provider dependencies must be explicit;
5. storage backends must remain replaceable;
6. tests must cover invariants and lifecycle behavior, not only happy-path functions;
7. the package remains `private` until the first usable implementation passes release review.

### Development

Requirements:

- Node.js 22.20+ (or a compatible newer release)
- pnpm 11.7+

```bash
pnpm install
pnpm run check
npm pack --dry-run
```

`pnpm run check` runs type checking, coverage-gated tests, and the production build.

### Repository structure

```text
.github/             CI and contribution workflow
specs/               normative behavior specifications
src/                 Cordis plugin implementation
test/                unit/lifecycle/contract tests
AGENTS.md             invariants and agent contribution rules
CONTRIBUTING.md       human contribution workflow
CHANGELOG.md          user-visible changes
```

### Contribution policy

Small, reviewable changes are preferred. A PR that changes behavior should identify the governing spec, add or update tests, and keep unrelated refactors separate. See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

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

### Spec-Driven Development

本仓库先写行为规范，再写实现。

第一份规范位于 [`specs/0001-repository-mvp.md`](./specs/0001-repository-mvp.md)。任何会改变 Repository 可观察行为、不变量或公共 Service Contract 的修改，都必须先修改或新增对应 Spec，随后实现和测试才算完成。

当前脚手架约束：

1. 不在已确认 Spec 之外提前发明领域模型；
2. 模块 import 时不得产生副作用；
3. Cordis 管理的资源必须跟随插件生命周期获取和释放；
4. Service/provider 依赖必须显式声明；
5. 存储后端必须可替换；
6. 测试不仅覆盖 happy path，还要覆盖不变量与生命周期；
7. 第一版可用实现通过发布审查前，npm package 保持 `private`。

### 开发

环境要求：

- Node.js 22.20+（或兼容的更新版本）
- pnpm 11.7+

```bash
pnpm install
pnpm run check
npm pack --dry-run
```

`pnpm run check` 会依次执行类型检查、带覆盖率门禁的测试和生产构建。

### 仓库结构

```text
.github/             CI 与贡献流程
specs/               规范性行为 Spec
src/                 Cordis 插件实现
test/                单元 / 生命周期 / Contract 测试
AGENTS.md             不变量与 Agent 开发规则
CONTRIBUTING.md       人类贡献流程
CHANGELOG.md          用户可见变更记录
```

### 贡献原则

优先小步、可审查的修改。任何改变行为的 PR 都应指出对应 Spec、同步补充或修改测试，并把无关重构拆开。具体见 [`CONTRIBUTING.md`](./CONTRIBUTING.md)。
