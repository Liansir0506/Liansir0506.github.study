---
title: ReAct：思考与行动的循环
date: 2026-10-21 18:00:00
categories:
  - 应用篇
  - 提示词工程
tags:
  - ReAct
  - Agent
  - Thought
  - Action
description: Thought→Action→Observation 循环怎么跑、代码怎么实现、为什么它是 Agent 的核心范式
mathjax: true
---

> **一句话概括**：让模型"边想边做"——先思考要干什么，再调用工具，看到结果接着思考，循环到问题解决。
> **这篇有多重要**：🔥🔥🔥 —— **Agent 面试必考**。ReAct 是 LangChain Agent、Coze 智能体、AutoGPT 的核心范式；理解了它，后面所有 Agent 框架都是它的变体。
> **前置知识**：pe-03 的 Function Calling（工具调用）
> **对应素材**：`02-代码/day02/05-ReAct初体验.py`、`06-ReAct完整版.py`、`ReAct完整版代码优化.py`

## 一、初识：一次性工具调用不够用

pe-03 的 Function Calling 解决的是"**一步**"的问题：模型说调什么工具，程序执行，完毕。

但真实任务往往是**多步**的：

> "对比北京和上海今天的天气，哪个更适合出门？"

这需要：查北京天气 → 查上海天气 → 对比 → 回答。**第一步的结果决定第二步要不要做**——一次调用搞不定。

**ReAct（Reasoning + Acting）** 就是解决多步问题的范式：

> **让模型交替地"推理"和"行动"，每一步都基于上一步的结果。**

## 二、初识：ReAct 的核心循环

ReAct 用三个关键字组织整个循环：

| 关键字 | 含义 | 例子 |
|---|---|---|
| **Thought** | 当前的思考：我现在知道什么、还差什么、下一步做什么 | "我需要先查北京天气" |
| **Action** | 要执行的动作（选哪个工具） | `get_weather` |
| **Action Input** | 传给工具的参数 | `{"city": "北京"}` |
| **Observation** | 工具返回的结果（由程序填入） | "晴，28℃" |

循环：

```text
Thought: 我要先查北京天气
Action: get_weather
Action Input: {"city": "北京"}
Observation: 晴，28℃            ← 程序填入
Thought: 再查上海
Action: get_weather
Action Input: {"city": "上海"}
Observation: 小雨，18℃          ← 程序填入
Thought: 都拿到了，可以对比了
Action: Final Answer
Action Input: 北京晴28℃、上海小雨18℃，北京更适合出门。
```

> 🔑 关键点：**Observation 是程序注入的**，不是模型编的。模型每一轮都能"看到"之前所有 Observation，所以能基于真实结果继续推理。

## 三、运用：代码实现（拆解完整版）

### 3.1 第一步：用 Prompt 约定格式

```python
def call_model(question, context):
    res = client.chat.completions.create(
        model="qwen-plus",
        messages=[{"role": "user", "content": f"""
你是一个基于 ReAct 范式的智能助手，请严格按以下格式回复：

Thought: <你的思考>
Action: <要执行的动作，从 {list(tools.keys())} 中选择；如果思考完成，返回 Final Answer>
Action Input: <调用工具时的参数；如果是最终答案，把答案放在这里>

【已获得的观察结果】
{context}

【问题】
{question}

【可用工具】
- get_month：获取当前月份，无参数，返回如"10月"
- get_year：获取当前年份，无参数，返回如"2026年"
"""}]
    )
    return res.choices[0].message.content
```

### 3.2 第二步：解析模型输出

模型会返回三行文本，程序解析出三个字段：

```python
def parse(reply):
    thought = action = action_input = ""
    for line in reply.split("\n"):
        if line.startswith("Thought:"):
            thought = line.replace("Thought:", "").strip()
        elif line.startswith("Action:"):
            action = line.replace("Action:", "").strip()
        elif line.startswith("Action Input:"):
            action_input = line.replace("Action Input:", "").strip()
    return thought, action, action_input
```

### 3.3 第三步：循环执行

```python
context = []          # 累积 Observation

for step in range(5):                     # 循环上限，防死循环
    reply = call_model(question, context)
    thought, action, action_input = parse(reply)
    print(f"[第{step+1}步] 思考:{thought} | 动作:{action} | 参数:{action_input}")

    if action == "Final Answer":
        print("最终答案：", action_input)
        break

    if action in tools:                    # 是工具 → 执行
        result = tools[action]()
        context.append(f"Observation: {result}")    # ✅ 必须用 Observation 前缀
    else:                                  # 动作名不对 → 提示模型
        context.append(f"Observation: 工具 {action} 不存在，可用工具：{list(tools.keys())}")
```

