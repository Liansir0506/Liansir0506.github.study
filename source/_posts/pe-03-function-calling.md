---
title: Function Calling：让模型学会用工具
date: 2026-10-21 17:30:00
categories:
  - 应用篇
  - 提示词工程
tags:
  - Function Calling
  - 工具调用
  - Agent
  - JSON
description: 模型只会生成文本、不会查天气——Function Calling 就是给它装上"手"：手搓版原理 + 真实 API 用法
mathjax: true
---

> **一句话概括**：让模型输出"我要调用哪个工具、参数是什么"，由你的程序去执行，再把结果喂回去——模型从"只会说"变成"能做事"。
> **这篇有多重要**：🔥🔥🔥 —— **Agent 的第一块砖**。没有工具调用，就没有 Agent、没有 RAG 里的检索工具、没有订机票订酒店。面试必问"Function Calling 是什么、怎么实现"。
> **前置知识**：pe-00 的 API 调用、pe-02 的结构化输出
> **对应素材**：`02-代码/day02/03-让模型具备调用工具的能力(function-calling的雏形).py`、`04-模型调用工具代码优化.py`、`niubidegongju.py`

## 一、初识：大模型的天生缺陷

问大模型："今天北京天气怎么样？"

它只能根据训练数据"猜"——**它没法真的去查天气**。

| 模型能做的 | 模型做不到的 |
|---|---|
| 理解问题、推理、生成文本 | 实时查天气/股价、订机票、查数据库、发邮件 |

原因很简单：**大模型是个"纯文本函数"**——输入文本，输出文本，没有和外部世界交互的能力。

**Function Calling（函数调用 / 工具调用）** 就是给它接上"手"：

```text
用户："北京今天天气怎么样？"
  ↓
模型：我需要调用 get_weather 工具，参数 {"city": "北京"}
  ↓
你的程序：执行 get_weather("北京") → "晴，28℃"
  ↓
模型：根据工具结果组织回答 → "北京今天晴，28℃，适合出门。"
```

> 关键认知：**模型从来不直接执行任何工具**。它只负责"决定调什么、参数是什么"，真正的执行永远在你的代码里。**控制权在程序手里，不在模型手里**——这是 Agent 安全性的基础。

## 二、初识：手搓一个 Function Calling（理解原理）

在真实 API 之前，先用 Prompt 手搓一遍——**搞懂原理，API 就只是省事了**。

### 2.1 第一步：把工具清单写进 Prompt

```python
tools_desc = """
你可以使用以下工具，需要时按格式输出调用指令：
- get_weather(city: str)：查询指定城市的天气，返回温度和天气状况
- get_time()：获取当前时间，无参数
"""
```

### 2.2 第二步：约定输出格式

```python
prompt = f"""
{tools_desc}

当需要调用工具时，只输出如下 JSON（不要输出其他内容）：
{{"tool": "工具名", "args": {{"参数名": "参数值"}}}}

如果不需要工具，直接回答问题。

用户问题：{question}
"""
```

模型的输出会是：

```json
{"tool": "get_weather", "args": {"city": "北京"}}
```

### 2.3 第三步：程序解析 + 执行 + 回填

```python
import json

def run_with_tools(question):
    # 1. 第一次问模型：它决定调哪个工具
    reply = call_model(prompt.format(question=question))

    try:
        call = json.loads(reply)
    except json.JSONDecodeError:
        return reply      # 没调工具，直接回答

    # 2. 程序执行工具（不是模型执行！）
    tool_name, args = call["tool"], call.get("args", {})
    result = TOOLS[tool_name](**args)

    # 3. 把工具结果喂回模型，让它组织最终回答
    final = call_model(f"""
工具 {tool_name} 返回的结果：{result}
请根据这个结果回答用户的问题：{question}
""")
    return final
```

### 2.4 手搓版的问题

| 问题 | 说明 |
|---|---|
| 解析脆弱 | 模型可能输出多余文字、格式跑偏 |
| 可靠性低 | 全靠 Prompt 约束，模型一"自由发挥"就崩 |
| 不标准化 | 每个项目都要自己写一套解析逻辑 |

→ 这就是为什么官方要推出原生 **tools 参数**。

## 三、运用：真实的 Function Calling API

OpenAI 兼容接口提供了 `tools` 参数，把"工具定义"变成结构化数据交给模型：

```python
tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "查询指定城市的实时天气",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "城市名，如：北京"}
            },
            "required": ["city"]
        }
    }
}]

res = client.chat.completions.create(
    model="qwen-plus",
    messages=[{"role": "user", "content": "北京今天天气怎么样？"}],
    tools=tools,                    # 传入工具定义
    tool_choice="auto"              # 让模型自己决定要不要调
)

msg = res.choices[0].message
if msg.tool_calls:                  # 模型决定调用工具
    call = msg.tool_calls[0]
    print(call.function.name)       # "get_weather"
    print(call.function.arguments)  # '{"city": "北京"}'
```

