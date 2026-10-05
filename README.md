# @labourchain/repository

[English](./README_EN.md)

`@labourchain/repository` 是 LabourChain 的仓库项目。

在 LabourChain 的模型中，Worker 是劳动主体，Core Record 是通用签名协议事实容器；劳动事实由 labour Protocol 通过 `Record.data = labourRecord` 表达。Asset 表示已经对象化的劳动成果。Repo 负责保存劳动成果，并在劳动者提交劳动成果时参与相关劳动的仓库侧处理。Repo contribution history 由相关劳动事实和关系投影得到，运行时可以为日常使用缓存这些视图。

Repository 采用 Cordis 的插件运行模型。仓库能力由多个 Cordis plugins 共同形成；其中需要被链上历史长期引用的稳定语义以版本化 LabourChain Protocol 声明，并由 Cordis plugin 实现。Repository 不建立独立于 Cordis 的 Runner、Hoster 或 mega-service 体系。

Requirements、Architecture 与 MVP Specs 已完成当前轮次的重新投影。当前 `main` 已包含 Bootstrap、durable Record journal、最小 Member runtime、Repo establishment、Runtime Record database、`labour.record@0.1.0`、exact ProtocolHash resolution、`asset.content@0.1.0` 与 durable Asset storage，以及 `repo.contribution@0.1.0` / Repository Contribution commit path；Core Protocols v0.1.0 已发布。下一条 MVP 主线是 #10 bounded Runtime crash recovery / reconciliation：它基于 Repo-local 可持久 staging/correlation 与既有 durable Asset/Record facts 恢复本节点未完成工作，不引入新的链上 acceptance-intent；#11 contribution history 仍待后续实现。

## 文档

本仓库的 `docs/` 是长期项目文档空间，不只保存开发需求，也维护 LabourChain 在 Repository 领域形成的概念、产品与架构说明。

当前主要入口：

- [`docs/concepts/`](./docs/concepts/)：长期概念基线与标准术语；
- [`docs/requirements.md`](./docs/requirements.md)：Repository 产品需求的唯一事实来源；
- [`docs/architecture.md`](./docs/architecture.md)：Repository 的 Design / Architecture，定义插件边界、运行结构和数据流；
- [`specs/repository-mvp.md`](./specs/repository-mvp.md)：MVP umbrella spec，维护能力组合、共享不变量与完成边界；
- [`specs/`](./specs/)：按稳定功能边界拆分的能力 Specs。

当前能力 Specs 包括 bootstrap、Member、`labour.record`、Repo、Protocol resolution、Asset / Asset storage、`repo.contribution`、contribution orchestration 和 contribution history。`labour.record@0.1.0` 只记录扁平的劳动内容、主观时长、可选时间日志与 Asset 引用；`asset.content@0.1.0` 已完成确定性 identity/integrity 与 durable storage；`repo.contribution@0.1.0` 已完成 Repo 对单个 labour result Asset 的正向采纳事实与 Repository `COMMITTED` 路径。Repo contributor/member 分组仍属于产品视图或本地软件数据，不建立链上 membership capability。

如果 Concepts、Requirements、Architecture、Spec 或实现出现冲突，应先在对应上游层显式讨论和修订，而不是让实现静默选择一种解释。

## 开发方式

本仓库采用：

```text
Concepts (`docs/concepts/`)
    长期领域概念基线

Requirements (`docs/requirements.md`)
        ↓
Design / Architecture (`docs/architecture.md`)
        ↓
Specs (`specs/`)
        ↓
Stories
        ↓
Tasks / Implementation (`src/`, `test/`)
```

Requirements 说明产品必须成立的行为；Architecture 说明系统结构、插件边界、依赖方向和数据流；Spec 将两者投影成稳定能力契约；Story 是可交付的开发增量；Task 是完成 Story 的具体工程动作。

Spec 不按 Task 一一拆分。一个稳定能力可以支撑多个 Stories，一个 Story 也可以同时受多个 Specs 约束。

## 架构概览

Repository 遵循 Cordis 的“万物皆插件”模型。

```text
Repository Node
=
Bootstrap Protocol instance
+ Cordis
+ loaded Protocol implementations (Cordis plugins)
+ Runtime / provider plugins
+ configuration
```

Bootstrap 是具有可执行入口的稳定版本代码，启动时创建 Cordis application。源码当前携带 `repository.bootstrap@0.1.0` reference；按 Core v0.1.0，只有构建出的 Protocol descriptor + ProtocolHash 才构成 exact Protocol identity。Cordis 启动后，Repository protocol、storage、index、projection 和 adapter 等能力继续按 Cordis plugin 组织。

当前 Bootstrap 提供可执行 shell 与 programmatic composition API；具体 Repository 产品 composition 尚未在 executable 中固定，也不在 Bootstrap Story 中引入额外 config loader。

Protocol 不形成第二套插件系统。每个 Protocol 的 executable implementation 仍然是 Cordis plugin；插件发现、依赖、Context、Service、Effect 和生命周期继续由 Cordis 管理。

详见 [`docs/architecture.md`](./docs/architecture.md)。

## 工程结构

当前仓库的文档与 Spec 已按 SDD 层级组织，具体 package boundary 仍由后续 Stories / Tasks 根据已接受的协议与生命周期边界形成：

```text
README.md               中文项目说明（权威版本）
README_EN.md            英文翻译
AGENTS.md               Agent 开发说明（英文）
docs/concepts/          概念基线与术语文档
docs/requirements.md    产品需求唯一事实来源
docs/architecture.md    Design / Architecture
specs/                  MVP umbrella + 稳定能力 Specs
src/                    Bootstrap runtime 与后续 Repository capability 实现
test/                   测试
scripts/                工程与发布检查脚本
.github/                 CI 与 PR 配置
```

具体 npm packages、monorepo 目录以及 Protocol implementation 的最终拆分不由 Spec 文件数量机械决定。

## 开发

环境：

- Node.js 22.20+ / 24+
- pnpm 11.7+

```bash
pnpm install
pnpm run check
pnpm run package:check
```

当前检查覆盖已实现的 Bootstrap、Cordis lifecycle、Record/Asset durability、exact Protocol resolution 与 Contribution runtime，但不代表 Repository MVP 已完成：#10 recovery、#11 contribution history，以及最终 concrete MVP composition / integrated lifecycle acceptance 仍未完成。

## 状态

当前 package 保持 `private: true`。

Bootstrap runtime、durable Record journal、`member.identity` runtime capability、`repo.establishment@0.1.0`、Runtime Record database、`labour.record@0.1.0`、#7 exact Protocol resolution、#8 Asset identity/storage 与 #9 Repository Contribution runtime 已完成并进入 `main`。#10 interrupted-contribution recovery 下一步是 bounded Runtime crash/reconciliation：staging/correlation 属于 Repo-local operational state，可持久但不是 Protocol / chain fact，也不改变 D-last `COMMITTED` 边界；#11 contribution history 仍未实现。默认 CLI/bin 的 concrete MVP composition 与完整 integrated lifecycle acceptance 也仍待完成。链上 Repo membership 已从 MVP 移除。
