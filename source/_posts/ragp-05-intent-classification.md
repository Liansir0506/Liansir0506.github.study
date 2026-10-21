---
title: 意图分类：先判断用户想问什么
date: 2026-10-22 16:30:00
categories:
  - 项目篇
  - RAG 问答系统
tags:
  - 意图分类
  - 结构化输出
description: FAQ、文档问答、闲聊、转人工——不同问题需要不同策略，意图分类就是整个问答系统的"总调度台"
mathjax: true
---

> **一句话概括**：不是所有问题都值得查知识库——先判断意图，再选路，避免"所有问题都检索一遍还答不准"。
> **这篇有多重要**：📌 —— 工程化 RAG 的分水岭之一；面试问"你的系统怎么处理不同类型问题"，就答它。
> **前置知识**：pe-01 的分类思路、ragp-04 的最小链路
> **对应素材**：`RAG2/01_课件/site/05-intent-classification.html`

## 一、初识：不分意图会怎样

最小链路（ragp-04）对任何问题都走同一套流程。真实场景里这会出三类问题：

| 用户输入 | 直接走 RAG 的结果 | 期望行为 |
|---|---|---|
| "你好呀" | 检索一堆无关文档，硬编答案 | 直接闲聊回复 |
| "你们公司年假几天？" | 检索可能命中，但也可能命中"请假流程" | 走 FAQ 精确匹配 |
| "我要投诉！转人工！" | 检索文档、给一堆流程说明 | 直接转人工 |

**意图分类**就是在检索之前加一道判断：

```text
用户输入 → 意图分类 → {faq, document, chitchat, human, sensitive} → 各走各的路
```

## 二、初识：五类典型意图

| 意图 | 说明 | 处理策略 |
|---|---|---|
| **FAQ** | 标准化问题（"怎么退款"） | 精确匹配 FAQ 库，直接回标准答案 |
| **document** | 需要从长文档里找答案 | 走完整 RAG：改写→混合检索→重排→生成 |
| **chitchat** | 问候、寒暄、情绪表达 | 直接让 LLM 闲聊，不检索 |
| **human** | 明确要人工、投诉 | 直接转人工，别用 AI 硬答 |
| **sensitive** | 涉及合规/隐私/危险信息 | 拒答或转专人处理 |

> 🔥 注意 **human 和 sensitive 两类**——很多 demo 会忽略它们，但这恰恰是企业级系统"能不能上线"的关键：**该转人的必须转人，该拒的必须拒**。

## 三、初识：三种实现方式怎么选

| 方式 | 做法 | 优点 | 缺点 | 适合 |
|---|---|---|---|---|
| **规则匹配** | 关键词/正则 | 快、零成本、可控 | 覆盖有限、生硬 | 明确的转人工/敏感词 |
| **小模型分类** | 微调 BERT 分类器 | 快、便宜、稳定 | 需要标注数据、意图变更要重训 | 意图固定、量大 |
| **LLM 分类** | Prompt + 结构化输出 | 零样本、理解能力强、改起来快 | 慢一点、有成本 | **早期/意图常变/量不大** |

### 3.1 工程上的常见组合

```text
① 规则前置：命中"转人工""投诉""人工客服" → 直接 human（快、准）
② 敏感词过滤：命中黑名单 → sensitive（安全兜底）
③ LLM 分类：其余走模型判断 faq / document / chitchat
④ 置信度兜底：置信度 < 阈值 → 走 document（最保守的完整链路）
```

> 📌 一句话：**规则兜底 + 模型分类**，既快又稳。

## 四、运用：LLM 分类的实现（结构化输出）

用 Pydantic 约束输出，避免"模型返回一段话还要解析"：

```python
from pydantic import BaseModel, Field

class IntentResult(BaseModel):
    intent: str = Field(description="意图，必须是 faq/document/chitchat/human 之一")
    confidence: float = Field(description="置信度 0~1")
    reason: str = Field(description="一句话判断依据")

INTENT_PROMPT = """你是一个企业客服系统的意图分类器。

分类标准：
- faq：标准化问题，有固定答案（退款政策、营业时间、价格）
- document：需要查阅文档才能回答（操作步骤、制度细节、技术说明）
- chitchat：问候、闲聊、情绪表达，不需要事实信息
- human：明确要求人工、投诉、紧急事项

用户输入：{query}

只输出结构化结果，不要解释。"""

result = structured_llm.invoke(INTENT_PROMPT.format(query=user_input))
print(result.intent, result.confidence)
```

