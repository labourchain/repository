# Asset

Asset 是 LabourChain 中已经对象化的劳动成果。代码、文档、数据、模型、设计、
构建产物，以及现实劳动成果的数字表示，都可以成为 Asset。

```text
Record<data = labourRecord> = 活劳动事实
Asset                       = 对象化后的劳动成果 / 死劳动
```

## 最小对象

Repository MVP 使用 `asset.content@0.1.0` 作为第一种最小 Asset
Protocol。它把 Asset 收敛为“精确协议语义下的一段不可变内容”：

```text
Asset
├─ id
├─ protocol
├─ protocolHash
├─ contentHash
└─ exact content bytes
```

`id` 由 `protocol + protocolHash + contentHash` 确定性派生，
`contentHash` 由精确内容字节派生。存储路径、数据库 row id、对象存储 key
或文件名都不是 Asset identity。

Asset 不复制劳动事实已经拥有的来源字段，因此不包含 `createdBy`、
`createdAt`、`previous`、`pid` 或通用 relation。劳动由谁完成、
什么时候完成、建立在什么成果上，都继续由相应的 labour Record 表达。

## 与劳动的关系

Asset 的形成、修改或维护应能够回到实际发生的劳动。当前
`labour.record@0.1.0` 已经提供两个最小关系：

```text
references[]
    -> 这次劳动明确引用/建立在其上的既有 AssetId

assets[]
    -> 这次劳动直接声明留下的结果 AssetId
```

因此生产关系可以从真实使用自然形成：

```text
labour R1
  -> assets[A]
Asset A
  -> references[A] in labour R2
labour R2
  -> assets[B]
Asset B
```

同一个 Asset 可以被多个后续 labour Records 引用，形成分支；如果一次维护
没有改变精确内容，也允许同一个 AssetId 同时出现在该 labour Record 的
`references[]` 与 `assets[]` 中。

不需要为了形成图而要求劳动者维护额外的 `previous`、`pid` 或 generic
relation 字段。需要的 lineage 可以从已经确认的 Record/Asset 引用重建。

并非所有 labourRecord 都需要对应 Asset；没有形成或提交成果的劳动仍然可以
被记录。

## 不可变 identity

同一组精确 `protocol + protocolHash + content` 得到同一个 AssetId。
内容或 exact ProtocolHash 改变时得到新的 AssetId，而不是原地修改旧 Asset。

这使“修改一个既有成果”的顺序自然表达为：

```text
old Asset A
  <- labour.references[A]
labour
  -> labour.assets[B]
new Asset B
```

Asset identity 不包含 Repo、Member 或生产它的 RecordId。同一成果可以被不同
劳动事实生产、引用或被多个 Repo 接受，而不因此得到不同的 Asset identity。

## 与 Repo 的关系

Repo 保存已经通过其 contribution/acceptance 流程采纳的 Asset。Repository
持久化必须能够按 AssetId 在重启后取回完全相同的内容。

“某个 Repo 接受了哪个 Asset”属于 contribution/Repository state，而不是
Asset 自身字段。Asset storage 因此不需要在 Asset 内增加 `repo`、
`accepted` 或反向 Record 列表。

Repo 对相关 labour Record / contribution 事实的处理不会改变 Asset 的生产
关系，也不会把 Record 变成 Repo 内部的第二套规范存储对象。

## 边界

Asset 不是任意可保存数据的同义词。Runtime cache、临时 API response、LLM
context 等内容不会因为技术上可以写入磁盘就自动成为 Asset。

`asset.content@0.1.0` 提供最小内容 identity/integrity；某段内容作为
LabourChain 劳动成果的领域意义，来自它被真实 labour/contribution facts
使用和确认。

文件名、MIME、标签、所有权、访问权、Project、搜索索引、可变版本以及
distributed/content-addressed storage infrastructure 都不属于当前最小 Asset
模型。

## 相关条目

- [Worker / Member](./worker.md)
- [Record](./record.md)
- [Repo](./repository.md)
- [Project](./project.md)
- [访问、授权与使用](./access-and-use.md)
