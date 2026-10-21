---
title: 大模型与 Prompt 入门
date: 2026-10-21 16:00:00
categories:
  - 应用篇
  - 提示词工程
tags:
  - 提示词
  - 大模型
description: 大模型怎么调用、messages 三种角色怎么用、本地模型什么时候用——提示词工程的地基篇
mathjax: true
---

> **一句话概括**：不训练模型，学会"用嘴指挥"它——这就是 Prompt 工程。先搞清楚怎么跟大模型说话（API 与角色）。
> **这篇有多重要**：📌 —— API 调用是应用开发的基本功，面试会让你"写一段调用大模型的代码"。
> **前置知识**：nlp-05 的预训练模型概念（知道大模型是什么就行）
> **对应素材**：`01-讲义/① 大模型发展史`、`02-代码/day01/01-使用openai调用百炼模型.py`、`02-使用dashscope调用百炼模型.py`、`03-对话角色划分.py`、`day02/02-调用本地ollama模型.py`

## 一、初识：从"训模型"到"用模型"

前面的机器学习、深度学习、NLP 模块，学的都是**怎么造模型**。

但从这一篇开始，视角变了：**模型已经有人造好了（GPT、通义千问、DeepSeek…），我们要学会的是怎么"使唤"它。**

大模型（LLM）有个特点：**它只会做一件事——根据你给的文本，接着往下生成文本**。

想让它做对事，靠的就是**提示词（Prompt）**：

> **Prompt 工程（Prompt Engineering）= 设计输入文本，让大模型稳定输出你想要的结果。**

### 1.1 大模型发展简史（一句话线）

```text
规则系统（人工写 if-else）
  → 统计机器学习（特征工程）
  → 深度学习（神经网络）
  → Transformer（2017，注意力机制）
  → BERT（2018，理解）/ GPT（2018-，生成）
  → ChatGPT / 大模型时代（2022-，RLHF 对齐 + 千亿参数）
```

> 这段历史面试很少深挖，知道"Transformer 是分水岭、GPT 是生成路线"就够了。

## 二、运用：调用大模型的三种方式

### 2.1 方式一：OpenAI 兼容接口（最通用）

现在几乎所有国产大模型（通义千问、DeepSeek、Kimi…）都提供 **OpenAI 兼容接口**——换个 `base_url` 和 `model` 就能用：

```python
import openai

# 百炼（阿里云）的 OpenAI 兼容地址
client = openai.OpenAI(
    api_key="sk-xxx",
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
)

res = client.chat.completions.create(
    model="qwen-plus",
    messages=[{"role": "user", "content": "你好，介绍一下你自己"}]
)
print(res.choices[0].message.content)
```

> 这套写法几乎是行业标准：换模型只要改 `base_url` + `model` 两个参数。

### 2.2 方式二：厂商专用 SDK

```python
import dashscope

res = dashscope.Generation.call(
    model="qwen-plus",
    messages=[{"role": "user", "content": "你好"}]
)
print(res.output.text)
```

### 2.3 方式三：本地模型（ollama）

```bash
ollama run qwen2.5:7b     # 本地跑一个 7B 模型
```

```python
client = openai.OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
# 其余代码完全一样
```

**什么时候用本地模型？**

| 场景 | 说明 |
|---|---|
| **隐私敏感** | 数据不能出内网（医疗、金融） |
| **成本为零** | 高频调用不想烧钱 |
| **离线环境** | 没网也能用 |

代价：模型能力弱于云端旗舰（7B 和千亿参数没法比）。

## 三、初识：messages 的三种角色（关键）

大模型的对话输入不是一段文字，而是一个**消息列表**：

```python
messages = [
    {"role": "system",    "content": "你是一名资深 Python 面试官，提问犀利但友善。"},
    {"role": "user",      "content": "请出 3 道 Python 基础题。"},
    {"role": "assistant", "content": "1. 列表和元组的区别？……"},
    {"role": "user",      "content": "第一题能再详细点吗？"}
]
```

| 角色 | 作用 | 类比 |
|---|---|---|
| **system** | 设定人设、规则、边界 | 员工手册 / 岗前培训 |
| **user** | 用户的输入 | 客户提需求 |
| **assistant** | 模型的历史回复 | 员工之前说的话 |

### 3.1 为什么要分角色

- **system** 决定"你是谁、怎么说话"——一次设定，整个会话有效
- **assistant** 用于多轮对话：把历史回复带上，模型才知道"刚才聊到哪了"
- **user** 是当前指令

> 🔥 **多轮对话的本质**：大模型没有记忆，每一轮都是把**完整的历史 messages** 重新发一遍。所以对话越长，每次请求的 token 越多、越贵——这就是为什么需要"上下文管理"（后面 RAG 会讲怎么压缩）。

### 3.2 System Prompt 的实战价值

```python
messages = [
    {"role": "system", "content": """
你是一名金融风控助手。规则：
1. 只回答与信贷风险相关的问题，其他问题礼貌拒绝
2. 涉及具体投资建议时，必须声明"仅供参考，不构成投资建议"
3. 输出使用简洁的要点列表
"""},
    {"role": "user", "content": "帮我看看这只股票明天会涨吗？"}
]
```

> 好的 System Prompt 能做到：**限制领域（不乱答）、固定风格（格式统一）、降低风险（合规声明）**。

## 四、总结

### 4.1 要点回顾

1. Prompt 工程 = 设计输入文本，让大模型稳定输出想要的结果
2. 三种调用方式：**OpenAI 兼容接口（最通用）**、厂商 SDK、本地 ollama
3. messages 三种角色：**system（人设/规则）+ user（输入）+ assistant（历史回复）**
4. 多轮对话 = 每次带上完整历史；上下文越长越贵，需要管理
5. System Prompt 是控制模型行为的"总开关"：限定领域、统一格式、降低风险

### 4.2 自测清单

<details>
<summary>Q1：OpenAI 兼容接口的好处？</summary>

统一的调用方式，换厂商只需改 base_url 和 model，业务代码不用动。
</details>

<details>
<summary>Q2：system / user / assistant 三种角色的区别？</summary>

system 设定人设与规则；user 是用户输入；assistant 是模型的历史回复（多轮对话用）。
</details>

<details>
<summary>Q3：大模型有"记忆"吗？多轮对话怎么实现的？</summary>

没有记忆。每次请求都把完整的历史消息列表重新发送，模型基于全部上下文生成回复。
</details>

<details>
<summary>Q4：什么场景适合用本地模型？</summary>

数据隐私敏感、调用成本敏感、需要离线运行；代价是效果通常弱于云端大模型。
</details>

### 4.3 面试视角（📌）

| 面试问法 | 答题要点 |
|---|---|
| 怎么调用大模型 API？ | OpenAI 兼容接口（base_url + model + messages），或厂商 SDK |
| system prompt 有什么用？ | 设定角色/规则/输出格式，控制模型行为 |
| 多轮对话怎么保持上下文？ | 拼接完整 messages 历史；或做摘要压缩/滑动窗口 |
| 上下文长度限制怎么处理？ | 截断、摘要压缩、RAG 检索注入（只放入相关片段） |

### 4.4 下一步

会调 API 了，但"会说话"和"说得好"是两回事。下一篇讲最核心的提示词技巧：**角色设定、Few-shot、思维链**。

---

*本文对应素材：`01-讲义/① 大模型发展史`、`02-代码/day01/01-03`、`day02/02`*