> ⚠️ 两个易错点：
> 1. 回填上下文时**必须加 `Observation:` 前缀**——模型靠这个前缀识别"这是工具结果"
> 2. 一定要设**循环上限**（3~5 步），否则模型可能"想不完"无限循环

## 四、初识：ReAct 为什么比一次性调用强

| 能力 | 一次性 Function Calling | ReAct |
|---|---|---|
| 单步工具调用 | ✅ | ✅ |
| 多步依赖（第二步依赖第一步结果） | ❌ | ✅ |
| 动态调整（结果不对就换个查法） | ❌ | ✅ |
| 可解释性 | 低 | ✅ 每步的 Thought 都写着"为什么" |

> 📌 面试答法："Function Calling 解决'调什么工具'，ReAct 解决'多步怎么串'——ReAct 是一个循环范式：Thought 推理 → Action 调工具 → Observation 观察 → 再 Thought，直到得出 Final Answer。"

### 4.1 ReAct 的工程细节（真实项目要考虑）

| 问题 | 处理 |
|---|---|
| **格式解析失败** | 兜底：把"格式错误，请严格按 Thought/Action/Action Input 输出"回填，重试一次 |
| **工具报错** | 把错误信息作为 Observation 回填（模型会自己纠错） |
| **无限循环** | 设置最大步数；同一工具重复调用要检测 |
| **上下文爆炸** | 历史 Observation 太长时做摘要压缩 |
| **幻觉工具名** | 解析时校验工具是否存在，不存在就提示可用工具列表 |

### 4.2 ReAct 的进化版：现代 Agent

ReAct 是 2022 年的论文范式，今天的主流 Agent（LangChain、AutoGPT、Coze）基本都是它的变体：

```text
ReAct（Thought → Action → Observation 循环）
  → 加记忆（Memory）：记住长期信息
  → 加规划（Planning）：先出计划再执行
  → 加多 Agent 协作：多个 Agent 分工
  → 原生 Function Calling 替代文本解析（更可靠）
```

> 后面写"智慧旅游 Agent"项目时，你会看到 ReAct 思想在真实系统里的样子：意图识别 → 任务规划 → 工具调用（MCP）→ 结果整合。

## 五、总结

### 5.1 要点回顾

1. ReAct = **Reasoning（推理）+ Acting（行动）**，解决**多步任务**
2. 核心循环：**Thought → Action → Action Input → Observation → 再 Thought → … → Final Answer**
3. Observation 由**程序注入**（工具真实结果），不是模型编的
4. 三个工程必备：**循环上限、格式校验、错误回填**
5. ReAct 是今天所有 Agent 框架的共同祖先

### 5.2 自测清单

<details>
<summary>Q1：ReAct 和 Function Calling 的关系？</summary>

Function Calling 是"单次工具调用"的能力；ReAct 是用"Thought→Action→Observation"循环把多次调用串起来解决复杂任务的范式。ReAct 内部可以用原生 Function Calling 实现 Action。
</details>

<details>
<summary>Q2：为什么 Observation 必须由程序填？</summary>

保证模型基于真实的工具结果推理，而不是编造结果。这也是 ReAct 能"自我纠错"的关键。
</details>

<details>
<summary>Q3：ReAct 为什么可能陷入死循环？怎么防？</summary>

模型可能反复调用同一工具或无法得出 Final Answer；靠最大步数限制、重复调用检测、超时中断来防护。
</details>

<details>
<summary>Q4：ReAct 的 Thought 有什么用？</summary>

显式记录推理过程：帮助模型保持任务上下文、可解释每一步的决策依据、便于调试定位错误。
</details>

### 5.3 面试视角（🔥🔥🔥）

| 面试问法 | 答题要点 |
|---|---|
| ReAct 是什么？ | Reasoning+Acting 范式：Thought→Action→Observation 循环，直到 Final Answer |
| ReAct 和 Function Calling 区别？ | 单步能力 vs 多步循环范式；ReAct 可用 FC 实现 Action |
| ReAct 的工程挑战？ | 格式解析、循环上限、错误回填、上下文膨胀、工具幻觉 |
| Agent 的核心组成？ | 规划（Planning）+ 记忆（Memory）+ 工具（Tools）+ 执行循环（ReAct） |
| 如何提升 Agent 稳定性？ | 结构化输出替代文本解析、工具描述优化、步数限制、结果校验、兜底策略 |

### 5.4 下一步

理论齐了，最后一篇看真实业务：**用 Prompt 做金融文本的分类、抽取、相似度判断**——三种最典型的企业级 Prompt 应用。

---

*本文对应素材：`02-代码/day02/05-ReAct初体验.py`、`06-ReAct完整版.py`、`ReAct完整版代码优化.py`*
