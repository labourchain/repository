# 访问、授权与使用

本条目描述 Asset 在 LabourChain 中的私人、公开和公共使用方式，以及授权和使用关系。

## 私人 Asset

Personal Repo 是当前默认的私人仓库。存放在其中的 Asset 不会因为进入 LabourChain 环境而自动公开。

Worker 可以把特定 Asset 授权给 Project、Repo 或其他受支持的使用方。授权改变的是使用关系，不改变 Asset 的生产者或既有 provenance。

## 公开 Asset

普通 Repo 发布到链上后，当前默认遵循上链即公开。公开 Asset 可以被读取或使用，但使用关系需要具名并可追踪。

公开使用至少涉及以下关系：

```text
producer
consumer
used Asset
use relation
```

这些关系可以作为后续使用核算、贡献识别或收益分配的依据。当前概念模型只保留关系，不规定结算方法。

## 公共 Asset

公共 Asset 允许无记名使用或再生产使用，不要求每次 use 都形成具名记录。

无记名只描述使用行为。Asset 的生产者、作者和 provenance 仍然存在。

| 使用方式 | 是否可使用 | 是否要求具名使用关系 |
| --- | --- | --- |
| 公开 | 是 | 是 |
| 公共 | 是 | 否 |

## 有痕授权

有痕授权用于把私人 Asset 的使用权授予特定 Project、Repo 或其他使用方，同时保留授权和后续使用关系。

当多个 Workers 需要以同一种方式管理同类数据时，可以通过 Repo 统一接收和调度。例如健康管理追踪仓库可以接收劳动者授权的数据，使用方通过 Repo 获取相应 Assets，而不需要逐个重新请求授权。

这种关系允许 Repo 作为多个数据生产者共同管理劳动成果和使用方式的组织节点。

## 数据使用与收益

LabourChain 的数据使用模型需要能够表达 Asset 的生产者、使用者、被使用对象和使用关系。

```text
Worker produces Asset
        ↓
Consumer uses Asset
        ↓
use relation
```

在这些关系之上，可以继续建立使用核算、收益归集、Repo 内部分配和数据生产者收益机制。具体算法、货币、代币和分配比例不属于当前概念定义。

## 软件 Asset

软件的使用和软件的生产是两种不同关系。以 LabourFlow 为例，Repo 可以同时发布源码 Asset 和构建后的插件 Asset。普通使用者可以通过 CI、包分发或 Runtime 获取构建结果，不需要 clone 源码仓库。

参与开发劳动时，才通常进入 contribution 流程：

```text
clone / fork
    ↓
modify
    ↓
Record
    ↓
new / changed Asset
    ↓
contribution
```

clone 或 fork 可以是 contribution 的环节，但不能用来定义普通软件使用。公开软件是否要求具名使用记录，由相应 Asset 或 Repo 的使用方式决定。

## 私有证明

当前普通 Repo 遵循上链即公开，但这不要求未来所有链上 Asset 都公开明文内容。

后续可以通过承诺、零知识证明或其他机制证明 Asset 存在、某项劳动发生，以及 Asset 与 Record、Worker、Repo 之间存在相应关系，同时隐藏 Asset 的具体内容。通用 Private Repo 和这类证明机制目前不属于 Repository MVP。

## 相关条目

- [Worker / Member](./worker.md)
- [Record](./record.md)
- [Asset](./asset.md)
- [Repo](./repository.md)
- [Project](./project.md)