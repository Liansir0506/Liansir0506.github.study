---
title: Milvus 索引机制与基本操作
date: 2026-10-22 15:30:00
categories:
  - 项目篇
  - RAG 问答系统
tags:
  - Milvus
  - 向量数据库
  - HNSW
  - 多租户
description: Collection、Partition、Schema、Index——向量库的核心概念与增删改查，以及多租户隔离的两种做法
mathjax: true
---

> **一句话概括**：Milvus 是专门存向量、查向量的数据库——它比"用文件存向量"多了索引、过滤、隔离和持久化。
> **这篇有多重要**：🔥 —— 项目里所有检索都落在 Milvus 上；面试问"向量库怎么用、多租户怎么隔离"要靠这篇。
> **前置知识**：ragp-01 的 HNSW 与向量检索
> **对应素材**：`RAG2/01_课件/site/04-milvus-index-and-operations.html`

## 一、初识：为什么不用普通数据库存向量

| 需求 | 普通数据库 | Milvus |
|---|---|---|
| 相似度检索（找最近的 K 个向量） | ❌ 不支持 | ✅ 核心能力 |
| 高维向量（1024 维 × 百万条） | 存得下但查不动 | ✅ ANN 索引加速 |
| 标量 + 向量混合过滤 | 勉强 | ✅ 原生支持（filter） |
| 多租户隔离 | 自己设计 | ✅ Partition / 字段隔离 |

> 一句话：**普通数据库按"值"查，向量库按"相似度"查**——这是本质区别。

## 二、初识：Milvus 的四个核心概念

| 概念 | 类比关系型数据库 | 说明 |
|---|---|---|
| **Collection** | 表（table） | 一类数据的集合（如 `knowledge_chunks`） |
| **Schema** | 表结构 | 定义字段：id、vector、text、metadata 等 |
| **Partition** | 分区 | Collection 内的物理分区（多租户/多知识库用） |
| **Index** | 索引 | 向量索引（HNSW）+ 标量索引 |

### 2.1 一个典型 Schema

```python
from pymilvus import MilvusClient, DataType

schema = MilvusClient.create_schema(auto_id=False)
schema.add_field("id",        DataType.VARCHAR, is_primary=True, max_length=64)
schema.add_field("vector",    DataType.FLOAT_VECTOR, dim=1024)   # embedding
schema.add_field("text",      DataType.VARCHAR, max_length=4096) # 原文（喂给 LLM）
schema.add_field("kb_id",     DataType.VARCHAR, max_length=64)   # 知识库 ID
schema.add_field("tenant_id", DataType.VARCHAR, max_length=64)   # 租户 ID
schema.add_field("doc_id",    DataType.VARCHAR, max_length=64)   # 来源文档
schema.add_field("chunk_idx", DataType.INT64)                    # 段序号
```

> 🔥 **Schema 设计要点**：向量用于检索，**text 用于喂模型，metadata 用于过滤和引用出处**——三者缺一不可。

## 三、运用：建索引（HNSW 参数怎么调）

```python
index_params = client.prepare_index_params()
index_params.add_index(
    field_name="vector",
    index_type="HNSW",
    metric_type="COSINE",     # 与 embedding 的距离度量一致
    params={"M": 16, "efConstruction": 200}
)
client.create_collection("knowledge_chunks", schema=schema, index_params=index_params)
```

参数经验值（可以直接用）：

| 参数 | 推荐 | 说明 |
|---|---|---|
| **M** | 16（8~64） | 越大召回越高、内存越大 |
| **efConstruction** | 200（100~500） | 建索引质量 |
| **ef**（查询时） | 64~128 | 越大越准越慢，按 SLO 调 |

> 📌 **metric_type 必须和 embedding 的归一化方式匹配**：BGE 系列一般用 COSINE；如果向量已归一化，IP（内积）等价。

## 四、运用：写入与检索

### 4.1 写入（批量）

```python
client.insert("knowledge_chunks", [
    {"id": "kb1_doc3_0", "vector": vec0, "text": chunk0,
     "kb_id": "kb1", "tenant_id": "t001", "doc_id": "doc3", "chunk_idx": 0},
    # ...
])
```

> 💡 批量写入比逐条快一个数量级；上线大文档时按批（如 500 条/批）提交。

### 4.2 检索（带标量过滤）

