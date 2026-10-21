---
title: 动手：用 VibeCoding 搭一条最小混合检索 RAG
date: 2026-10-22 16:00:00
categories:
  - 项目篇
  - RAG 问答系统
tags:
  - RAG
  - 混合检索
  - Reranker
  - VibeCoding
description: 文档→切片→向量→Milvus→混合检索→Reranker→LLM——一条能跑起来的最小链路，后面所有企业级能力都建在它上面
mathjax: true
---

> **一句话概括**：先别管多租户、版本治理、评测——**先让一条链路跑通**：能从文档里找到答案并生成回答，哪怕很粗糙。
> **这篇有多重要**：🔥 —— 这是整个项目模块的"第一次跑通"。有了这条最小链路，后面每一步都是在它上面加能力。
> **前置知识**：ragp-01 的混合检索、ragp-02 的 LangChain、ragp-03 的 Milvus
> **对应素材**：`RAG2/01_课件/site/04.5-vibe-coding-rag-practice.html`

## 一、初识：为什么先做"最小可运行"

新手常犯的错：一上来就想把架构画全——意图分类、多租户、版本管理、评测……结果两周过去，一个能问能答的 demo 都没有。

**正确姿势**：先跑通最小闭环，再逐层加能力。

```text
最小链路（本次目标）
文档 → 切片 → Embedding → Milvus → 混合检索 → Reranker → LLM → 答案

后面再加
意图路由 / 查询改写 / 多租户 / 版本治理 / 评测 / 观测
```

> 💡 这条最小链路的价值：**它让你拥有一个"能测"的基线**。后面每加一个能力，都能对比"加了之后效果变好还是变差"。

## 二、初识：VibeCoding 的正确用法（四步）

ragp-04 的实践单元强调用 VibeCoding 完成，具体是四个阶段：

| 阶段 | 你要做什么 | 产出 |
|---|---|---|
| **① 结构化需求** | 把需求写成"输入/输出/约束/验收" | 一份清晰的实现说明 |
| **② AI 规划** | 让 AI 拆任务、给方案，你先审方案 | 任务清单 + 技术方案 |
| **③ 分阶段实现** | 一次只让 AI 做一个可验证的小模块 | 一段段能跑的代码 |
| **④ 验收** | 用测试数据验证每个环节 | 可运行的链路 + 测试记录 |

> ⚠️ 关键：**先让 AI 出方案，别让它直接写代码**。方案错了，代码写得再快也是白写（eng-02 的五步循环）。

## 三、运用：六步搭起来

### 3.1 第一步：文档准备与切片

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,          # 每段约 500 字
    chunk_overlap=50,        # 重叠 50 字，防止切断语义
    separators=["\n\n", "\n", "。", "！", "？", " ", ""],
)
chunks = splitter.split_text(raw_text)
```

> 📌 中文切片要用中文分隔符（句号/问号/换行），否则会切出半句话。

### 3.2 第二步：向量化 + 入库

```python
from pymilvus import MilvusClient

client = MilvusClient(uri="http://localhost:19530")

# embedding（BGE-M3 或 API）
vectors = [embed(c) for c in chunks]

client.insert("demo_chunks", [
    {"id": f"d0_{i}", "vector": v, "text": c}
    for i, (c, v) in enumerate(zip(chunks, vectors))
])
```

### 3.3 第三步：混合检索（Dense + BM25）

```python
# ① Dense：向量检索
dense_hits = client.search(
    collection_name="demo_chunks",
    data=[embed(question)],
    limit=10,
    output_fields=["text"],
)

# ② Sparse：BM25 关键词检索
# Milvus 2.5 支持 Function + BM25，或用 rank_bm25 在内存里做
bm25_hits = bm25_search(question, top_k=10)
```

### 3.4 第四步：RRF 融合

```python
def rrf_fuse(list_a, list_b, k=60):
    """倒数排名融合：两路结果按排名倒数加权，无需分数可比"""
    scores = {}
    for ranked in (list_a, list_b):
        for rank, item in enumerate(ranked, start=1):
            scores[item["id"]] = scores.get(item["id"], 0) + 1 / (k + rank)
    return sorted(scores.items(), key=lambda x: -x[1])
```

> 🔥 RRF 的妙处：**两路检索的分数量纲不一样（余弦相似度 vs BM25 分数），没法直接相加**——用"排名"融合就绕开了这个问题。

### 3.5 第五步：Reranker 精排

```python
from FlagEmbedding import FlagReranker

