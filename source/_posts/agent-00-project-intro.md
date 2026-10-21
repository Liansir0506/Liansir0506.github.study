---
title: 项目介绍：一个 MCP + A2A 架构的旅游 Agent
date: 2026-10-23 14:00:00
categories:
  - 项目篇
  - 智慧旅游 Agent
tags:
  - Agent
  - MCP
  - A2A
  - SmartVoyage
description: 一句话规划旅行的智能助手——用 MCP 接工具、用 A2A 连 Agent，这是 2025 年之后 Agent 工程的标准架构
mathjax: true
---

> **一句话概括**：SmartVoyage 是一个"能真正办事"的旅行助手——查天气、找酒店、订机票、做攻略，全靠多个专业 Agent 协作完成。
> **这篇有多重要**：📌 —— 项目总览。这个项目覆盖了当下最热的三份协议：Function Call、MCP、A2A。
> **前置知识**：pe-03 的 Function Calling、pe-04 的 ReAct
> **对应素材**：`tripagent/01_课件/SmartVoyage智慧旅游项目V8.2-beta/① 项目介绍`

## 一、初识：这个 Agent 要解决什么

用户说一句：

> "帮我规划下周末去成都的三天行程，看看天气，订个靠近宽窄巷子的酒店。"

一个普通聊天模型只能给你一段"建议"。而一个 **Agent** 要真的去：

```text
① 查成都未来三天天气（天气 API）
② 根据天气判断行程（下雨就把户外换成室内）
③ 找靠近宽窄巷子的酒店（地图 + 酒店搜索）
④ 查航班/高铁（票务 API）
⑤ 把结果整合成一份可执行的行程表
```

**这就是"会办事"和"会回答"的区别**——也是这个项目的核心。

## 二、初识：技术栈全景

| 层 | 技术 | 职责 |
|---|---|---|
| **模型层** | LLM（Function Call 能力） | 理解意图、决策、生成 |
| **协议层（工具）** | **MCP** | 把外部能力标准化成"工具" |
| **协议层（协作）** | **A2A** | 多个 Agent 之间通信协作 |
| **Agent 层** | ReAct / 规划 | 拆解任务、调度工具、整合结果 |
| **服务层** | FastAPI | 对外的对话入口 |
| **外部能力** | 和风天气 / 高德地图 / 博查搜索 / 飞常准 | 真实数据来源 |
| **交付** | Docker Compose | 一键部署 |

> 🔥 注意这套栈的关键词：**MCP 和 A2A 都是 2024-2025 年才出现的协议**——这个项目踩在了 Agent 工程的最前沿。

## 三、初识：架构——为什么是"多 Agent"

初学者会问：为什么不让**一个** Agent 干所有事？

```text
方案 A（单体 Agent）：
一个 Agent + 10 个工具（天气/地图/酒店/航班/攻略…）
→ 提示词臃肿、工具太多选择困难、调试地狱

方案 B（多 Agent，本项目）：
主 Agent（规划师）
  ├── 天气 Agent（只管天气）
  ├── 酒店 Agent（只管酒店）
  ├── 票务 Agent（只管航班高铁）
  └── 攻略 Agent（只管行程内容）
→ 每个 Agent 提示词精简、职责单一、可独立部署
```

这正是 coze-04 讲过的**主从模式**，只不过这里的"子 Agent"不是平台里的配置，而是**独立部署的服务**——它们之间用 **A2A 协议**通信。

```text
用户
 ↓
[对话入口 (FastAPI)]
 ↓
[主 Agent / Client Agent]  ← 负责规划与分发
 ↓ A2A 协议
 ├── WeatherAgentServer   （MCP 工具：天气）
 ├── HotelAgentServer     （MCP 工具：酒店/地图）
 ├── TicketAgentServer    （MCP 工具：航班）
 └── GuideAgentServer     （MCP 工具：搜索/攻略）
```

### 3.1 两种协议各管一段

