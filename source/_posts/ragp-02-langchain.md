---
title: LangChain 生态：把大模型应用拆成积木
date: 2026-10-22 15:00:00
categories:
  - 项目篇
  - RAG 问答系统
tags:
  - LangChain
  - 结构化输出
  - SSE
description: 六大核心抽象、LCEL 管道语法、结构化输出与流式生成——LangChain 到底值不值得用
mathjax: true
---

> **一句话概括**：LangChain 不是"魔法框架"，它只是把"调模型、拼 Prompt、检索、串联流程"这些重复动作抽成了积木——用不用都行，但要认识这套积木。
> **这篇有多重要**：🔥 —— 企业 RAG 项目的常见技术选型；面试问"为什么用 LangChain"，要说得出好处和局限。
> **前置知识**：pe-00 的 messages 三角色、ragp-01 的 embedding
> **对应素材**：`RAG2/01_课件/site/03-langchain-ecosystem.html`

## 一、初识：LangChain 解决什么问题

不用框架时，一个 RAG 问答要写：

```python
# 手写版：调模型
res = client.chat.completions.create(model=..., messages=[...])

# 手写版：解析 JSON 输出
data = json.loads(res.choices[0].message.content)

# 手写版：拼检索上下文
prompt = f"根据以下资料回答：{context}\n问题：{question}"

# 手写版：调用向量库
hits = milvus.search(...)
```

每一块都能写，但**项目一大，就会到处重复、难以复用和替换**。

LangChain 的价值：**把这些能力统一成标准接口**——换模型、换向量库、换 Prompt 只要改一行。

> 📌 一句话定位：**LangChain 是"胶水层"**，它不生产能力，只负责把能力拼起来。

## 二、初识：六大核心抽象（认识这些就够用）

| 抽象 | 是什么 | 对应代码 |
|---|---|---|
| **Model** | 大模型/Embedding 的统一接口 | `ChatOpenAI`、`OpenAIEmbeddings` |
| **Message** | 对话消息（system/user/assistant/tool） | `SystemMessage`、`HumanMessage` |
| **Prompt** | 提示词模板（支持变量） | `ChatPromptTemplate` |
| **Document** | 文档对象（内容 + 元数据） | `Document(page_content=..., metadata=...)` |
| **Splitter** | 文档切分器 | `RecursiveCharacterTextSplitter` |
| **VectorStore** | 向量库统一接口 | `Milvus`、`Chroma` |

> 🔥 这六个抽象对应 RAG 的每个环节——理解了它们，任何 LangChain 项目都能读懂。

### 2.1 一个最小的 RAG 用 LangChain 写

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

llm = ChatOpenAI(model="qwen-plus", base_url="...")

prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个知识库助手，只根据资料回答，没有就说不知道。"),
    ("human", "资料：{context}\n问题：{question}"),
])

chain = prompt | llm | StrOutputParser()
answer = chain.invoke({"context": "...", "question": "..."})
```

## 三、运用：LCEL——用"管道符"串流程

`prompt | llm | parser` 这种写法就是 **LCEL（LangChain Expression Language）**：

```text
输入 → Prompt 模板 → 模型 → 输出解析 → 结果
```

它自动带来三个能力：

| 能力 | 说明 |
|---|---|
| **流式** | `chain.stream()` 逐块输出 |
| **批处理** | `chain.batch([...])` 并行处理多条 |
| **异步** | `await chain.ainvoke()` |

> 💡 LCEL 的本质是**函数组合**：每个组件都是"输入→输出"的可调用对象，`|` 就是把它们串起来。和 Linux 管道一个思想。

## 四、运用：结构化输出（让模型稳定返回 JSON）

RAG 里的意图分类、查询改写都需要"结构化结果"。LangChain 提供了 `with_structured_output`：

```python
from pydantic import BaseModel, Field

class IntentResult(BaseModel):
    intent: str = Field(description="意图类型：faq/document/chitchat/human")
    confidence: float = Field(description="置信度 0~1")