拿到调用信息后，流程和手搓版一样：**执行 → 把结果作为 tool 消息回填 → 再请求模型**：

```python
messages.append(msg)                                  # 模型那条"我要调工具"的消息
messages.append({
    "role": "tool",
    "tool_call_id": call.id,
    "content": json.dumps({"temp": 28, "weather": "晴"}, ensure_ascii=False)
})

final = client.chat.completions.create(model="qwen-plus", messages=messages)
print(final.choices[0].message.content)   # "北京今天晴，28℃…"
```

### 3.1 手搓版 vs 原生 API

| | 手搓版 | 原生 tools |
|---|---|---|
| 工具描述 | 写在 Prompt 字符串里 | 结构化 JSON Schema |
| 输出解析 | 自己解析文本 | 模型返回结构化 `tool_calls` |
| 可靠性 | 低（易格式错乱） | 高（模型专门训练过） |
| 多工具并发 | 麻烦 | 支持一次返回多个调用 |

> 📌 面试答法："手搓版是用 Prompt 约定 JSON 输出再解析；原生 Function Calling 用 tools 参数传 JSON Schema，模型返回结构化的 tool_calls，更可靠、支持多工具。"

## 四、初识：工具描述怎么写才准

Function Calling 的效果，**一半取决于工具描述的质量**：

| 原则 | 差的做法 | 好的做法 |
|---|---|---|
| **描述用途具体** | "查询数据" | "查询指定城市未来 7 天的天气预报" |
| **参数说明清楚** | `city: string` | `city: 城市中文名，如"北京""上海"` |
| **边界明确** | 不做说明 | "仅支持中国城市；不支持则返回错误" |
| **工具之间不重叠** | `get_weather` 和 `query_weather` 两个都查天气 | 合并或明确分工 |

> 💡 经验：**模型选错工具，90% 是描述写得含糊**。把工具描述当成"写给新人的接口文档"来写。

## 五、总结

### 5.1 要点回顾

1. 大模型只会生成文本 → Function Calling 让它"决定调什么工具"，**执行永远在程序侧**
2. 四步流程：**工具定义 → 模型输出调用 → 程序执行 → 结果回填再生成**
3. 手搓版：Prompt 描述工具 + 约定 JSON 输出 + 解析执行（理解原理用）
4. 原生 API：`tools` 参数 + JSON Schema + `tool_calls` 返回（生产用）
5. 工具描述质量决定调用准确率：**描述具体、参数清楚、边界明确、工具不重叠**

### 5.2 自测清单

<details>
<summary>Q1：Function Calling 是模型在执行函数吗？</summary>

不是。模型只输出"要调用哪个函数、参数是什么"，真正的执行由应用程序完成——控制权在程序侧，这也是安全性的关键。
</details>

<details>
<summary>Q2：手搓版和原生 API 的区别？</summary>

手搓靠 Prompt 约定输出格式、自己解析文本，易出错；原生用 tools 参数传 JSON Schema，模型返回结构化 tool_calls，可靠且支持并行调用。
</details>

<details>
<summary>Q3：模型选错工具怎么优化？</summary>

优化工具描述（用途具体、参数示例、边界清晰）、减少工具间语义重叠、必要时在 system prompt 里给出选择规则。
</details>

<details>
<summary>Q4：工具执行报错了怎么办？</summary>

把错误信息作为 tool 结果回填给模型（如"错误：城市不存在"），让模型决定重试、换工具还是告知用户——这就是 Agent 的容错能力。
</details>

### 5.3 面试视角（🔥🔥🔥）

| 面试问法 | 答题要点 |
|---|---|
| Function Calling 是什么？原理？ | 模型根据工具定义输出结构化调用请求，程序执行后把结果回填，模型继续生成；执行始终在程序侧 |
| 手搓实现和原生 API 的区别？ | Prompt 约定 vs JSON Schema 结构化；解析可靠性差异 |
| 工具描述怎么设计？ | 用途具体、参数带示例、边界明确、避免工具重叠 |
| 多工具怎么编排？ | 模型返回多个 tool_calls 可并行执行；或用 ReAct 多轮决策 |
| Function Calling 的风险？ | 参数幻觉、越权调用、注入攻击——需要程序侧校验与权限控制 |

### 5.4 下一步

一次工具调用只能解决"一步"的问题。真正的 Agent 需要**边想边做、根据结果决定下一步**——这就是 ReAct 范式。

---

*本文对应素材：`02-代码/day02/03-让模型具备调用工具的能力(function-calling的雏形).py`、`04-模型调用工具代码优化.py`、`niubidegongju.py`*
