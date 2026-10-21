---
title: Function Call：让模型调用真实 API
date: 2026-10-23 14:30:00
categories:
  - 项目篇
  - 智慧旅游 Agent
tags:
  - FunctionCall
  - JSONSchema
  - 工具调用
description: 从工具定义到调用回填，再看手写 Schema 的三个痛点——这就是 MCP 要解决的事
mathjax: true
---

> **一句话概括**：Function Call 是 Agent 的"手"——把外部能力写成 JSON Schema 交给模型，模型决定何时调用、传什么参数。
> **这篇有多重要**：🔥 —— Agent 的第一块地基；也是理解 MCP 为什么出现的起点。
> **前置知识**：pe-03 的 Function Calling 原理
> **对应素材**：`tripagent/01_课件/SmartVoyage智慧旅游项目V8.2-beta/② 项目技术/01-Function Call函数调用.html`

## 一、初识：从"只能聊"到"能动手"

回忆 pe-03 的结论：大模型只会生成文本，要让它"查天气"，必须三步：

```text
① 定义工具（JSON Schema）
② 模型决定调用（返回 tool_calls）
③ 程序执行 + 结果回填
```

这个项目里，所有外部能力（天气/地图/搜索/航班）都是用这套机制接入的。

## 二、运用：一个工具的三要素

```python
tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "查询指定城市未来几天的天气，返回每日天气状况与温度",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "城市中文名，如：成都"},
                "days": {"type": "integer", "description": "查询天数，1~7，默认 3"},
            },
            "required": ["city"],
        },
    },
}]
```

| 要素 | 作用 | 常见错误 |
|---|---|---|
| **name** | 函数名 | 用中文、含空格、重名 |
| **description** | **最关键的**——模型靠它判断"该不该调" | 写得太模糊（"查询数据"） |
| **parameters** | 参数结构（JSON Schema） | 缺 description、类型写错、必填项没标 |

> 🔥 **工具调用失败 90% 是 description 的问题**：模型不知道这个工具能干什么，自然就不会用、或者乱用。

## 三、运用：完整调用循环

```python
import json
import openai

client = openai.OpenAI(base_url="https://dashscope.aliyuncs.com/compatible-mode/v1")

def run_with_tools(question: str):
    messages = [{"role": "user", "content": question}]

    while True:
        res = client.chat.completions.create(
            model="qwen-plus",
            messages=messages,
            tools=tools,
            tool_choice="auto",
        )
        msg = res.choices[0].message

        # 没有工具调用 → 直接返回答案
        if not msg.tool_calls:
            return msg.content

        # 有调用 → 执行并把结果回填
        messages.append(msg)
        for call in msg.tool_calls:
            name = call.function.name
            args = json.loads(call.function.arguments)
            result = TOOLS[name](**args)          # 程序执行！
            messages.append({
                "role": "tool",
                "tool_call_id": call.id,
                "content": json.dumps(result, ensure_ascii=False),
            })
        # 循环：带着工具结果再问模型
```

> 📌 注意 `while True`——真实任务常需要**多轮工具调用**（查天气 → 根据结果查航班）。这就是 ReAct 循环的最小实现（pe-04）。

## 四、初识：手写 Schema 的三个痛点（MCP 的由来）

前面这套流程能跑，但在**真实项目**里会立刻遇到问题：

### 4.1 痛点一：工具描述质量参差不齐

同一个天气 API，不同开发者写的描述：

```text
开发者 A：查询天气
开发者 B：获取气象信息
开发者 C：根据城市名返回未来 N 天天气预报，包含温度、降水、风力
```

参数命名也不统一：`city` / `location` / `city_name`——**模型调用稳定性完全看运气**。

### 4.2 痛点二：重复劳动严重

你写了个天气工具，隔壁团队也想用——他们**得重写一遍 Schema、重新调试参数格式**、重新接认证。

一个公司里同一个 API 被不同团队集成 5 遍——**这是巨大的浪费**。

### 4.3 痛点三：换模型/换平台要重写

工具定义格式在不同平台略有差异（OpenAI / 通义 / Claude），从 A 切到 B，工具层要重新适配。

## 五、初识：核心矛盾一句话

> **工具的描述，应该由最懂工具的人（工具开发者）来写，而不是由调用者（应用开发者）去猜。**

如果工具能"自我介绍"——清晰地说明自己有什么能力、需要什么参数——就能实现"**一次编写，到处调用**"。

这正是 **MCP（Model Context Protocol）** 要解决的问题——下一篇的主角。

## 六、总结

### 6.1 要点回顾

1. Function Call 三要素：**name / description / parameters**
2. **description 决定模型会不会用、用得对不对**——写具体用途、参数示例、边界
3. 调用循环：模型返回 `tool_calls` → 程序执行 → `role: tool` 回填 → 再问模型（可多轮）
4. 手写 Schema 三痛点：**描述质量参差、重复劳动、跨平台重写**
5. 核心矛盾：**工具描述应由工具作者提供，而非调用者猜**——这就是 MCP 的动机

### 6.2 自测清单

<details>
<summary>Q1：Function Call 中哪个字段最关键？</summary>

description。模型靠它判断"这个工具能做什么、什么时候该用"，写得模糊会导致不调用或误调用。
</details>

<details>
<summary>Q2：工具执行结果怎么回填？</summary>

以 `role: "tool"` 的消息、带上 `tool_call_id` 与结果（通常 JSON 字符串）追加到 messages，再请求模型。
</details>

<details>
<summary>Q3：手写 Schema 的三个痛点？</summary>

描述质量不统一、同一个 API 被重复集成、换模型/平台需重新适配。
</details>

### 6.3 面试视角（🔥）

| 面试问法 | 答题要点 |
|---|---|
| Function Call 的流程？ | 定义工具 → 模型返回 tool_calls → 程序执行 → 结果回填 → 模型生成 |
| 工具描述怎么设计？ | 用途具体、参数带示例与类型、边界清晰、避免工具间重叠 |
| 模型选错工具怎么办？ | 优化描述、减少重叠、在 system prompt 给选择规则、必要时减少工具数量 |
| 为什么后来需要 MCP？ | 手写 Schema 不可复用、质量参差、跨平台不通用 |

### 6.4 下一步

解开痛点：**MCP 协议——AI 世界的 Type-C**。

---

*本文对应素材：`tripagent/01_课件/SmartVoyage智慧旅游项目V8.2-beta/② 项目技术/01-Function Call函数调用.html`*
