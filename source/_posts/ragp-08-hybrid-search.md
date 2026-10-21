---
title: Milvus 混合检索：Dense + BM25 + Reranker
date: 2026-10-22 18:00:00
categories:
  - 项目篇
  - RAG 问答系统
tags:
  - 混合检索
  - Reranker
  - Milvus
description: 双路召回怎么融合、RRF 的 k 怎么调、Reranker 怎么选怎么用——把"检索准确率"真正做上去
mathjax: true
---

> **一句话概括**：混合检索 = 向量懂语义 + BM25 懂精确，用 RRF 融合，再用 Reranker 精排——三步把召回准确率拉满。
> **这篇有多重要**：🔥🔥 —— **这个项目技术含量的核心**。面试深挖 RAG 时，能讲清 RRF 和 Reranker 就是加分项。
> **前置知识**：ragp-01 的 Dense/Sparse、ragp-03 的 Milvus、ragp-04 的最小链路
> **对应素材**：`RAG2/01_课件/site/08-milvus-hybrid-search.html`

## 一、初识：为什么两路都要

回顾 ragp-01 的结论：

| 检索方式 | 强项 | 短板 |
|---|---|---|
| **Dense（向量）** | 语义相近（"退钱"≈"退款"） | 型号/编号/专有名词容易"泛化掉" |
| **BM25（稀疏）** | 精确词命中（XR-2000、GB/T 1234） | 不懂同义词，口语化提问召回差 |

**真实问题两种需求同时存在** → 单路必漏 → 双路召回 + 融合。

## 二、初识：RRF 融合（倒数排名融合）

<svg class="lm-diagram" viewBox="0 0 720 330" role="img" xmlns="http://www.w3.org/2000/svg">
  <title>混合检索与 RRF 融合流程</title>
  <defs>
    <marker id="dArrH" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M2 1L8 5L2 9" fill="none" stroke="#49b1f5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
  </defs>
  <rect x="20" y="120" width="104" height="56" rx="8" class="d-box-soft"/>
  <text x="72" y="146" class="d-accent-ink" text-anchor="middle">Query</text>
  <text x="72" y="164" class="d-sub" text-anchor="middle">用户问题</text>
  <rect x="170" y="46" width="150" height="60" rx="8" class="d-box"/>
  <text x="245" y="72" class="d-ink" text-anchor="middle">向量检索</text>
  <text x="245" y="90" class="d-sub" text-anchor="middle">Milvus · 余弦相似度</text>
  <rect x="170" y="196" width="150" height="60" rx="8" class="d-box"/>
  <text x="245" y="222" class="d-ink" text-anchor="middle">全文检索</text>
  <text x="245" y="240" class="d-sub" text-anchor="middle">ES · BM25 词权重</text>
  <line x1="124" y1="140" x2="160" y2="82" class="d-flow" marker-end="url(#dArrH)"/>
  <line x1="124" y1="156" x2="160" y2="220" class="d-flow" marker-end="url(#dArrH)"/>
  <rect x="360" y="46" width="130" height="60" rx="8" class="d-box"/>
  <text x="425" y="64" class="d-sub" text-anchor="middle">向量路排名</text>
  <text x="425" y="84" class="d-ink" text-anchor="middle">C₁ · A₂ · E₅ …</text>
  <rect x="360" y="196" width="130" height="60" rx="8" class="d-box"/>
  <text x="425" y="214" class="d-sub" text-anchor="middle">BM25 路排名</text>
  <text x="425" y="234" class="d-ink" text-anchor="middle">B₁ · C₂ · F₄ …</text>
  <line x1="320" y1="76" x2="354" y2="76" class="d-flow" marker-end="url(#dArrH)"/>
  <line x1="320" y1="226" x2="354" y2="226" class="d-flow" marker-end="url(#dArrH)"/>
  <rect x="530" y="105" width="76" height="92" rx="10" class="d-box-soft"/>
  <text x="568" y="140" class="d-accent-ink" text-anchor="middle">RRF</text>
  <text x="568" y="160" class="d-sub" text-anchor="middle">融合</text>
  <text x="568" y="180" class="d-sub" text-anchor="middle">k=60</text>
  <line x1="490" y1="76" x2="524" y2="128" class="d-flow" marker-end="url(#dArrH)"/>
  <line x1="490" y1="226" x2="524" y2="176" class="d-flow" marker-end="url(#dArrH)"/>
  <rect x="530" y="232" width="150" height="52" rx="8" class="d-box"/>
  <text x="605" y="254" class="d-ink" text-anchor="middle">Reranker 精排</text>
  <text x="605" y="272" class="d-sub" text-anchor="middle">取最终 TopK</text>
  <line x1="568" y1="197" x2="568" y2="226" class="d-flow" marker-end="url(#dArrH)"/>
  <text x="360" y="312" class="d-sub" text-anchor="middle">两路都排得靠前的文档胜出——两个检索器都认可，就更可信</text>