structured_llm = llm.with_structured_output(IntentResult)
result = structured_llm.invoke("你们的退款政策是什么？")
print(result.intent)        # "faq"
print(result.confidence)    # 0.92
```

对比"Prompt 里写请返回 JSON + 手动解析"：

| | 手写 JSON 约束 | with_structured_output |
|---|---|---|
| 可靠性 | 中（可能带多余文字） | 高（框架层保证 schema） |
| 代码量 | 多（解析+兜底） | 少 |
| 兼容性 | 通用 | 依赖模型支持 function calling |

> 🔥 对应 pe-02 讲的结构化输出：**Prompt 约束 → JSON Mode → Function Calling**，LangChain 封装了第三层。

## 五、运用：流式输出（打字机效果）

大模型回答要 5 秒，用户等不了——流式让首字 0.5 秒就出来：

```python
for chunk in chain.stream({"context": ctx, "question": q}):
    print(chunk, end="", flush=True)
```

在 Web 服务里（FastAPI）配合 SSE / WebSocket 推给前端——这就是 ChatGPT 那种"一个字一个字蹦出来"的实现。

## 六、初识：LangChain 的争议（要客观看待）

| 优点 | 缺点 |
|---|---|
| 快速搭建、接口统一 | 抽象层多，出问题难排查 |
| 生态丰富（各类 loader/retriever） | 版本迭代快，API 常变 |
| 换模型/向量库成本低 | 复杂业务会被框架"框住" |

> 📌 行业现状：**简单项目直接用 SDK 更清爽；中大型项目用 LangChain 提效；极复杂/高性能场景可能自己封装。**
>
> 面试答法："LangChain 适合快速搭建和标准化，但要清楚它每层在干什么——出了问题能拆开看。"

## 七、总结

### 7.1 要点回顾

1. LangChain 是**胶水层**：统一模型、消息、Prompt、文档、切分、向量库的接口
2. 六大抽象对应 RAG 每个环节：Model / Message / Prompt / Document / Splitter / VectorStore
3. **LCEL**：`prompt | llm | parser`，自带流式、批处理、异步
4. **structured_output**：比手写 JSON 约束更可靠（走 function calling）
5. 客观看待：提效但增加抽象；要能拆开看每一层

### 7.2 自测清单

<details>
<summary>Q1：LangChain 的六大核心抽象？</summary>

Model（模型）、Message（消息）、Prompt（提示词模板）、Document（文档对象）、Splitter（切分器）、VectorStore（向量库接口）。
</details>

<details>
<summary>Q2：LCEL 是什么？有什么好处？</summary>

用 `|` 把组件串成管道的声明式语法；自动获得流式、批量、异步能力，代码更简洁。
</details>

<details>
<summary>Q3：with_structured_output 相比手写 JSON 的优势？</summary>

由框架层通过 function calling/JSON schema 保证输出结构，解析更可靠、代码更少。
</details>

<details>
<summary>Q4：什么时候不该用 LangChain？</summary>

简单场景（直接调 SDK 更轻）、需要极致性能/完全可控、复杂业务被框架抽象限制时。
</details>

### 7.3 面试视角（🔥）

| 面试问法 | 答题要点 |
|---|---|
| 为什么用 LangChain？ | 统一接口、快速搭建、易替换模型/向量库、LCEL 组合与流式 |
| LangChain 的缺点？ | 抽象层厚、排查难、版本变动快；核心逻辑要自己掌控 |
| LCEL 的原理？ | 组件都是可调用对象，管道组合成链；支持 invoke/stream/batch |
| 怎么做流式输出？ | chain.stream() + SSE/WebSocket 推送前端 |
| LangChain 和 LlamaIndex 的区别？ | LangChain 更通用（编排/Agent），LlamaIndex 更聚焦数据索引与检索 |

### 7.4 下一步

框架认识了，该认识"向量库"了：**Milvus 的索引机制与基本操作**。

---

*本文对应素材：`RAG2/01_课件/site/03-langchain-ecosystem.html`*
