# 访问、授权与使用

本文说明 LabourChain 当前对私人、公开、公共、有痕授权和劳动成果使用关系的定义。

## Private / 私人

当前阶段，Personal Repo 是默认的 Private Repo。其中的 Asset 不会因为存在于 LabourChain 环境中就自动公开。劳动者可以把特定 Asset 授权给 Project、Repo 或其他受支持的使用方。

当前版本不实现通用 Private Repo 或零知识证明，但概念模型需要保留这条路径：以后可以在不公开 Asset 明文内容的情况下，证明某个 Asset、Record 及其关系存在。

## Public / 公开

普通 Repo 发布到链上后，默认遵循上链即公开。公开的 Asset 可以被读取或使用，但使用关系需要具名、可追踪。

需要保留的基本关系包括：

```text
producer
consumer
used Asset
use relation
```

这些关系以后可以用于使用核算、贡献识别或收益分配。当前文档只定义关系本身，不规定具体结算机制。

## Commons / 公共

公共 Asset 允许无记名使用或再生产使用，不要求每次 use 都产生具名记录。这里的无记名只针对使用行为，Asset 的生产者、作者和 provenance 仍然存在。

当前区别可以简化为：

```text
公开：可使用 + 需要记名
公共：可使用 + 不要求记名
```

## 有痕授权

劳动者可以通过 Flow 等插件，把 Personal Repo 中的私人 Asset 授权给 Project 或 Repo，并留下授权和后续使用关系。

当很多劳动者需要以同一方式管理同类数据时，可以由 Repo 统一接收和调度。例如健康管理追踪仓库可以接收劳动者授权的数据，使用方通过该 Repo 获取相应 Assets，而不必逐个重新请求授权。

这种结构也让 Repo 可以承担共同管理劳动成果和使用关系的作用。

## 数据生产者与使用收益

LabourChain 不把数据授权简化成一次勾选后永久、无痕的使用许可。当前模型至少需要能够表达：

```text
谁生产了 Asset
谁使用了 Asset
使用了哪一个 Asset
发生了什么使用关系
```

有了这些关系，后续才可能继续定义使用核算、收益归集、Repo 内部分配和数据生产者收益机制。具体算法、货币、代币和分配比例不在当前概念范围内。

## 软件资产的使用与 contribution

以 LabourFlow 为例，一个 Repo 可以发布源码 Asset 和构建后的插件 Asset。普通使用者不需要 clone 源码仓库，可以通过 CI、包分发或 Runtime 获取构建结果并使用。

参与开发劳动时，才通常会进入下面的 contribution 流程：

```text
clone / fork
    ↓
modify
    ↓
new labour Record
    ↓
new / changed Asset
    ↓
contribution
```

因此，软件使用和软件生产是两种不同关系。clone/fork 常见于 contribution，但不能用来定义普通软件使用。公开软件是否要求具名使用记录，由相应 Asset 或 Repo 的使用模式决定。

## 隐私与后续证明机制

上链即公开是当前普通 Repo 的默认规则，不表示未来链上 Asset 必须公开明文内容。

以后可以通过承诺、零知识证明或其他机制证明 Asset 存在、某项劳动发生，以及 Asset 与 Record、Worker、Repo 之间存在相应关系，同时隐藏 Asset 的具体内容。

这部分目前只作为概念兼容性保留，不属于 Repository MVP 的实现要求。