</svg>
<p class="lm-diagram-cap">图 6 · 混合检索：两路各自召回，RRF 用「排名」而不是「分数」融合，绕开量纲问题，再交给 Reranker 精排</p>

### 2.1 为什么不用分数相加

- 向量路的分数是**余弦相似度**（0~1）
- BM25 路的分数是**词权重和**（可能是 0~30 不等）

量纲完全不同，直接相加会被一方主导。**用排名而不是分数**，就绕开了这个问题。

### 2.2 RRF 公式

$$RRF(d) = \sum_{i=1}^{N} \frac{1}{k + rank_i(d)}$$

- $rank_i(d)$：文档 d 在第 i 路结果中的排名（从 1 开始）
- $k$：平滑常数，常用 **60**
- 多路结果按 RRF 分数从高到低排序

**举个例子**：

| 文档 | 向量路排名 | BM25 路排名 | RRF 分数（k=60） |
|---|---|---|---|
| A | 2 | 8 | 1/62 + 1/68 ≈ 0.0308 |
| B | 5 | 1 | 1/65 + 1/61 ≈ 0.0318 |
| C | 1 | 未命中 | 1/61 ≈ 0.0164 |

→ B 两路都靠前，融合后排第一；C 只在向量路径出现，排名靠后。

> 🔥 **RRF 的妙处**：**两路都排得靠前的文档会胜出**——这正好符合"两个检索器都认可，就更可信"的直觉。

### 2.3 k 值怎么理解

| k | 效果 |
|---|---|
| 小（如 10） | 排名差异被放大（第 1 名和第 2 名差距大） |
| 大（如 60+） | 排名差异被平滑（前几名差距小） |

> 经验：**k 取 60 是论文默认值，多数场景不用改**。如果你的场景"第一名特别重要"，可以调小。

## 三、运用：Milvus 2.5 的混合检索 API

Milvus 2.5 原生支持多路检索 + 融合：

```python
from pymilvus import AnnSearchRequest, RRFRanker

# ① 向量路
dense_req = AnnSearchRequest(
    data=[query_vec],
    anns_field="dense_vector",
    param={"metric_type": "COSINE", "params": {"ef": 64}},
    limit=20,
)

# ② 稀疏路（BM25 字段）
sparse_req = AnnSearchRequest(
    data=[query_text],
    anns_field="sparse_vector",      # BM25 Function 生成的稀疏向量
    param={"metric_type": "BM25"},
    limit=20,
)

# ③ 融合
results = client.hybrid_search(
    collection_name="knowledge_chunks",
    reqs=[dense_req, sparse_req],
    ranker=RRFRanker(k=60),
    limit=20,                          # 融合后取 20 条进入精排
    output_fields=["text", "doc_id", "chunk_idx"],
    filter='tenant_id == "t001"',
)
```

三种 ranker 可选：

| Ranker | 说明 | 适合 |
|---|---|---|
| **RRFRanker(k=60)** | 按排名融合 | **默认推荐**，鲁棒 |
| WeightedRanker(0.7, 0.3) | 按权重加权融合 | 明确知道哪路更重要时 |
| 自己实现 | 拉两路结果在应用层融合 | 需要自定义逻辑（如加时间衰减） |

> 📌 `limit` 分两层：每路 `limit=20`（召回），`hybrid_search` 的 `limit=20`（融合后候选）——别搞混。

## 四、运用：Reranker 精排

### 4.1 为什么还要精排

向量检索是**双塔结构**（问题和文档分开编码）——快但粗。
**Cross-Encoder Reranker** 把"问题 + 文档"拼在一起编码——准但慢。

所以：**粗排召回 20 → 精排取 3~5**，兼顾效果与速度。

### 4.2 选型

| 模型 | 特点 |
|---|---|
| **bge-reranker-v2-m3** | 当前主流，多语言、效果好 |
| bge-reranker-base / large | 轻量/更强 |
| Cohere Rerank（API） | 免部署，按调用付费 |

### 4.3 用法

