---
title: A2A 协议：Agent 之间怎么协作
date: 2026-10-23 16:00:00
categories:
  - 项目篇
  - 智慧旅游 Agent
tags:
  - A2A
  - AgentCard
  - 多Agent
description: MCP 连工具，A2A 连 Agent——Google 2025 年发布的协作协议，解决能力发现、任务管理、UX 协商与安全协作
mathjax: true
---

> **一句话概括**：A2A（Agent to Agent）让不同 Agent 像"同事"一样协作——知道谁能干什么、怎么派活、怎么追问、怎么保证安全。
> **这篇有多重要**：🔥🔥🔥 —— 2025 年 4 月 Google 刚发布的前沿协议。能讲清它，说明你真的在跟进行业最前沿。
> **前置知识**：agent-02 的 MCP、agent-03 的 Agent 与 Agentic
> **对应素材**：`tripagent/01_课件/SmartVoyage智慧旅游项目V8.2-beta/② 项目技术/04-A2A协议.html`

## 一、初识：从三节演进说起

到这里我们已经掌握了三件技术：

| 技术 | 解决了什么 | **还没解决什么** |
|---|---|---|
| **Function Call** | 模型能调外部工具 | 工具描述手写、不标准 |
| **MCP** | 统一了工具的暴露与调用 | 仍是一个 Agent 调多个工具（**单体 Agent**） |
| **Agent 智能体** | 具备规划、反思、多工具协作 | **多个 Agent 之间如何通信与协作？** |

核心矛盾：

> 系统越做越大，一个 Agent 扛不住所有职责——就像一个人不可能同时是天气专家、票务专家、酒店专家、攻略专家。

所以我们需要多个各有专长的 Agent。但问题来了：

| 问题 | 术语 |
|---|---|
| Agent A 怎么知道 Agent B 能做什么？ | **能力发现** |
| 怎么给 B 派任务、拿结果？ | **任务管理** |
| B 发现信息不足，怎么向用户追问？ | **UX 协商** |
| 整个通信过程怎么保证安全？ | **安全协作** |

**A2A 协议就是这四个问题的标准答案。**

> 📌 时间线：**2025 年 4 月 9 日，Google 正式发布 Agent2Agent Protocol（A2A）**——让独立 Agent 之间、Agent 与企业系统之间都能标准化协作。

## 二、初识：旅行场景贯穿全程

```text
用户："帮我查北京天气，然后订票"
   ↓
主 Agent（Client Agent / 旅行规划师）
   ├── ① 我自己不会查天气 → 找 WeatherAgentServer
   │        （A2A：能力发现 → 派 Task → 拿结果）
   ├── ② 天气拿到了 → 找 TicketAgentServer 订票
   └── ③ 整合结果返回用户
```

**没有 A2A 时**：只能在代码里硬编码——先调天气 API、再调票务 API。加一个酒店 Agent？改代码、改调用链。

**有了 A2A**：按协议找到合适的 Agent → 发 Task → 拿结果。**新增 Agent 不影响已有代码**。

> 🔥 这就是标准化的力量：**每个 Agent 独立开发、独立部署、通过协议协作**。

## 三、初识：A2A 四大核心能力

| 能力 | 说明 | 例子 |
|---|---|---|
| **① 安全协作** | 身份验证、数据加密、访问控制 | 订票涉及个人信息，只有授权 Agent 能访问 |
| **② 任务与状态管理** | 管理 Task 的完整生命周期 | SUBMITTED → WORKING → COMPLETED / FAILED |
| **③ UX 协商** | 信息不足时向用户追问，而不是直接失败 | "缺出发地，请补充" |
| **④ 能力发现** | Agent 通过 **Agent Card** 声明自己会什么 | 见下方 |

### 3.1 Agent Card：Agent 的"名片"

每个 A2A Server 都会公开一份 **Agent Card**（通常放在 `/.well-known/agent.json`）：

```json
{
  "name": "WeatherAgent",
  "description": "提供城市天气预报查询服务",
  "url": "https://weather-agent.example.com",
  "version": "1.0",
  "capabilities": { "streaming": true },
  "skills": [
    {
      "id": "get_forecast",
      "name": "查询天气预报",
      "description": "查询指定城市未来 1~7 天天气",
      "inputModes": ["text"],
      "outputModes": ["text", "json"]
    }
  ]
}
```

> 🔥 **Agent Card 相当于 MCP 里"工具描述"的 Agent 版本**——但粒度更大：它描述的是"这个 Agent 能干什么"，而不只是"这个函数收什么参数"。

### 3.2 Task：一次协作的载体

```text
① Client Agent 发送 Task（含消息与参数）
   ↓
② Server 返回 Task 状态：SUBMITTED
   ↓
③ Server 执行中：WORKING（可流式推送进度）
   ↓
④ 完成：COMPLETED，返回 artifacts（结果产物）
   （或 FAILED / CANCELED）
```

| 概念 | 含义 |
|---|---|
| **Task** | 一次协作任务 |
| **Message** | 任务中的往来消息（文本/文件/结构化数据） |
| **Artifact** | 任务的产出物（行程表、订单号、PDF） |
| **State** | 状态机：submitted / working / input-required / completed / failed / canceled |

