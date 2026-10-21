---
title: 检索策略与动态计划：查什么、查几路
date: 2026-10-22 17:00:00
categories:
  - 项目篇
  - RAG 问答系统
tags:
  - 检索策略
  - 混合检索
description: 把"检索"从写死的参数变成可编排的计划——不同问题用不同的查法，才是企业级 RAG 的做法
mathjax: true
---

> **一句话概括**：不是所有问题都该"向量库 top10"——检索计划决定查哪些库、各取多少、要不要改写、怎么融合。
> **这篇有多重要**：🔥 —— 从"能检索"到"检索得好"的关键设计；面试问"检索策略怎么设计"，这是标准答案。
> **前置知识**：ragp-03 的 Milvus、ragp-05 的意图分类
> **对应素材**：`RAG2/01_课件/site/06-retrieval-strategy.html`、`07-query-rewrite-variants.html`（计划部分）

## 一、初识：写死的参数有什么问题

ragp-04 的最小链路里，所有问题都走：

```text
向量检索 top10 → 融合 → rerank top3 → 生成
```

看起来够用，但真实场景里：

| 问题 | 理想策略 | 写死参数的后果 |
|---|---|---|
| "退款政策"（FAQ） | FAQ 库精确匹配 1~2 条即可 | 拉 10 条无关文档，干扰生成 |
| "怎么配置 XR-2000 的网关" | 精确型号 + 文档库 + BM25 权重高 | 向量检索把型号模糊掉，搜不到 |
| "年假多少天，病假怎么算，分别需要什么材料" | **拆成 3 个子问题**分别检索 | 一次检索只能覆盖一个点，答不全 |
| "你好"（闲聊） | 不检索 | 白白检索还污染上下文 |

**结论**：检索参数不该写死，应该**按问题动态生成**——这就是"检索计划"。

## 二、初识：检索计划长什么样

一个检索计划（Retrieval Plan）是个结构化对象：

```python
from pydantic import BaseModel, Field

class RetrievalPlan(BaseModel):
    use_faq: bool = Field(description="是否检索 FAQ 库")
    use_document: bool = Field(description="是否检索文档库")
    dense_top_k: int = Field(description="向量召回数量", default=10)
    sparse_top_k: int = Field(description="BM25 召回数量", default=10)
    dense_weight: float = Field(description="融合时向量路的权重", default=0.6)
    need_rewrite: bool = Field(description="是否需要查询改写", default=True)
    rerank_top_n: int = Field(description="精排后保留条数", default=3)
    sub_queries: list[str] = Field(description="拆解后的子问题（多跳问题用）", default=[])
```

> 🔥 计划的本质：**把"检索策略"从代码里的常量，变成模型可生成的数据**。

## 三、初识：按意图生成不同计划（对照表）

| 意图/场景 | FAQ | 文档 | Dense | BM25 | 改写 | 精排 |
|---|---|---|---|---|---|---|
| **faq** | ✅ top3 | ❌ | 5 | 5 | 否 | 1~2 |
| **document（一般）** | ❌ | ✅ | 10 | 10 | 是 | 3 |
| **document（含型号/编号）** | ❌ | ✅ | 8 | 15 | 是 | 3 |
| **多跳问题** | ❌ | ✅ | 各子问题 5 | 各子问题 5 | 是（拆解） | 5 |
| **chitchat** | ❌ | ❌ | — | — | — | — |

### 3.1 一个具体的生成 Prompt

```text
你是检索计划生成器。根据用户问题，生成检索计划 JSON。

规则：
1. 问的是标准政策（退款/营业时间/价格）→ use_faq=true，use_document=false
2. 问的是操作步骤/技术细节 → use_document=true，dense_top_k=10
3. 问题里出现型号、编号、专有名词 → sparse_top_k 提到 15（靠关键词精确命中）
4. 问题包含多个子问题（"……还有……"）→ 拆成 sub_queries
5. 需要多步推理 → sub_queries 拆成 2~3 个可独立检索的子问题
```

> 📌 关键：**让模型输出结构化计划，而不是让它直接检索**。计划可以被审查、被缓存、被灰度调整——这比"模型自由发挥"可控得多。

## 四、运用：按计划执行检索

