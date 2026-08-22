# @labourchain/repository

[English](./README_EN.md)

`@labourchain/repository` 是 LabourChain 的 Repository 插件，用于维护一个可供小团队共同工作的资料仓库。

Repository 维护劳动者与工作区之间的关系，接收已经形成的 Record 与 Asset，并提供存放、验证和读取能力。它作为 LabourFlow、Board、Project 等上层产品共享事实资料的基础设施，也为后续接入 LabourChain Core 的签名、打包与归档能力保留稳定接口。

当前仓库处于 MVP 初始化阶段，采用 Cordis 插件形式开发。

## 当前目标

第一阶段先让小团队能够稳定完成这些基本操作：

- 建立并加载一个 Repository 工作区；
- 维护工作区中的劳动者关系；
- 接收并保存 Record；
- 接收并保存 Asset；
- 通过 LabourChain Core 的验证能力检查进入 Repository 的对象；
- 按稳定引用读取 Record 与 Asset；
- 枚举工作区中的成员和已保存内容；
- 使用可替换的持久化 provider。

详细需求维护在：

- [`docs/requirements.md`](./docs/requirements.md)
- [`docs/features.md`](./docs/features.md)

严格的行为契约、边界、不变量和验收条件维护在：

- [`specs/repository-mvp.md`](./specs/repository-mvp.md)

## 开发方式

本仓库采用三层开发流程：

```text
需求与功能
  docs/
    ↓
Spec
  specs/
    ↓
实现
  src/ + test/
```

`docs/` 先说明需要什么；`specs/` 再把需求收敛成可验证的工程契约；实现和测试只负责满足已经确定的 Spec。

在实现过程中发现需求有缺口时，应回到需求层修改，再继续修改 Spec 和代码。

## 工程结构

```text
README.md            中文项目说明（权威版本）
README_EN.md         英文翻译
AGENTS.md            Agent 开发说明（英文）
docs/                需求与功能文档
specs/               工程 Spec
src/                 Cordis 插件实现
test/                测试
scripts/             工程与发布检查脚本
.github/              CI 与 PR 配置
```

`docs/` 与 `specs/` 是开发过程中保留在 Git 仓库中的文档资产，不进入发布的 npm 插件包。

## 开发

环境：

- Node.js 22.20+
- pnpm 11.7+

```bash
pnpm install
pnpm run check
pnpm run package:check
```

`pnpm run check` 执行类型检查、测试覆盖率检查和生产构建；`pnpm run package:check` 检查最终 npm tarball，确保开发文档、源码和测试不会被打进运行时插件包。

## 状态

当前 package 保持 `private: true`。第一版 Repository Service 完成并通过发布审查后再开放发布。
