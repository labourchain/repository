# @labourchain/repository

[English](./README_EN.md)

LabourChain Repository 是保存、验证和组织劳动相关事实的 Repository 节点能力。Core Record 是通用签名事实容器，`labour.record@0.1.0` 表达劳动，`repo.contribution@0.1.0` 表达 Repo 对某项明确成果的正向采纳。Cordis 是唯一插件组合与生命周期系统。

> **2026-10 设计纠偏（文档先行）：** 原 #10 独立 Contribution Recovery 已撤回，相关运行时代码已在 #47 删除；Runtime DB 改为 **MongoDB 默认实现 + 窄抽象接口支持其他 DB**；#8 Asset / Asset Storage **延后实现／待返工**，旧代码不代表已验收的领域设计。#11 History、#39 MVP 组合暂缓，等待依赖边界收敛。

## 设计与规范

开发依据按层级保持：

```text
docs/concepts/ → docs/requirements.md
             → docs/architecture.md
             → specs/ → Issues/Stories → implementation
```

- [Requirements](./docs/requirements.md)：Repository 产品功能与权威边界。
- [Architecture](./docs/architecture.md)：Cordis、Core、Runtime DB 与领域责任。
- [MVP umbrella Spec](./specs/repository-mvp.md)：当前目标能力与进度状态。
- [Runtime Record Database Spec](./specs/runtime-record-database.md)：MongoDB 默认、provider-agnostic 接口（Draft，待实现）。
- [Asset Spec](./specs/asset.md) / [Asset Storage Spec](./specs/asset-storage.md)：**Deferred / 待返工**。
- [Contribution Spec](./specs/contribution.md)：保留签名字段，撤回独立 Recovery，DB/Asset 集成待修改。
- [Contribution History Spec](./specs/contribution-history.md)：Draft，后续投影与链状态查询。

旧设计已合并不等于产品认可；如有冲突，先修订 Requirements → Architecture → Specs，不让实现自行为设计背书。

## 已确认的领域关系

人类 Member、Repo 都复用 Core Entity identity。Repo establishment 是创建来源事实，不定义劳动成果的所有权。

`labour.record@0.1.0` 保留直接描述 `content`、主观 `duration`、可选 UTC 时间与已确认 `references[]/assets[]` 引用；不要求 `previous`、`pid` 或通用关系图。

Repo 正向采纳由 Repo-signed Core Record 表达：

```text
protocol: repo.contribution@0.1.0
createdBy: Repo EntityPublicKey
data: { labourRecordId, assetId, operator }
```

Repo 接受事实与 Block 确证分离：可靠持久的有效 D 是 Repository 接受标志，只有 accepted-Block/chain-state 才能证明链确证。临时业务状态或 MongoDB 保存本身不能变成链上证明。

## 运行架构（目标 vs 当前代码）

目标：

```text
Cordis + verified Protocol implementations
  -> Repository domain/Protocol services
  -> minimal persistent Record DB interface
  -> MongoDB provider (default; other DB adapters possible)
  -> persisted signed records and provider-enforced concrete uniqueness
```

**每个 Repo 仅由一个 Node 负责维护。** 参考 [Ri0n72Y/board](https://github.com/Ri0n72Y/board) 已使用的接口分离与 MongoDB provider 模式，但不拷贝 Board 的 `pid`、`patch`、tags、业务 schema。

**当前实现仍保留待替换的旧持久化代码和 Asset 存储；独立 Contribution Recovery 已在 #47 移除。** MongoDB provider 改造（#31）与 Asset 返工（#8）尚未实施；目标架构尚未全部落地。

DB 负责已经写入的数据在数据库故障/重启后的持久性；Node 重新启动后读取 DB 已存事实并重建必要的索引。不要求跨 Node 的 Repo 并发协调，也不需要自动续办未完成的 Contribution 请求或额外的 DB 恢复机制。

## 当前进度

| 领域 | 状态 |
| --- | --- |
| Bootstrap / Cordis、Member Runtime、Repo、labour.record、exact Protocol resolution | 已实现，保留 |
| Core Record 持久化 / Runtime DB | 旧实现存在，**MongoDB 默认 provider 改造待实现** |
| Asset / Asset Storage (#8) | 旧实现存在，**延后实现／待返工** |
| Repo Contribution (#9) | 签名事实与关系已确认，DB/Asset 编排待复核 |
| 独立 Recovery (#10 / #47) | **已撤回并删除运行时代码** |
| Contribution History (#11) | 暂缓实现 |
| Concrete MVP Composition (#39) | 暂缓，等待改造 |

参见 [MVP Issue #3](https://github.com/labourchain/repository/issues/3)。

## 当前开发与测试

此仓库仍是 `private: true` 的开发包。Node.js `^22.20.0 || >=24.0.0`，pnpm `11.7.0`：

```bash
pnpm install
pnpm run check
pnpm run test:core-release
```

现有 CI 反映**当前旧代码**的类型检查、测试、构建与发布包检查；通过 CI 不证明新的 MongoDB/Asset 产品设计已经落地。后续实现仍通过正常 PR + 独立 review + CI 验收。
