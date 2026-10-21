---
title: 提示词进阶：自洽性、链式提示与结构化输出
date: 2026-10-21 17:00:00
categories:
  - 应用篇
  - 提示词工程
tags:
  - Self-Consistency
  - 链式提示
  - 结构化输出
  - JSON
description: 一个答案不放心就多问几遍投票、复杂任务拆成多步做、输出让程序能直接解析——进阶三板斧
mathjax: true
---

> **一句话概括**：基础技巧解决"能不能做对"，进阶技巧解决"稳不稳定、能不能工程化"——自洽性提准确率、链式提可控性、结构化提可用性。
> **这篇有多重要**：🔥 —— 这三个手段是 RAG 和 Agent 里的标准配置（检索结果的自我校验、多步流程编排、JSON 输出），面试也会问"怎么提高输出可靠性"。
> **前置知识**：pe-01 的 Few-shot 与 CoT
> **对应素材**：`01-讲义/② 02-大模型提示词工程进阶`、`02-代码/day01/06-Self-Consistency的使用.py`、`day02/01-链式提示的使用.py`

## 一、初识：为什么需要"进阶"

基础技巧（角色/示例/CoT）能让模型"大概率做对"。但工程上还有三个问题：

| 问题 | 解法 |
|---|---|
| 单次回答不稳定（这次对、下次错） | **Self-Consistency：多问几次投票** |
| 任务太复杂，一次 Prompt 搞不定 | **链式提示：拆成多步** |
| 输出是自由文本，程序没法用 | **结构化输出：强制 JSON** |

## 二、运用：Self-Consistency——多路径采样 + 投票

### 2.1 思路

CoT 是"让模型想一遍"；自洽性是"**让模型想很多遍，然后投票**"：

```text
同一个问题 + 高温度采样 N 次
  → 得到 N 条推理路径和 N 个答案
  → 按答案出现次数投票，选最多的那个
```

为什么有效？——单次推理可能在某一步出错；但多条路径**错的地方往往不同**，正确答案会被多数路径收敛到。

> 本质：**用采样代替集成**。就像多个学生独立做同一道题，大多数人都选 C，那 C 更可能是对的。

### 2.2 代码示意

```python
from collections import Counter
import openai

client = openai.OpenAI(base_url="https://dashscope.aliyuncs.com/compatible-mode/v1")

def ask_once(question):
    res = client.chat.completions.create(
        model="qwen-plus",
        temperature=0.8,          # 温度调高，让每次推理路径不同
        messages=[{"role": "user", "content": question + "\n请逐步推理，最后一行只输出【答案】"}]
    )
    return res.choices[0].message.content

def self_consistency(question, n=5):
    answers = []
    for _ in range(n):
        text = ask_once(question)
        answer = text.split("【答案】")[-1].strip()   # 提取最终答案
        answers.append(answer)
    print("采样结果:", answers)
    return Counter(answers).most_common(1)[0][0]     # 投票

print(self_consistency("一个班级 40 人，60% 是女生，女生里 25% 戴眼镜，戴眼镜的女生多少人？"))
```

### 2.3 代价与适用

| 成本 | 说明 |
|---|---|
| **费用 × N** | 采样 5 次就是 5 倍 token |
| **延迟 × N** | 除非并发请求 |

> 适合：**答案可枚举**（选择题、数值、分类）+ **对准确率敏感**的场景。不适合：开放式生成（写文案——每篇都不一样，没法投票）。

## 三、运用：链式提示——把大任务拆成小步骤

### 3.1 为什么要拆

一次性给模型一个复杂任务，容易出现：漏步骤、质量不稳、错了没法改。

**链式提示（Prompt Chaining）**：把任务拆成几个串行的子任务，上一步的输出是下一步的输入。

```text
原文 → [步骤1：抽取要点] → [步骤2：按要点写初稿] → [步骤3：润色] → 成稿
```

每一步都能：
- 单独检查输出（哪步错了修哪步）
- 用不同的模型/Prompt（简单步骤用便宜的小模型）
- 加入程序校验（下一步之前先验证格式）

### 3.2 代码示意

```python
def step(prompt, text):
    res = client.chat.completions.create(
        model="qwen-plus",
        messages=[{"role": "user", "content": f"{prompt}\n\n【材料】\n{text}"}]
    )
    return res.choices[0].message.content

article = "……（一篇很长的技术文章）"

# 步骤 1：抽取要点
points = step("从文章中提取 5 个核心要点，每行一个，不要解释。", article)

# 步骤 2：基于要点写摘要
summary = step("根据要点写一段 200 字以内的摘要，面向非技术读者。", points)

# 步骤 3：润色为标题 + 正文
final = step("把下面的摘要改写成『标题 + 三点式正文』的格式。", summary)
print(final)
```

> 🔥 **链式提示是 Agent 工作流的雏形**：Dify/Coze 的"工作流"、LangChain 的 Chain，本质都是"多个 Prompt 串起来"。你现在手写的这三步，就是最小的工作流。

