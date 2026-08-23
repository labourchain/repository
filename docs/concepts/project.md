# Project / 项目

Project 是对劳动者、活劳动和死劳动进行组织的一种形式。它关注的是哪些劳动者围绕什么目标协作、使用了哪些已有劳动成果、发生了哪些新的劳动，以及这些劳动形成或改变了什么成果。

可以把它理解为对三类对象的组织关系：

```text
Project
├── Workers
├── Records
└── Assets
```

这里的结构只说明 Project 组织哪些对象，不要求 Project 实体内部维护三个规范数组。

## Project 与 Repo

Repo 是仓库，主要处理劳动成果的存放、contribution 和相关劳动确证。Project 处理的是劳动组织本身。

```text
Repo
→ 资料存放、contribution、确证

Project
→ 人 + 活劳动 + 死劳动的组织
```

一个 Project 可以使用单个或多个 Repo 中的 Assets，也可以使用 Personal Repo 经授权提供的 Assets、链上已有的 Records，以及其他符合授权关系的数据来源。因此 Project 不是 Repo 的目录，也不应被限制在某一个 Repo 内。

## Project 中的劳动

Project 可以围绕已有 Worker、Record 和 Asset 组织新的劳动：

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

规划、分析、会议和回顾本身也可以形成新的劳动记录。这些记录仍然是普通 Record，不需要另设 Summary 实体。

## 授权与资料来源

Project 可以读取劳动者授权的 Personal Repo Assets，也可以使用 Repo 已统一管理的公开或公共 Assets。Project 对资料的组织不等于取得资料所有权，也不要求把所有内容复制进一个 Project 专属仓库。

具体的规划、分析和展示功能属于上层产品实现，不改变 Project 对劳动者、Record 和 Asset 的基本组织关系。