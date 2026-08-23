# @labourchain/repository

[English](./README_EN.md)

`@labourchain/repository` 是 LabourChain 的仓库插件。

在 LabourChain 的模型中，劳动者是劳动主体，Record 记录活劳动，Asset 表示已经对象化的劳动成果。Repository 作为仓库，主要负责存放和组织劳动成果，并在劳动者提交劳动成果时参与相关劳动记录的确证。Repo 视角的 contribution history 可以由链上的劳动记录重新构建，运行时服务可以为日常使用缓存这些投影。

当前仓库处于 MVP 开发阶段，采用 Cordis 插件形式实现。

## 文档

本仓库的 `docs/` 不只保存开发需求，也长期维护 LabourChain 在 Repository 领域形成的理论与产品文档，未来可以通过 GitHub Pages 或其他文档站点对外展示。

当前主要文档：

- [`docs/theory/labour-model.md`](./docs/theory/labour-model.md)：劳动者、活劳动、死劳动、仓库与项目的政治经济学理论基线；
- [`docs/requirements.md`](./docs/requirements.md)：Repository 产品需求的唯一事实来源；
- [`specs/repository-mvp.md`](./specs/repository-mvp.md)：由需求进一步投影出的工程契约、边界、不变量和验收条件。

理论文档用于长期概念对照，但不会替代需求层。若需求、Spec 或实现与理论基线出现冲突，应先显式讨论和修订，而不是在实现中静默选择一种解释。

## 开发方式

本仓库采用三层开发流程：

```text
需求
  docs/requirements.md
    ↓
Spec
  specs/
    ↓
实现
  src/ + test/
```

理论文档位于这条开发链之外，提供更长期的概念背景和校验基线。

需求先说明产品需要什么；Spec 再把需求收敛成可验证的工程契约；实现和测试只负责满足 Spec。

如果开发过程中发现需求本身有缺口，应先修改 requirements，再更新 Spec 和代码。

## 工程结构

```text
README.md            中文项目说明（权威版本）
README_EN.md         英文翻译
AGENTS.md            Agent 开发说明（英文）
docs/                理论、需求与其他项目文档
specs/               工程 Spec
src/                 Cordis 插件实现
test/                测试
scripts/             工程与发布检查脚本
.github/              CI 与 PR 配置
```

`docs/` 与 `specs/` 保留在 Git 仓库中，但不进入发布的 npm 插件包。它们是否进入 npm 包与它们是否属于长期项目文档是两回事。

## 开发

环境：

- Node.js 22.20+ / 24+
- pnpm 11.7+

```bash
pnpm install
pnpm run check
pnpm run package:check
```

## 状态

当前 package 保持 `private: true`。第一版 Repository Service 完成并通过发布审查后再开放发布。