```python
async def execute_plan(plan: RetrievalPlan, query: str):
    tasks = []

    if plan.use_faq:
        tasks.append(search_faq(query, top_k=plan.dense_top_k))

    if plan.use_document:
        if plan.need_rewrite:
            variants = await rewrite(query)          # ragp-07
        else:
            variants = [query]

        for q in variants:
            tasks.append(search_dense(q, plan.dense_top_k))
            tasks.append(search_sparse(q, plan.sparse_top_k))

    results = await asyncio.gather(*tasks)            # 并行执行
    fused = rrf_fuse(results)                         # 融合
    return rerank(query, fused)[: plan.rerank_top_n]  # 精排截断
```

三个设计要点：

| 要点 | 说明 |
|---|---|
| **并行** | 多路检索用 `asyncio.gather` 并发，总延迟≈最慢的那一路 |
| **融合** | 多路结果统一用 RRF（ragp-04 讲过） |
| **截断** | 精排后只留 top_n 喂 LLM，控制上下文长度 |

## 五、初识：策略调优的三个实用经验

### 5.1 先保证"召回得到"，再谈"排得准"

顺序：**召回率 → 排序质量 → 生成质量**。如果正确片段根本没被召回，后面怎么优化都没用。

### 5.2 参数要用数据说话

```text
固定 5 个测试问题，对比几组参数：
A: dense_top_k=10, sparse_top_k=10
B: dense_top_k=5,  sparse_top_k=20   （型号类问题多时）
C: dense_top_k=20, sparse_top_k=20   （追求召回上限）
→ 看 Recall@3 / Recall@5 和平均延迟，选最优
```

### 5.3 失败要有兜底

| 情况 | 兜底策略 |
|---|---|
| 检索结果为空 | 降级到 FAQ 或直接说"没找到，转人工" |
| 相似度全部低于阈值 | 不硬答，回复"未找到相关资料" |
| 计划生成失败（JSON 错） | 用默认计划（dense10 + sparse10 + rerank3） |

## 六、总结

### 6.1 要点回顾

1. 检索参数**不能写死**，要按问题生成**检索计划**
2. 计划是结构化数据：查哪些库、各取多少、权重要不要改写、精排留几条
3. 不同意图/场景有不同计划（FAQ 走精确匹配、型号类提高 BM25、多跳拆子问题）
4. 执行要点：**并行、RRF 融合、精排后截断**
5. 调优顺序：召回率 → 排序 → 生成；**失败要有兜底**

### 6.2 自测清单

<details>
<summary>Q1：为什么要生成"检索计划"而不是直接检索？</summary>

计划是结构化、可审查、可缓存的数据：不同问题可以用不同策略，出问题能定位是"计划错了"还是"执行错了"，比黑盒检索更可控。
</details>

<details>
<summary>Q2：含型号/编号的问题为什么要提高 BM25 权重？</summary>

型号、编号这类词对语义检索不敏感（容易被泛化掉），而关键词检索能精确命中，所以要提高 sparse 路的召回量与权重。
</details>

<details>
<summary>Q3：多跳问题怎么处理？</summary>

把复杂问题拆成 2~3 个可独立检索的子问题（sub_queries），分别检索后合并结果再生成——或用 Agent 化多轮检索。
</details>

<details>
<summary>Q4：检索结果为空怎么兜底？</summary>

不要硬答：可以降级到 FAQ、提示"未找到相关资料"、或转人工；计划生成失败时用默认计划。
</details>

### 6.3 面试视角（🔥）

| 面试问法 | 答题要点 |
|---|---|
| 检索策略怎么设计？ | 计划化：按意图生成参数（库/路数/权重/改写/精排），并行执行 + RRF 融合 |
| 召回率和延迟怎么平衡？ | 参数分档 + 缓存 + 并行 + 只对候选做精排 |
| 多跳问题怎么办？ | 子问题拆解 + 多次检索 + 合并；或 Agent 化 |
| 怎么定位检索差的原因？ | 分环节看：计划是否合理、召回是否有、融合/精排是否把正确的排下去 |

### 6.4 下一步

计划里有个开关 `need_rewrite`——下一篇专门讲它：**查询改写与变体生成**。

---

*本文对应素材：`RAG2/01_课件/site/06-retrieval-strategy.html`、`07-query-rewrite-variants.html`*