## 四、运用：结构化输出——让程序能直接吃

### 4.1 为什么要结构化

自由文本给人看没问题，但程序要处理就必须是**规整的结构**（JSON / 固定字段）。

### 4.2 三个层次的约束手段

| 手段 | 可靠性 | 说明 |
|---|---|---|
| 口头要求"请输出 JSON" | 低 | 模型可能加解释、加 markdown 代码块 |
| **给 JSON 模板 + 示例** | 中 | 在 Prompt 里写明字段和类型 |
| **API 的 JSON Mode / Function Calling** | 高 | 模型层面强制约束格式（pe-03 详细讲） |

```python
prompt = """
从下面这段公告中提取信息，严格按以下 JSON 输出，不要输出任何其他内容：
{
  "company": "公司名称",
  "event_type": "回购/减持/并购/其他",
  "amount": "金额（如 5亿元，没有就填 null）",
  "sentiment": "利好/利空/中性"
}

公告：某公司拟回购不超过 5 亿元股份用于员工持股计划
"""
```

期望输出：

```json
{"company": "某公司", "event_type": "回购", "amount": "5亿元", "sentiment": "利好"}
```

### 4.3 工程上的兜底

模型输出再"强制"，也会有翻车的时候。生产代码必须：

```python
import json

def safe_parse(text):
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # 兜底 1：去掉 markdown 代码块标记再试
        cleaned = text.strip().removeprefix("```json").removesuffix("```").strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # 兜底 2：重新问一次，或者记录日志人工处理
            return None
```

> 📌 规则：**永远不要假设大模型的输出一定合法**。解析失败要有兜底，关键业务要人工复核。

## 五、初识：提示词工程的四个常见坑

| 坑 | 现象 | 解法 |
|---|---|---|
| **指令冲突** | 前后要求矛盾，模型挑一个执行 | 一条 Prompt 只做一件事；复杂任务拆开 |
| **输出不稳定** | 同样输入，每次格式都不一样 | 给模板 + 示例 + 降低 temperature |
| **上下文过长** | 关键信息被"淹没"，模型忽略 | 把关键指令放开头和结尾；长文档先摘要 |
| **幻觉** | 一本正经地编造事实 | 要求"只根据给定材料回答，没有就说不知道"；关键信息用 RAG 提供出处 |

## 六、总结

### 6.1 要点回顾

1. **Self-Consistency**：同一问题多次采样 + 投票——提升可枚举答案的准确率，代价是 N 倍成本
2. **链式提示**：复杂任务拆成串行子任务，每步可检查、可替换模型、可加校验——**Agent 工作流的雏形**
3. **结构化输出**：口头要求 < 模板+示例 < JSON Mode/Function Calling；**解析必须兜底**
4. 四个常见坑：指令冲突、输出不稳、上下文过长、幻觉

### 6.2 自测清单

<details>
<summary>Q1：Self-Consistency 为什么能提升准确率？</summary>

多条推理路径的出错点往往不同，正确答案会被多数路径"投票"出来；相当于用采样做了集成。
</details>

<details>
<summary>Q2：链式提示相比一次性 Prompt 的优势？</summary>

每步可控可查、错误容易定位、可以混用不同模型降低成本、可以在步骤间加程序校验。
</details>

<details>
<summary>Q3：怎么让模型稳定输出 JSON？</summary>

给字段模板和示例、明确"只输出 JSON"、用 JSON Mode / Function Calling、解析端做容错兜底。
</details>

<details>
<summary>Q4：提示词为什么会"指令冲突"？怎么避免？</summary>

一条 Prompt 里塞了多个互相矛盾的要求（如"详细"又"不超过50字"）。拆成多个 Prompt 或用优先级明确的表述。
</details>

### 6.3 面试视角（🔥）

| 面试问法 | 答题要点 |
|---|---|
| 怎么提高大模型输出的稳定性/准确率？ | Few-shot、CoT、Self-Consistency、降低 temperature、结构化约束、结果校验 |
| Self-Consistency 的原理和代价？ | 多路径采样 + 投票；N 倍成本与延迟，适合可枚举答案 |
| Prompt Chaining 是什么？ | 任务拆解成串行 Prompt，逐步处理；是 Agent 工作流的基础 |
| 怎么保证结构化输出可靠？ | 模板+示例+JSON Mode/Function Calling+解析兜底 |
| 大模型幻觉怎么缓解？ | 只依据给定材料、要求引用出处、RAG 检索、结果校验 |

### 6.4 下一步

提示词技巧到头了。但模型还是"只会说话"。接下来是质变：**Function Calling——让模型学会用工具**。

---

*本文对应素材：`01-讲义/② 02-大模型提示词工程进阶`、`02-代码/day01/06-Self-Consistency的使用.py`、`day02/01-链式提示的使用.py`*