| 协议 | 管什么 | 类比 |
|---|---|---|
| **MCP** | Agent ↔ **工具** | Type-C 充电口（统一接口） |
| **A2A** | Agent ↔ **Agent** | 同事之间的工作交接规范 |

> 🔥 记住这个分工：**MCP 向下连工具，A2A 横向连 Agent。** 面试问"A2A 和 MCP 有什么区别"，就答这一句。

## 四、初识：这个项目的学习路线

```text
概念铺垫（4 篇）
  Function Call → MCP → Agent → A2A
      ↓
架构与实现（4 篇）
  项目架构 → Service + MCP 服务 → A2A Server + 对话入口 → 部署
```

为什么先学这四个概念？

| 概念 | 解决什么 | 没它的话 |
|---|---|---|
| Function Call | 模型能调工具 | Agent 只能空谈 |
| **MCP** | 工具的标准化接入 | 每个工具都要手写 Schema + 胶水代码 |
| Agent | 规划、反思、多步执行 | 只能单轮问答 |
| **A2A** | 多 Agent 协作 | 所有能力塞一个 Agent，越做越乱 |

## 五、初识：为什么这个项目值得学

| 价值 | 说明 |
|---|---|
| **协议前沿** | MCP（Anthropic 2024）+ A2A（Google 2025）——市面上的项目大多还没用上 |
| **真实工具链** | 接的是真实 API（天气/地图/搜索/航班），不是 mock |
| **架构完整** | 从协议选型到部署交付，全链路 |
| **面试差异点** | 别人说"我会用 LangChain"，你说"我用 MCP 做工具标准化、A2A 做多 Agent 协作" |

## 六、总结

### 6.1 要点回顾

1. SmartVoyage = 能"办事"的旅行 Agent：查天气、订酒店、找航班、做攻略
2. 技术栈：**LLM + MCP（工具）+ A2A（Agent 协作）+ ReAct（规划）+ FastAPI + Docker**
3. 多 Agent 架构：主 Agent 规划分发，各专业 Agent 独立部署（主从模式的服务化版本）
4. 协议分工：**MCP 连工具（Type-C），A2A 连 Agent（同事规范）**
5. 学习路线：Function Call → MCP → Agent → A2A → 架构 → 实现 → 部署

### 6.2 自测清单

<details>
<summary>Q1：这个项目为什么用多 Agent 而不是一个 Agent？</summary>

工具太多会让提示词臃肿、决策困难、调试困难；按领域拆成独立 Agent 可各自精简、独立部署、通过 A2A 协作。
</details>

<details>
<summary>Q2：MCP 和 A2A 分别解决什么问题？</summary>

MCP 标准化"Agent 与工具"的接入（一次编写、处处调用）；A2A 标准化"Agent 与 Agent"的协作（能力发现、任务管理、状态同步）。
</details>

<details>
<summary>Q3：这个项目的技术亮点是什么？</summary>

用上了 MCP 与 A2A 两套新协议，接真实 API，完整覆盖"协议选型 → 服务实现 → 部署交付"。
</details>

### 6.3 面试视角（📌 项目开场）

| 面试问法 | 答题要点 |
|---|---|
| 介绍下这个 Agent 项目 | 场景（旅行规划）→ 架构（主 Agent + 专业 Agent）→ 协议（MCP/A2A）→ 我的职责 → 效果 |
| 为什么用多 Agent？ | 职责单一、提示词精简、可独立部署与扩展 |
| 技术选型的依据？ | 工具标准化用 MCP、Agent 协作标准化用 A2A，避免应用层硬编码 |
| 和 Coze/Dify 做的 Agent 区别？ | 平台版是可视化编排；这个项目是代码级、可私有化、协议标准化的工程实现 |

### 6.4 下一步

先补第一块地基：**Function Call——让模型能调用真实 API**。

---

*本文对应素材：`tripagent/01_课件/SmartVoyage智慧旅游项目V8.2-beta/① 项目介绍/01-项目介绍.html`*
