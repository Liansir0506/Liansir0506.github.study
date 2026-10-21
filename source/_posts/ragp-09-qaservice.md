---
title: QAService 核心编排：一次问答的调度中心
date: 2026-10-22 18:30:00
categories:
  - 项目篇
  - RAG 问答系统
tags:
  - QAService
  - 服务编排
  - 缓存设计
  - 降级策略
description: 意图、计划、改写、检索、重排、生成——把散落的能力串成一次可控的问答请求，还要有缓存、超时和降级
mathjax: true
---

> **一句话概括**：QAService 是问答系统的"总调度"——它决定用哪个链路、调度哪些组件、失败时怎么兜底，是工程复杂度的集中地。
> **这篇有多重要**：🔥 —— 面试问"一次请求的处理流程"，答的就是 QAService 的编排逻辑。
> **前置知识**：ragp-05 意图、ragp-06 计划、ragp-07 改写、ragp-08 混合检索
> **对应素材**：`RAG2/01_课件/site/09-qaservice-orchestration.html`

## 一、初识：QAService 的职责边界

前面每篇都实现了一个"零件"：意图分类器、计划生成器、改写器、检索器、Reranker、生成器。

**QAService 负责把它们按顺序、按条件组合起来**，并处理工程问题：

| 职责 | 具体内容 |
|---|---|
| **编排** | 按意图选链路、按计划执行各组件 |
| **缓存** | embedding、检索结果、改写结果 |
| **降级** | 某环节失败时的兜底路径 |
| **超时** | 总预算分配（如 3 秒） |
| **可观测** | 每步耗时、命中率、trace_id |

> 📌 原则：**编排层不做具体的事**，它只负责"调度 + 兜底 + 观测"——具体能力都封装在各自的组件里。

## 二、初识：一次请求的完整链路

```text
请求进入
  ↓ ① 预处理：参数校验、会话/租户识别
  ↓ ② 意图分类（缓存命中则跳过）
  ├─ chitchat → 直接回复（走闲聊链路）
  ├─ human    → 转人工
  └─ faq/document → 继续
  ↓ ③ 生成检索计划（引用意图 + 会话上下文）
  ↓ ④ 查询改写（计划要求时；多轮需先补全）
  ↓ ⑤ 混合检索（Dense + BM25，按计划参数）
  ↓ ⑥ RRF 融合 + Reranker 精排
  ↓ ⑦ 拼装 Prompt（上下文 + 引用要求 + 拒答策略）
  ↓ ⑧ LLM 生成（流式）
  ↓ ⑨ 后处理：引用校验、敏感词、格式化
响应返回（含答案、引用、trace_id）
```

### 2.1 关键设计：并行与提前返回

| 优化 | 做法 |
|---|---|
| **并行** | 多路检索、多个变体检索用 `asyncio.gather` 并发 |
| **早退** | 闲聊/转人工在 ② 就返回，不进检索 |
| **流式** | ⑧ 生成时边生成边返回，用户不用等完整答案 |
| **缓存** | ②⑥ 命中缓存直接跳过 |

## 三、运用：三层缓存设计

RAG 的瓶颈往往在"embedding + 检索 + 生成"三处，都可以缓存：

| 缓存 | Key | 命中率 | 失效策略 |
|---|---|---|---|
| **Embedding 缓存** | 文本的 hash | 高（问题重复率高） | 按模型版本 |
| **检索结果缓存** | 归一化后的 query + 计划参数 + **kb_version** | 中高 | **cache_epoch 版本失效** |
| **意图/改写缓存** | query + 会话前缀 | 中 | 短期 TTL |

### 3.1 关键：cache_epoch 绑定知识库版本

```python
# 知识库每次发布新版本，epoch +1
cache_key = f"retrieval:{normalize(query)}:{kb_version}:{plan_hash}"

# 版本更新后，旧 key 自然不再命中（等价于整批失效）
```

> 🔥 **为什么必须绑定版本**：知识库更新后，缓存的旧检索结果就是"过期知识"——必须随版本失效，否则用户永远看到旧答案。这是很多人踩过的坑。

## 四、运用：分级降级策略

真实系统里，任何一环都可能失败（模型超时、Milvus 慢、Reranker 挂了）。**降级不是"出错就返回 500"，而是"退而求其次"**：

| 失败点 | 降级方案 |
|---|---|
| 意图分类超时 | 按 document 处理（最完整的链路） |
| 计划生成失败 | 用默认计划（dense10 + sparse10 + rerank3） |
| 改写失败 | 用原问题检索 |
| **Reranker 超时/挂** | 跳过精排，直接用 RRF 融合结果 top3 |
| 混合检索某一路失败 | 用单路结果继续 |
| LLM 超时 | 返回"已检索到相关资料"+ 检索片段，或转人工 |