```python
from FlagEmbedding import FlagReranker

reranker = FlagReranker("BAAI/bge-reranker-v2-m3", use_fp16=True)

pairs = [(question, hit["text"]) for hit in fused_hits]
scores = reranker.compute_score(pairs, normalize=True)    # 0~1

ranked = sorted(zip(fused_hits, scores), key=lambda x: -x[1])
top_chunks = [h for h, s in ranked[:3] if s > 0.3]         # 阈值过滤
```

> 🔥 两个细节：
> 1. **要设分数阈值**——全部低于阈值时说明"没找到相关内容"，宁可拒答
> 2. **精排条数别太多**——20 条 rerank 在 CPU 上可能要 200ms+，按 SLO 调

## 五、初识：调优的四个旋钮（按效果优先级）

| 旋钮 | 调什么 | 影响 |
|---|---|---|
| **① 切片质量** | chunk 大小/重叠/按结构切 | **影响最大**——切错了，检索再优化也白搭 |
| **② 双路召回数** | 每路 10~20 | 召回不够 → 精排没得选；太多 → 延迟上升 |
| **③ RRF k 与权重** | k=60，或 WeightedRanker | 影响融合排序 |
| **④ Reranker 阈值** | 0.2~0.5 按业务调 | 决定"答"还是"拒答" |

> 📌 调优方法：**固定 20~50 条评测问题，逐项改一个参数，看 Recall@3 和延迟**。别一次改三个，否则不知道是谁的功劳。

## 六、初识：混合检索的常见问题

| 现象 | 可能原因 | 排查 |
|---|---|---|
| 正确的没进 top3 | ①切片切碎了 ②两路都没召回 ③RRF 把正确的排下去 | 分路看召回，再看融合前后排名 |
| 型号/编号搜不到 | BM25 分词问题（"-" 被切开） | 预处理统一格式，或调分词器 |
| 延迟太高 | rerank 条数多 / 模型太大 | 减候选、用小模型、GPU |
| 结果重复度高 | 切片重叠过大 / 同一文档多段 | 去重（按 doc_id 分组取最优） |

## 七、总结

### 7.1 要点回顾

1. 混合检索 = **Dense（语义）+ BM25（精确）双路召回**
2. **RRF**：按排名倒数加权融合，k 默认 60——避免分数量纲问题
3. Milvus 2.5 原生 `hybrid_search` + `RRFRanker` / `WeightedRanker`
4. **Reranker**：Cross-Encoder 精排，粗排 20 → 精排 3~5，**要设阈值**
5. 调优优先级：**切片 > 召回数量 > 融合参数 > 精排阈值**；一次只改一个

### 7.2 自测清单

<details>
<summary>Q1：RRF 为什么用排名而不是分数？</summary>

向量相似度和 BM25 分数分数量纲不同（0~1 vs 0~30），直接相加会被一方主导；排名是无量纲的，融合更公平鲁棒。
</details>

<details>
<summary>Q2：Reranker 和向量检索的本质区别？</summary>

向量检索是双塔（分别编码后算相似度）——快但粗；Reranker 是交叉编码（问题+文档一起编码）——准但慢，所以用于精排。
</details>

<details>
<summary>Q3：精排后为什么还要设分数阈值？</summary>

防止"硬凑"：所有候选都不相关时，靠阈值判断"没找到"，触发拒答或兜底，避免基于无关内容编造答案。
</details>

<details>
<summary>Q4：混合检索效果不好先查什么？</summary>

先查切片质量（最常见问题），再分路看召回（哪一路漏了），最后看融合与精排是否把正确的排下去了。
</details>

### 7.3 面试视角（🔥🔥）

| 面试问法 | 答题要点 |
|---|---|
| 混合检索怎么做？ | Dense + BM25 双路召回，RRF/加权融合，再 Reranker 精排 |
| RRF 的公式和 k？ | Σ 1/(k+rank)，k=60 默认；用排名避免分数量纲问题 |
| Reranker 为什么有效？ | 交叉编码能建模问题与文档的交互，比双塔更准；只对少量候选用 |
| 怎么调优检索效果？ | 固定评测集，按 切片→召回数→融合→阈值 的顺序逐项调 |
| 检索延迟太高怎么优化？ | 减候选、并行、缓存、小模型、GPU、异步 |

### 7.4 下一步

检索这块到位了。接下来是"调度"：把意图、计划、改写、检索、生成串成一次完整的问答——**QAService**。

---

*本文对应素材：`RAG2/01_课件/site/08-milvus-hybrid-search.html`*
