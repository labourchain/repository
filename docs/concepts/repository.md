# 仓库与劳动确证

本文说明 Repo、Asset contribution、仓库视角的劳动历史、Personal Repo 和运行时投影之间的关系。

## Repo：仓库

Repo 是仓库，主要存放 Asset，也就是劳动成果。劳动者向 Repo 提交劳动成果时，Repo 同时参与相关劳动记录的确证。

Repo 与 Record 的关系由链上事实建立，而不是通过一个 `records[]` 字段保存：

```text
Worker
  ↓ labour
Record
  ↓ relates to
Asset
  ↓ contribution
Repo
```

Repo 接受 Asset contribution 后，可以从自身视角确认这次 contribution 所对应的劳动关系。这个确认不会改变 Record 的劳动主体，也不会把 Record 从劳动者转移给 Repo。

Repo 的 contribution history 由链上与该 Repo 相关的 Record 重建。同一条 Record 也可以从劳动者视角形成个人 labour history。

## Asset contribution 与 Record

在 Repo contribution 场景中，劳动者实际提交的是 Asset。与这次劳动有关的 Record 同时描述劳动过程，Repo 接受 Asset 时对这段劳动形成仓库侧确认。

```text
劳动者进行劳动
    ↓
形成 / 修改劳动成果 Asset
    ↓
产生劳动记录 Record
    ↓
向 Repo 提交 Asset
    ↓
Repo 接受 Asset，并确证相关劳动
```

这只是 Repo contribution 的流程。Record 可以在没有新 Asset 的情况下存在，也不依赖某个 Repo 才能成立。劳动者同样不需要先加入公共 Repo 才能产生劳动记录。

## 两种历史视角

Worker view 回答某个劳动者进行了哪些劳动；Repo view 回答某个仓库接受并确证了哪些 contribution。两种视图都来自链上 Record 的关系，不需要在实体内部保存一份规范历史数组。

Git / GitHub 可以作为一个近似参照：

```text
Git / GitHub                     LabourChain
------------------------------------------------------
仓库中的内容                     Asset / 劳动成果
commit 中的劳动描述              Record / 劳动记录
repository history              Repo contribution history
personal commits/contributions  Worker labour history
```

LabourChain 与 Git 的区别在于，劳动者、劳动记录、劳动成果和仓库确证关系都被单独建模为链上事实。

## Personal Repo

Personal Repo 是劳动者默认拥有的私人 Asset 仓库，用于保存还没有进入公开 Repo 的劳动成果和个人数据，例如健康资料、使用偏好、未公开材料，以及个人生产的数据或文件。

它不是 Record 仓库。劳动者产生的 Record 仍然作为链上劳动事实存在。当前阶段可以把 Personal Repo 视为默认的私人仓库形式，更一般的 Private Repo 和隐私证明机制留待后续扩展。

## Runtime projection / cache

Repository、Board、Flow 等服务在实际运行中可以缓存或索引链上的 Record，避免每次分析都从链重新构建完整视图。例如：

```text
Repository record cache
Board analysis index
Flow labour history projection
```

这些数据可以删除后重新构建。它们不改变 Record 的链上事实地位，也不会成为 Repo 或 Worker 的规范 `records[]` 字段。