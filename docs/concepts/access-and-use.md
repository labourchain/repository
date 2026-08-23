# 访问、授权与使用

本文定义 LabourChain 中私人、公开、公共、有痕授权以及劳动成果使用关系的当前概念基线。

## Private / 私人

当前阶段可以把 Personal Repo 理解为默认的 Private Repo：其中的 Asset 不因为存在于 LabourChain 环境中就自动公开。

劳动者可以选择把其中的特定 Asset 授权给 Project、Repo 或其他受支持的使用方。

当前版本不实现通用 Private Repo 或零知识证明，但概念上应保留这种能力：未来链上可以证明某个 Asset、Record 及其关系存在，而无需公开 Asset 的明文内容。

## Public / 公开

普通 Repo 一旦发布到链上，默认遵循“上链即公开”。

“公开”表示 Asset 可以被读取或使用，但其使用关系需要具名、可追踪。

这不是简单的“允许/禁止”开关，而是希望保留：

```text
producer
consumer
used Asset
use relation
```

使后续核算、贡献识别或收益分配成为可能。

## Commons / 公共

“公共”表示 Asset 可以无记名使用或再生产使用，不要求每次 use 都形成具名使用记录。

公共不等于没有生产者、作者或 provenance。生产关系仍然存在，只是不要求把每一次使用都转化为具名使用关系。

因此当前概念区别是：

```text
公开：可使用 + 需要记名
公共：可使用 + 不要求记名
```

## 有痕授权

劳动者可以通过 Flow 等插件，把 Personal Repo 中的私人 Asset 授权给 Project 或 Repo 使用，并使授权与后续使用留下可追踪关系。

对于大量劳动者共同管理同类数据的场景，可以建立 Repo 统一调度。例如健康管理追踪仓库可以接收劳动者授权的数据，使用方通过 Repo 获取相应 Assets，而不必逐个重新请求授权。

这使 Repo 可以成为数据生产者共同管理劳动成果和使用关系的组织节点。

## 数据生产者与使用收益

LabourChain 希望避免把“允许开发者使用您的数据”简化为一次性勾选后永久、无痕地占用劳动者生产的数据。

当前概念基线首先要求能够表达：

```text
谁生产了 Asset
谁使用了 Asset
使用了哪一个 Asset
发生了什么使用关系
```

在这些关系之上，未来可以进一步建立：

- 使用核算；
- 收益归集；
- Repo 内部分配；
- 数据生产者收益机制。

当前概念文档不规定具体算法、货币、代币或分配比例。

## 软件资产：使用与 contribution

以 LabourFlow 为例，一个 Repo 可以发布源码 Asset 和构建后的插件 Asset。

普通使用者不需要 clone 源码仓库，可以通过 CI、包分发或 Runtime 获取构建后的插件并使用。

只有参与开发劳动时，才通常进入：

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

因此：

- 使用软件劳动成果，不等于参与其生产；
- clone/fork 是 contribution workflow 的常见环节，不应被用来定义普通软件使用；
- 公开软件的普通使用是否要求具名记录，取决于该 Asset / Repo 的使用模式。

## 隐私与未来证明机制

“上链即公开”是当前普通 Repo 的默认规则，但不是对未来密码学能力的限制。

未来 Private Repo 可以通过承诺、零知识证明或其他机制，使系统能够证明：

- 某个 Asset 存在；
- 某项劳动发生；
- Asset 与 Record、Worker、Repo 之间存在相应关系；

而无需暴露 Asset 的具体内容。

这一方向当前只作为概念兼容性保留，不属于 Repository MVP 的实现要求。
