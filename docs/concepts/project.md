# Project / 项目

本文定义 Project 在 LabourChain 中的基本概念位置。

## 定义

**Project = 项目 = 对劳动者、活劳动与死劳动的一种组织形式。**

Project 关注的不是“资料存在哪里”，而是：

- 哪些劳动者围绕什么目标协作；
- 使用哪些既有劳动成果；
- 发生了哪些新的活劳动；
- 形成、修改或维护了哪些新的劳动成果。

因此可以把 Project 的语义对象理解为：

```text
Project
├── Workers
├── Records
└── Assets
```

这里表达的是组织关系，不要求 Project 实体内部维护三个规范数组。

## 与 Repo 的区别

Repo 是仓库，以劳动成果的存放和 contribution 确证为中心；Project 是劳动组织形式，以目标和劳动过程的组织为中心。

```text
Repo
→ 资料存放、contribution、确证

Project
→ 人 + 活劳动 + 死劳动的组织
```

一个 Project 可以使用：

- 某个 Repo 中的 Assets；
- 多个 Repo 中的 Assets；
- Personal Repo 经授权提供的 Assets；
- 链上已有的 Records；
- 其他符合授权关系的数据来源。

因此 Project 不是 Repo 的目录，也不应被限制在一个 Repo 内。

## 与 Record / Asset 的关系

Project 可以围绕已有 Asset 组织新的劳动，并形成新的 Record 和 Asset：

```text
existing Workers + Records + Assets
              ↓
            Project
              ↓
      new labour / coordination
              ↓
            Records
              ↓
       new / changed Assets
```

Project 中的规划、分析、会议或回顾本身可以产生新的劳动记录，但这些记录仍然是普通 Record，不需要建立独立的 Summary 实体。

## 授权关系

Project 可以被授权读取劳动者 Personal Repo 中的特定 Assets，也可以使用 Repo 已统一管理的公开或公共 Assets。

因此 Project 组织资料的能力不等于拥有资料，也不要求把资料复制进一个 Project 专属仓库。

## 关键约束

- Project 不等于 Repo；
- Project 不承担 Asset 的规范存储；
- Project 不拥有 Record 的规范历史容器；
- Project 的意义在于组织劳动者、活劳动与死劳动之间的目标性关系；
- Project 的具体规划、分析与展示能力属于上层产品实现，不改变这些基础概念。
