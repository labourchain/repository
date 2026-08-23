# 仓库与劳动确证

本文定义 Repo、Asset contribution、仓库视角的劳动历史、Personal Repo 与运行时投影。

## Repo / 仓库

### 定义

**Repo = 仓库。**

Repo 以 Asset 为中心，用于存放劳动成果，并在劳动者向仓库提交劳动成果时参与对相关劳动记录的确证。

### 关系

Repo 与 Record 的关系不是“把 Record 存进仓库字段”，而是通过链上事实建立：

```text
Worker
  ↓ labour
Record
  ↓ relates to
Asset
  ↓ contribution
Repo
```

当 Repo 接受 Asset contribution 时，它对与这次 contribution 相关的劳动关系形成仓库侧确证。

### 关键约束

- Repo 的规范内容中心是 Asset；
- Repo 不需要维护一个规范性的 `records[]` 字段；
- Repo 的 contribution history 由链上与该 Repo 相关的 Record 重建；
- Repo 对 Record 的确证不会把劳动记录从劳动者“转移”给 Repo；
- 同一 Record 可以从劳动者视角和 Repo 视角形成不同投影。

## Asset contribution 与 Record

在 Repo contribution 场景中，劳动者提交的是 Asset。

这次提交同时伴随描述劳动过程的 Record。Repo 接受 Asset 时，对相关劳动形成仓库侧确证。

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

这一流程只描述 Repo contribution，不意味着：

- 所有 Record 都必须产生 Asset；
- Record 必须依附 Repo 才能存在；
- 劳动者必须加入某个公共 Repo 才能产生劳动记录。

## 劳动者视角与仓库视角

同一条劳动记录可以形成不同的历史视图：

- **Worker view**：这个劳动者进行了哪些劳动；
- **Repo view**：这个仓库接受并确证了哪些 contribution。

这些视图都来自链上 Record 的关系，而不是实体内部维护的历史数组。

这与 Git / GitHub 有一个有帮助但不完全等同的类比：

```text
Git / GitHub                     LabourChain
------------------------------------------------------
仓库中的内容                     Asset / 劳动成果
commit 中的劳动描述              Record / 劳动记录
repository history              Repo contribution history
personal commits/contributions  Worker labour history
```

区别在于 LabourChain 将劳动者、劳动记录、劳动成果和仓库确证关系显式建模为独立事实。

## Personal Repo

### 定义

Personal Repo 是劳动者默认拥有的私人 Asset 仓库，用于保存尚未进入公开 Repo 的劳动成果和个人数据。

例如：

- 健康资料；
- 使用偏好；
- 未公开材料；
- 个人生产的数据或文件。

### 关键约束

- Personal Repo 主要存储私人 Asset，不是 Record 仓库；
- 劳动者拥有的 Record 仍然作为链上劳动事实存在；
- Personal Repo 是当前阶段默认的私人仓库形式；
- 更一般的 Private Repo 与隐私证明机制属于后续概念扩展。

## Runtime projection / cache

实际运行中，Repository、Board、Flow 等服务可以缓存或索引链上的 Record，以避免每次分析都从链重新构建完整视图。

例如可以存在：

```text
Repository record cache
Board analysis index
Flow labour history projection
```

这些只是运行时投影：

- 可以删除并重新构建；
- 不改变 Record 的规范事实地位；
- 不构成 Repo 或 Worker 的 `records[]` 规范字段。