```python
res = client.search(
    collection_name="knowledge_chunks",
    data=[query_vec],
    limit=10,
    filter='tenant_id == "t001" and kb_id == "kb1"',   # 关键：先过滤再检索
    search_params={"metric_type": "COSINE", "params": {"ef": 64}},
    output_fields=["text", "doc_id", "chunk_idx"],
)
```

搜索结果的每条包含：`distance`（相似度）+ `entity`（返回的字段）。

> 🔥 **filter 是 RAG 的安全边界**——多租户系统里，**每次检索都必须带 tenant_id 过滤**，否则 A 公司会搜到 B 公司的数据。这是工程红线。

## 五、初识：多租户隔离的两种做法

| 方案 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| **Partition 隔离** | 每个租户一个 partition | 物理隔离、性能好、权限清晰 | 租户多了 partition 数量爆炸（Milvus 建议 < 4096） |
| **标量字段过滤** | 一个 collection，用 `tenant_id` 过滤 | 简单、扩展性好 | 依赖代码正确性（漏加 filter 就串数据） |

工程上常组合使用：

- **大客户/敏感租户** → 独立 partition（或独立 collection）
- **中小租户** → 同一 collection + `tenant_id` 强制过滤（在 DAO 层统一注入，防止漏）

> 📌 面试答法："隔离方案看规模——少量大租户用 partition，海量小租户用标量字段 + 统一在数据访问层注入过滤条件，避免业务代码漏写。"

## 六、运用：日常运维的三个操作

```python
# 1. 统计条数（核对入库是否完整）
stats = client.get_collection_stats("knowledge_chunks")

# 2. 按条件删除（下架某个文档）
client.delete("knowledge_chunks", filter='doc_id == "doc3"')

# 3. 释放/加载（重启后首次查询前）
client.load_collection("knowledge_chunks")
```

> 💡 Milvus 的变更（insert/delete）不是立刻可见的——有 segment 合并过程。**验收时用 count + 实际检索双确认**。

## 七、总结

### 7.1 要点回顾

1. 向量库按**相似度**查，不是按值查；核心优势是 ANN 索引 + 标量过滤 + 隔离
2. 四个概念：**Collection（表）/ Schema（结构）/ Partition（分区）/ Index（索引）**
3. Schema 三要素：**vector（检索）、text（喂模型）、metadata（过滤+出处）**
4. HNSW 参数：M=16、efConstruction=200、ef=64~128（按 SLO 调）
5. 多租户：**partition 隔离**（少量大租户）vs **标量过滤**（海量小租户）；**检索必带 tenant 过滤**

### 7.2 自测清单

<details>
<summary>Q1：Milvus 的 Collection 和 Partition 分别是什么？</summary>

Collection 类似关系库的表，存放一类数据；Partition 是 Collection 内的分区，可按租户/知识库划分，提升隔离性与检索效率。
</details>

<details>
<summary>Q2：Schema 里为什么要存 text 和 metadata？</summary>

向量只用于检索；检索命中后要把原文（text）喂给 LLM，metadata 用于过滤（kb_id/tenant_id）和标注出处（doc_id/chunk_idx）。
</details>

<details>
<summary>Q3：多租户隔离有哪两种做法？怎么选？</summary>

Partition 隔离（物理、性能好，但数量受限）与标量字段过滤（简单、可扩展，但要防漏加条件）；按租户规模组合使用。
</details>

<details>
<summary>Q4：为什么检索必须带 tenant_id 过滤？</summary>

否则会召回其他租户的数据，造成数据泄露——这是多租户系统的安全红线，通常在 DAO 层统一注入。
</details>

### 7.3 面试视角（🔥）

| 面试问法 | 答题要点 |
|---|---|
| 为什么用 Milvus/向量库？ | 相似度检索、ANN 索引、标量过滤、多租户、持久化 |
| Milvus 怎么建索引？ | HNSW + COSINE；M/efConstruction 建图、ef 查询 |
| 多租户怎么隔离？ | partition 或标量字段过滤；检索强制带 tenant 条件 |
| 向量库和 ES 的区别？ | ES 擅长关键词/倒排；向量库擅长语义相似；实践中常组合（混合检索） |
| 数据怎么更新？ | 按 doc_id 删除旧 chunk + 插入新 chunk；或用版本字段切换 |

### 7.4 下一步

工具都认识了。下一篇动手：**用 VibeCoding 搭一条最小可运行的混合检索 RAG**——把前四篇的知识连成一条线。

---

*本文对应素材：`RAG2/01_课件/site/04-milvus-index-and-operations.html`*