> 📌 降级的设计原则：**优先保证"有响应"，再保证"响应质量"**。用户等 30 秒拿 500 错误，比 3 秒拿到一个降级答案更糟。

## 五、运用：代码结构（服务层骨架）

```python
class QAService:
    def __init__(self, intent, planner, rewriter, retriever, reranker, generator):
        self.intent = intent
        self.planner = planner
        self.rewriter = rewriter
        self.retriever = retriever
        self.reranker = reranker
        self.generator = generator

    async def answer(self, query: str, session: Session) -> QAResponse:
        trace = Trace(trace_id=uuid4().hex)

        # ① 意图（带降级）
        with trace.step("intent"):
            intent = await self.intent.classify(query) or Intent.document()

        if intent.name == "chitchat":
            return await self._chitchat(query)
        if intent.name == "human":
            return QAResponse.transfer_human()

        # ② 计划
        with trace.step("plan"):
            plan = await self.planner.plan(query, intent, session)

        # ③ 改写（多轮先补全）
        with trace.step("rewrite"):
            queries = await self.rewriter.rewrite(query, session) if plan.need_rewrite else [query]

        # ④⑤⑥ 检索 + 融合 + 精排
        with trace.step("retrieval"):
            hits = await self.retriever.search(queries, plan, session)
            if not hits:
                return QAResponse.no_result()          # 明确说"没找到"
            chunks = await self.reranker.rerank(query, hits, plan.rerank_top_n)

        # ⑦⑧ 生成（流式）
        with trace.step("generate"):
            stream = self.generator.stream(query, chunks)

        return QAResponse(stream=stream, sources=chunks, trace_id=trace.id)
```

### 5.1 超时预算怎么分配

假设总预算 3 秒：

| 环节 | 预算 | 超时后 |
|---|---|---|
| 意图 + 计划 | 400ms | 用默认 |
| 改写 | 400ms | 用原问题 |
| 检索（并行） | 600ms | 单路结果 |
| 精排 | 300ms | 跳过精排 |
| 生成 | 剩余（流式） | 先返回已生成内容 |

> 💡 超时不是"每个环节设 3 秒"，而是**总预算减去已用时间**——这叫"超时预算传递"。

## 六、总结

### 6.1 要点回顾

1. QAService 职责：**编排 + 缓存 + 降级 + 超时 + 可观测**，不做具体能力
2. 一次请求 9 步：预处理 → 意图 → 计划 → 改写 → 混合检索 → 融合精排 → Prompt → 流式生成 → 后处理
3. 三层缓存：**embedding / 检索结果 / 意图改写**；检索缓存**必须绑定 kb_version**
4. 降级分级：某环节失败时"退而求其次"，**先保证有响应**
5. 超时用**预算传递**，不是每环节固定超时

### 6.2 自测清单

<details>
<summary>Q1：QAService 和各个组件的关系？</summary>

QAService 是编排层：按意图和计划调度组件、管理缓存/超时/降级/观测；具体能力（分类、检索、生成）由组件实现，便于替换和测试。
</details>

<details>
<summary>Q2：为什么检索缓存要绑定知识库版本？</summary>

知识库更新后旧检索结果已过期；用 kb_version 作为 key 的一部分，版本变更后自然失效，避免返回旧知识。
</details>

<details>
<summary>Q3：Reranker 挂了怎么办？</summary>

降级：跳过精排，直接用 RRF 融合后的结果取 top3；保证服务可用性优先于最优质量。
</details>

<details>
<summary>Q4：超时预算怎么设计？</summary>

设定总预算（如 3s），各环节分配子预算并传递剩余时间；某环节超时走降级，而不是整体失败。
</details>

### 6.3 面试视角（🔥）

| 面试问法 | 答题要点 |
|---|---|
| 一次问答请求的完整流程？ | 预处理→意图→计划→改写→检索→融合精排→Prompt→生成→后处理 |
| RAG 系统怎么做缓存？ | embedding/检索结果/意图改写三层缓存；检索缓存绑 kb_version |
| 怎么保证可用性？ | 分级降级 + 超时预算 + 熔断限流 + 兜底回复 |
| 怎么定位一次慢请求？ | trace 记录每步耗时与命中情况，找最慢环节 |
| 编排层该做什么不该做什么？ | 只做调度/缓存/降级/观测；具体能力放在组件里 |

### 6.4 下一步

编排的骨架有了，接下来看最核心的两块内容：**Pipeline 主流程**和**Prompt 怎么设计**。

---

*本文对应素材：`RAG2/01_课件/site/09-qaservice-orchestration.html`*