> 💡 注意 **input-required** 这个状态——这就是"UX 协商"的落地：Server 信息不足时不是报错，而是把 Task 挂起、请求补充信息。

## 四、初识：MCP vs A2A（最关键的一张对比表）

| 维度 | **MCP** | **A2A** |
|---|---|---|
| 连接什么 | **Agent ↔ 工具** | **Agent ↔ Agent** |
| 抽象粒度 | 函数级（Tools/Resources/Prompts） | 任务级（Task/Artifact） |
| 类比 | **Type-C 充电口** | **同事之间的工作交接规范** |
| 谁定义 | Anthropic（2024） | Google（2025.4） |
| 典型场景 | 接天气 API、数据库、文件系统 | 旅行规划师 → 票务 Agent → 酒店 Agent |
| 是否都在本项目 | ✅ Service 层封装成 MCP Server | ✅ 主 Agent 与专业 Agent 之间 |

> 🔥 面试高频："**MCP 和 A2A 什么关系？**"
> 答："**MCP 向下连工具，A2A 横向连 Agent。** 它们是互补的——每个 Agent 内部用 MCP 接工具，Agent 之间用 A2A 协作。"

### 4.1 一张图看清两者的位置

```text
                    ┌───────────────┐
                    │  主 Agent      │
                    │ (Client Agent)│
                    └───┬───────┬───┘
              A2A 协议   │       │   A2A 协议
              ┌─────────▼─┐   ┌─▼──────────┐
              │ Weather   │   │  Ticket     │
              │ Agent     │   │  Agent      │
              └─────┬─────┘   └─────┬───────┘
              MCP   │               │  MCP
              ┌─────▼─────┐   ┌─────▼───────┐
              │ 和风天气   │   │  飞常准 API  │
              │ MCP Server│   │  MCP Server │
              └───────────┘   └─────────────┘
```

## 五、初识：A2A 带来的工程价值

| 价值 | 说明 |
|---|---|
| **可扩展** | 新增一个（酒店/攻略）Agent 不影响现有链路 |
| **可独立部署** | 每个 Agent 独立扩容、独立发布 |
| **跨团队/跨组织** | Agent Card 让"外部 Agent"也能被发现和调用 |
| **故障隔离** | 票务 Agent 挂了，天气服务照常可用（优雅降级） |
| **技术栈自由** | 每个 Agent 可以用不同语言/框架实现 |

> 📌 这五点是面试里"为什么用 A2A 而不是硬编码调用"的标准答案。

## 六、总结

### 6.1 要点回顾

1. 演进线：**Function Call → MCP → Agent → A2A**（工具 → 工具标准化 → 单体智能 → 多 Agent 协作）
2. A2A 解决四件事：**能力发现、任务管理、UX 协商、安全协作**
3. 核心概念：**Agent Card（能力名片）、Task（任务）、Artifact（产物）、状态机**
4. **MCP 连工具，A2A 连 Agent**——互补而非竞争
5. 工程价值：可扩展、独立部署、跨组织、故障隔离、技术栈自由

### 6.2 自测清单

<details>
<summary>Q1：A2A 解决什么问题？</summary>

多个 Agent 之间的标准化协作：如何发现彼此能力（Agent Card）、如何派发任务与跟踪状态（Task）、信息不足时如何追问（input-required）、如何保证安全。
</details>

<details>
<summary>Q2：Agent Card 是什么？</summary>

Agent 的"能力声明书"（通常位于 /.well-known/agent.json），描述名称、描述、地址、技能列表与支持的输入输出模式，供其他 Agent 发现能力。
</details>

<details>
<summary>Q3：MCP 和 A2A 的区别？</summary>

MCP 是 Agent 与工具之间的协议（函数级，Type-C 类比）；A2A 是 Agent 与 Agent 之间的协议（任务级，同事协作类比）。两者互补。
</details>

<details>
<summary>Q4：Task 的状态有哪些？</summary>

submitted / working / input-required / completed / failed / canceled——其中 input-required 对应 UX 协商。
</details>

### 6.3 面试视角（🔥🔥🔥）

| 面试问法 | 答题要点 |
|---|---|
| A2A 协议是什么？ | Google 2025 发布的 Agent 间协作标准；解决能力发现/任务管理/UX 协商/安全协作 |
| MCP 和 A2A 的区别？ | 连工具 vs 连 Agent；函数级 vs 任务级；互补 |
| 多 Agent 怎么发现彼此？ | Agent Card（.well-known/agent.json）声明技能 |
| 为什么不用简单的 HTTP 调用？ | 状态管理、追问协商、安全与标准化发现——硬编码无法通用 |
| A2A 的难点？ | 任务状态一致性、跨 Agent 错误处理、超时与取消、安全与权限 |

### 6.4 批次小结：概念篇完成

```text
Function Call（能调工具）
   → MCP（工具标准化：Type-C）
   → Agent（单体智能：规划+记忆+工具）
   → A2A（多 Agent 协作：同事规范）
```

**这四篇是理解现代 Agent 工程的骨架**——剩下的四篇讲这个项目怎么把它们拼出来。

---

*本文对应素材：`tripagent/01_课件/SmartVoyage智慧旅游项目V8.2-beta/② 项目技术/04-A2A协议.html`*
