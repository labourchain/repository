# @labourchain/repository

[English](./README_EN.md)

`@labourchain/repository` 是 LabourChain 的 Repository 插件，用于维护一个可供小团队共同使用的资料仓库。

Repository 维护劳动者与工作区之间的关系，接收已经形成的 Record 与 Asset，并提供验证、保存和读取能力。LabourFlow 可以向 Repository 提交已经识别完成的劳动记录，Board / Project 则可以读取这些资料进行后续组织和分析。

当前仓库处于 MVP 开发阶段，采用 Cordis 插件形式实现。

## 当前功能目标

第一阶段让小团队能够稳定完成：

- 建立和识别一个 Repository 工作区；
- 添加、移除和查看工作区中的劳动者；
- 接收并验证已经形成的 Record；
- 接收并验证 Asset / Asset reference；
- 保存已经接受的内容，并在之后重新读取；
- 枚举工作区中的劳动者、Records 和 Assets。

需求的唯一事实来源是：

- [`docs/requirements.md`](./docs/requirements.md)

工程上的详细契约、边界、不变量和验收条件由需求进一步投影到：

- [`specs/repository-mvp.md`](./specs/repository-mvp.md)

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

需求先说明产品需要什么；Spec 再把需求收敛成可验证的工程契约；实现和测试只负责满足 Spec。

如果开发过程中发现需求本身有缺口，应先修改 requirements，再更新 Spec 和代码。

## 工程结构

```text
README.md            中文项目说明（权威版本）
README_EN.md         英文翻译
AGENTS.md            Agent 开发说明（英文）
docs/                需求文档
specs/               工程 Spec
src/                 Cordis 插件实现
test/                测试
scripts/             工程与发布检查脚本
.github/              CI 与 PR 配置
```

`docs/` 与 `specs/` 是开发过程中保留在 Git 仓库中的文档资产，不进入发布的 npm 插件包。

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