reranker = FlagReranker("BAAI/bge-reranker-base", use_fp16=True)

pairs = [(question, item["text"]) for item in fused[:20]]
scores = reranker.compute_score(pairs)
top3 = [item for item, s in sorted(zip(fused[:20], scores), key=lambda x: -x[1])[:3]]
```

### 3.6 第六步：拼 Prompt + 生成

```python
context = "\n\n".join(f"[{i+1}] {item['text']}" for i, item in enumerate(top3))

answer = llm(f"""
只根据以下资料回答问题，资料里没有的信息回答"根据资料无法回答"。
回答时用 [1][2] 标注引用来源。

【资料】
{context}

【问题】
{question}
""")
```

## 四、初识：这条链路怎么验收

别看"能不能答"，要看每一环：

| 环节 | 验收方法 | 合格标准 |
|---|---|---|
| 切片 | 抽查 10 段 | 语义完整、不切断句子 |
| 入库 | `count()` 条数 | 与切片数一致 |
| **Dense 检索** | 用 5 个测试问题 | 正确片段进 Top5 ≥ 4 次 |
| **BM25 检索** | 含型号/编号的问题 | 能精确命中 |
| **RRF 融合** | 对比单路 vs 融合 | 融合后正确片段排名更靠前 |
| **Reranker** | 对比精排前后 | Top3 更准 |
| 生成 | 看是否引用资料 | 有出处、无编造 |

> 📌 这张表就是"最小评测集"的雏形——批 4 的 ragp-13 会把它做成完整的评测流程。

## 五、初识：这条链路"还缺什么"（为后面埋伏笔）

| 缺的能力 | 会在哪篇补 |
|---|---|
| 不知道问题类型，全都查一遍 | ragp-05 意图分类 |
| 检索参数写死，不按问题调整 | ragp-06 检索策略 |
| 用户说"那个东西怎么退"，改写不了 | ragp-07 查询改写 |
| 融合与精排的参数粗糙 | ragp-08 混合检索 |
| 没有统一调度、没缓存 | ragp-09 QAService |
| 知识库更新/回滚没有管理 | ragp-12 知识库治理 |
| 没有量化评测 | ragp-13 质量评测 |

> 💡 这张表就是后面几篇的"升级路线图"——**每一步都在给这条最小链路加一块能力**，而不是另起炉灶。

## 六、总结

### 6.1 要点回顾

1. 先跑通**最小闭环**（文档→检索→生成），再逐层加能力——否则永远是 PPT 架构师
2. VibeCoding 四步：结构化需求 → AI 规划（先审方案）→ 分阶段实现 → 逐环验收
3. 六步链路：切片（中文分隔符）→ 向量化入库 → **Dense + BM25 双路召回** → **RRF 融合** → **Reranker 精排** → Prompt + 生成（要求引用）
4. 验收要看**每一环**，不只看最终回答
5. 最小链路是基线——后面每加一个能力，都能对比效果

### 6.2 自测清单

<details>
<summary>Q1：为什么先用 RRF 融合而不是分数相加？</summary>

Dense（余弦相似度）和 BM25 的分数量纲不同，直接相加会被某一方主导；RRF 只用排名，避免量纲问题，鲁棒性好。
</details>

<details>
<summary>Q2：Reranker 放在哪一步？为什么？</summary>

放在融合之后、生成之前，对候选（如 Top20）做精细重排取 Top3~5——它比向量检索准但慢，所以只对少量候选做。
</details>

<details>
<summary>Q3：怎么验收一条 RAG 链路？</summary>

分环节验收：切片完整性、入库条数、单路召回命中、融合后排名提升、Reranker 后 Top3 准确率、生成是否引用资料。
</details>

### 6.3 面试视角（🔥）

| 面试问法 | 答题要点 |
|---|---|
| 你怎么搭一个最小 RAG？ | 切片→embedding→Milvus→混合检索→RRF→Reranker→Prompt 生成，逐环验证 |
| 混合检索怎么融合？ | RRF（排名倒数加权）或权重加权；RRF 免调分数量纲 |
| 怎么判断链路有效？ | 构造小评测集，量各环节指标（召回、Top3 命中、引用率） |
| 一开始就设计完整架构吗？ | 不，先最小闭环建立基线，再按问题逐步加能力 |

### 6.4 下一步

最小链路能跑了，但它还"看不懂问题"——下一篇给它加上第一层判断：**意图分类**。

---

*本文对应素材：`RAG2/01_课件/site/04.5-vibe-coding-rag-practice.html`*
