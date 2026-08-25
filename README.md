# @labourchain/repository

[English](./README_EN.md)

`@labourchain/repository` 是 LabourChain 的仓库项目。

在 LabourChain 的模型中，Worker 是劳动主体，Record 记录活劳动，Asset 表示已经对象化的劳动成果。Repo 负责保存劳动成果，并在劳动者提交劳动成果时参与相关劳动的仓库侧确证。Repo contribution history 由链上的劳动事实和关系投影得到，运行时可以为日常使用缓存这些视图。

Repository 采用 Cordis 的插件运行模型。仓库能力由多个 Cordis plugins 共同形成；其中定义链上稳定语义的插件同时声明为版本化 LabourChain Protocol。Repository 不建立独立于 Cordis 的 Runner、Hoster 或 mega-service 体系。

当前仓库处于 Design / Architecture 收敛阶段，Spec 与实现暂不作为最新架构事实来源。

## 文档

本仓库的 `docs/` 是长期项目文档空间，不只保存开发需求，也维护 LabourChain 在 Repository 领域形成的概念、产品与架构说明。

当前主要入口：

- [`docs/concepts/`](./docs/concepts/)：长期概念基线与标准术语；
- [`docs/requirements.md`](./docs/requirements.md)：Repository 产品需求的唯一事实来源；
- [`docs/architecture.md`](./docs/architecture.md)：Repository 的 Design / Architecture，定义插件边界、运行结构和数据流；
- [`specs/repository-mvp.md`](./specs/repository-mvp.md)：由 Requirement 与 Architecture 投影出的工程契约。当前文件仍待按最新 Design 重审。

`docs/concepts/` 按主题拆分概念文档，并由 [`docs/concepts/README.md`](./docs/concepts/README.md) 维护统一概念表和导航。概念基线用于长期对照，但不会替代需求层。

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
Spec (`specs/`)
        ↓
Task / Implementation (`src/`, `test/`)
```

Requirements 说明产品必须成立的行为；Architecture 说明系统结构、插件边界、依赖方向和数据流；Spec 再把两者共同投影为可执行工程契约；Task 与实现只负责完成已经确定的契约。

当前阶段先完成 Requirements 与 Architecture 的审查。`specs/repository-mvp.md` 暂不跟随局部讨论即时修改，待上游设计稳定后统一重新投影。

## 架构概览

Repository 遵循 Cordis 的“万物皆插件”模型。

```text
Repository Node
=
Bootstrap Protocol instance
+ Cordis
+ loaded Protocol plugins
+ Runtime / provider plugins
+ configuration
```

Bootstrap 是具有可执行入口的稳定版本代码，启动时创建 Cordis application。它的稳定版本同样按 Protocol 格式声明。Cordis 启动后，Repository protocol、storage、index、projection 和 adapter 等能力继续按 Cordis plugin 组织。

Protocol plugin 不形成第二套插件系统。它只是具有长期链上语义和版本约束的 Cordis plugin。插件发现、依赖、Context、Service、Effect 和生命周期继续由 Cordis 管理。

详见 [`docs/architecture.md`](./docs/architecture.md)。

## 工程结构

当前仓库仍处于架构收敛阶段，package boundary 尚未最终锁定。现有目录主要用于保存文档、Spec 和最小 Cordis scaffold：

```text
README.md               中文项目说明（权威版本）
README_EN.md            英文翻译
AGENTS.md               Agent 开发说明（英文）
docs/concepts/          概念基线与术语文档
docs/requirements.md    产品需求唯一事实来源
docs/architecture.md    Design / Architecture
specs/                  工程 Spec，待重新投影
src/                    当前最小 Cordis scaffold
test/                   测试
scripts/                工程与发布检查脚本
.github/                 CI 与 PR 配置
```

具体 npm packages、monorepo 目录以及各 Protocol plugin 的拆分方式将在 Architecture 接受后进入 Spec / Task，不在当前阶段提前固定。

## 开发

环境：

- Node.js 22.20+ / 24+
- pnpm 11.7+

```bash
pnpm install
pnpm run check
pnpm run package:check
```

现有检查命令反映当前 scaffold，不代表最新 Repository Architecture 已完成实现。

## 状态

当前 package 保持 `private: true`。

Requirements 与 Architecture 正在收敛；旧 `specs/repository-mvp.md` 和 `src/` scaffold 仍保留用于后续重新投影与实现，不应被解释为已经确认的 Repository Service 架构。