### 4.1 分类结果怎么驱动下游

```python
def handle(query: str):
    intent = classify(query)

    if intent.intent == "chitchat":
        return llm_reply(query)                      # 直接闲聊

    if intent.intent == "human":
        return transfer_to_human()                   # 转人工

    if intent.intent == "faq":
        hit = faq_exact_match(query)                 # FAQ 精确匹配
        if hit:
            return hit.answer
        # 没命中 → 降级到文档链路（保守）
        return rag_answer(query)

    # document 或兜底：走完整 RAG
    return rag_answer(query)
```

> 💡 注意 FAQ 没命中时的**降级**：不直接说"不知道"，而是降级走文档检索——用户体验会好很多。

## 五、初识：分类做不好的三个坑

| 坑 | 表现 | 解决 |
|---|---|---|
| **意图边界模糊** | "退款要多久"是 FAQ 还是 document？ | 在 Prompt 里给**判定优先级**（有固定答案 → faq；需要查文档 → document） |
| **置信度不可信** | 模型说 0.99 但其实错了 | 别只用置信度：结合规则、抽样评估准确率 |
| **分类错误代价高** | 把"转人工"分错成 document，用户投诉升级 | **高风险意图（human/sensitive）用规则兜底**，不依赖模型 |

### 5.1 分类质量怎么评估

构造一个小测试集（每个意图 20~30 条真实问法），算**混淆矩阵**：

| | 预测 faq | 预测 document | 预测 human |
|---|---|---|---|
| 真实 faq | 25 | 3 | 0 |
| 真实 document | 4 | 22 | 1 |
| 真实 human | 0 | 2 | 26 |

> 看两点：**human 有没有被漏判**（漏判代价最大）、**faq 和 document 的混淆**（会走错链路但不算致命）。

## 六、总结

### 6.1 要点回顾

1. 意图分类解决"不同问题走不同策略"，避免所有问题都检索
2. 五类意图：**faq / document / chitchat / human / sensitive**（后两类最容易被忽略但最重要）
3. 三种实现：规则（快准但覆盖少）、小模型（便宜稳定但要标注）、**LLM（零样本、灵活，早期首选）**
4. 工程组合：**规则兜底（human/sensitive）+ LLM 分类 + 置信度降级**
5. 高风险意图不能只靠模型；FAQ 未命中要降级到文档链路

### 6.2 自测清单

<details>
<summary>Q1：为什么需要意图分类？</summary>

不同意图需要不同处理：闲聊不需检索、FAQ 可精确匹配、文档问题需完整 RAG、人工/敏感必须特殊处理；统一走 RAG 会浪费且答不准。
</details>

<details>
<summary>Q2：LLM 分类相比小模型分类的优劣？</summary>

优势：零样本、理解能力强、改 Prompt 即可调整；劣势：速度慢、有成本、结果可能有波动。意图固定且量大时用小模型更划算。
</details>

<details>
<summary>Q3：分类出错的代价一样吗？</summary>

不一样。把 human/sensitive 分错代价最高（用户投诉、合规风险），所以这两类用规则兜底；faq 与 document 混淆只是走错链路，可从降级策略缓解。
</details>

### 6.3 面试视角（📌）

| 面试问法 | 答题要点 |
|---|---|
| RAG 系统里为什么要意图分类？ | 分流、省成本、避免误答；高风险意图特殊处理 |
| 意图分类怎么实现？ | 规则兜底 + LLM/小模型分类 + 置信度与降级 |
| 怎么评估分类效果？ | 混淆矩阵 + 各类准确率，重点看高风险类的漏判 |
| 意图变了怎么办？ | LLM 分类改 Prompt 即可；小模型需重训 |

### 6.4 下一步

知道"问的是哪类问题"了，接下来决定"怎么查"——**检索策略与动态计划**。

---

*本文对应素材：`RAG2/01_课件/site/05-intent-classification.html`*
