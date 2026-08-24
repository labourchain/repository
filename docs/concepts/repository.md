# Repo

Repo 是 LabourChain 中的仓库。它以 Asset 为存放对象，并在接收劳动者 contribution 时参与相关劳动的确证。

## 定义

Repo 用于保存劳动成果，并维护与仓库有关的劳动者关系。Repo 不把 Record 作为另一类仓库内容保存；与 Repo 有关的劳动历史由链上的 Records 重新构建。

```text
Worker
  ↓ labour
Record
  ↓ relates to
Asset
  ↓ contribution
Repo
```

## 成员与 operator

任何 Worker 都可以建立 Repo。每个 Repo 有一个 operator，用于维护哪些 Workers 可以向该 Repo contribution。

Worker 与 Repo 建立成员关系后，可从 Repo 视角称为 Member。成员关系决定 contribution 资格，不决定 Worker 是否能够产生 Record 或 Asset。

## Asset contribution

Repo contribution 的对象是 Asset。一次 contribution 通常同时关联描述相关劳动的 Record。

```text
Worker performs labour
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

Repo 的 contribution history 是与该 Repo 相关的 Records 的投影。它回答哪些劳动者向仓库贡献过什么劳动成果，以及 Repo 确证了哪些 contribution。

```text
Repo contribution history
= Records related to accepted Repo contributions
```

运行时可以缓存或索引这些 Records，避免日常分析反复从链构建完整视图。缓存是可重建数据，不是 Repo 的规范 `records[]`。

## Personal Repo

每个 Worker 默认拥有一个 Personal Repo，用于保存尚未进入其他 Repo 的私人 Assets，例如个人数据、健康资料、使用偏好和未公开材料。

Personal Repo 使用与普通 Repo 相同的基本仓库模型，但当前作为私人仓库使用。它不承担个人 Record 存储；Worker 的 labour history 仍来自链上 Records。

## 与 Git 仓库的类比

Git / GitHub 可以作为近似参照：

| Git / GitHub | LabourChain |
| --- | --- |
| 仓库中的内容 | Asset / 劳动成果 |
| commit 中的劳动描述 | Record / 劳动记录 |
| repository history | Repo contribution history |
| personal commits / contributions | Worker labour history |

这个类比只用于解释视角。LabourChain 将 Worker、Record、Asset 和 Repo 确证关系分别建模为链上对象或关系。

## 相关条目

- [Worker / Member](./worker.md)
- [Record](./record.md)
- [Asset](./asset.md)
- [Project](./project.md)
- [访问、授权与使用](./access-and-use.md)