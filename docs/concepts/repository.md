# Repo

Repo 是 LabourChain 中的仓库。它以 Asset 为存放对象，并在接收劳动者 contribution 时参与相关劳动的确证。

## 定义

Repo 首先具有一个 Core Entity identity，并通过 Repo 及其他适用协议组合形成完整仓库能力，而不是一个固定字段集合的 Repo object。

```text
core.entity / EntityPublicKey
    ↓
Repo identity
    ├─ repo protocol
    ├─ asset-related protocols
    ├─ membership / contribution protocols
    └─ other protocols...
```

Repo 用于保存劳动成果，并维护与仓库有关的劳动者关系。Repo 不把 Record 作为另一类仓库内容保存；与 Repo 有关的劳动历史由相关 LabourChain facts 重新构建。

```text
Member performs labour
  ↓
Record
  ↓ relates to
Asset
  ↓ contribution
Repo
```

## establishment 与 operator

一个有效 Member 可以 establishment 一个 Repo。普通集体 Repo 使用独立的 Repo Entity identity；establishment 记录建立该 Repo identity 与发起 Member 之间的初始 operator 关系。

每个 Repo 有一个 operator，用于维护哪些 Members 可以向该 Repo contribution。Repo membership 是 Member 与 Repo 的关系，不创建新的 Member identity。

Member 也可以在自己的同一个 Entity identity / keypair 上组合 Repo 协议能力：

```text
Entity K
├─ member.*
└─ repo.*
```

这种同 identity 的 Repo 能力可用于暂时收集尚未进入集体 Repo 的劳动成果与相关事实，但它不构成“Member 私有财产”的定义。Repo 的存放或关联关系本身不决定 Asset 的所有权、排他权、转让权或收益权。

## Asset contribution

Repo contribution 的对象是 Asset。一次 contribution 通常同时关联描述相关劳动的 Record。

```text
Member performs labour
        ↓
Record + Asset
        ↓
Asset contribution
        ↓
Repo accepts Asset
and confirms related labour
```

Repo 接受 contribution 后保存 Asset，并对相关劳动形成仓库侧确证。该确证不会改变 Record 的劳动主体，也不会把 Record 转移到 Repo 名下。

没有形成或提交 Asset 的劳动仍然可以产生 Record，只是不构成 Repo contribution。

## Contribution history

Repo 的 contribution history 是与该 Repo 相关劳动事实的投影。它回答哪些 Members 向仓库贡献过什么劳动成果，以及 Repo 确证了哪些 contribution。

运行时可以缓存或索引相关 Records，避免日常分析反复重建完整视图。缓存是可重建数据，不是 Repo 的规范 `records[]`。

## Member-scoped Repo 与 LabourFlow

同一个 Member identity 组合 Repo 协议是一种通用协议能力，不需要创建嵌套的 `PersonalRepo` entity，也不需要第二套 keypair。

LabourFlow 可以在此能力之上提供面向个人的产品体验，用于组织尚未进入集体 Repo 的内容；这种产品体验不改变底层 Repo 协议，也不得将“个人空间”自动解释为私人财产权。

## 与 Git 仓库的类比

Git / GitHub 可以作为近似参照：

| Git / GitHub | LabourChain |
| --- | --- |
| 仓库中的内容 | Asset / 劳动成果 |
| commit 中的劳动描述 | Record / 劳动记录 |
| repository history | Repo contribution history |
| personal commits / contributions | Member labour history |

这个类比只用于解释视角。LabourChain 将 Member identity、Record、Asset 和 Repo 确证关系分别建模为协议事实与关系。

## 相关条目

- [Member / Worker](./worker.md)
- [Record](./record.md)
- [Asset](./asset.md)
- [Project](./project.md)
- [访问、授权与使用](./access-and-use.md)
