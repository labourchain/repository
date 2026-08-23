# Concepts

`docs/concepts/` 维护 LabourChain 的长期概念基线。这里统一术语和对象关系，供需求、Spec、协议、产品设计和实现对照使用。

这些文档不是功能需求，也不是工程契约。Repository 的产品需求仍以 [`../requirements.md`](../requirements.md) 为唯一事实来源。如果概念基线与需求不一致，应先审查两者，再修改 Spec 或实现。

## 文档约定

每篇文档只处理一组紧密相关的概念。内容通常包括定义、与其他概念的关系、概念本身的约束，以及运行时或产品视图中的投影。没有必要在一篇文档里解释整个 LabourChain。

新的稳定概念可以单独增加文档。已有概念发生实质变化时，需要同时检查依赖它的 requirements 和 specs。

## 核心概念

| LabourChain | 中文概念 | 基本含义 |
| --- | --- | --- |
| Worker / Member | 劳动者 / 劳动主体 | 系统中能够产生劳动记录和劳动成果的劳动主体 |
| Record | 劳动记录 / 活劳动 | 对劳动过程的链上事实记录 |
| Asset | 劳动成果 / 死劳动 | 劳动对象化后形成的成果及其链上表示 |
| Repo | 仓库 | 存放劳动成果，并在 contribution 中参与劳动确证 |
| Project | 项目 | 对劳动者、活劳动与死劳动的一种组织形式 |

## 文档导航

- [`labour.md`](./labour.md)：劳动者、活劳动、死劳动，以及劳动链记录活劳动的基本模型。
- [`repository.md`](./repository.md)：仓库、Asset contribution、仓库确证、Personal Repo 和运行时投影。
- [`project.md`](./project.md)：Project 如何组织劳动者、活劳动和死劳动，以及它与 Repo 的区别。
- [`access-and-use.md`](./access-and-use.md)：私人、公开、公共、有痕授权、数据使用和软件资产使用。

当前最基础的概念关系可以概括为：劳动者是劳动主体，Record 记录活劳动，Asset 表示对象化后的劳动成果；Repo 存放劳动成果并参与相关劳动的确证，Project 则组织劳动者、Record 和 Asset。