---
title: MCP 协议：AI 世界的 Type-C
date: 2026-10-23 15:00:00
categories:
  - 项目篇
  - 智慧旅游 Agent
tags:
  - MCP
  - ModelContextProtocol
  - 工具标准化
  - stdio
description: 从"每家一根充电线"到"一个接口通吃"——MCP 如何统一模型与工具的连接，以及 Host/Client/Server 与三种传输方式
mathjax: true
---

> **一句话概括**：MCP 是"模型 ↔ 工具"之间的统一接口——工具自己介绍自己，任何支持 MCP 的模型都能直接调用。
> **这篇有多重要**：🔥🔥🔥 —— **2024 年之后 Agent 工程最重要的协议**。面试问"了解 MCP 吗"，能讲清原理和传输方式就是硬通货。
> **前置知识**：agent-01 的 Function Call 三痛点
> **对应素材**：`tripagent/01_课件/SmartVoyage智慧旅游项目V8.2-beta/② 项目技术/02-MCP协议.html`、`MCP传输方式动画演示.html`

## 一、初识：Type-C 的故事

家里一堆设备要充电：手机、耳机、平板、笔记本。**以前**每家厂商有自己的口——Micro-USB、Lightning、Mini-USB……出门要带一堆线，借个充电宝还得看接口对不对。

**Type-C 出现后**：一个口通吃。

大模型调用工具，正走在这同一条路上：

| 阶段 | 表现 |
|---|---|
| **没有 MCP（手工 Function Call）** | 每个应用开发者手写每个工具的 Schema + 胶水代码 |
| **有了 MCP** | 工具自己"自我介绍"，应用连上就能用 |

## 二、初识：MCP 前后对比（一张表说清价值）

假设团队要做一个旅行助手，接天气、火车票、酒店三个工具：

| 对比维度 | 没有 MCP | 有了 MCP |
|---|---|---|
| **工具描述谁写** | 应用开发者手写（经常不准） | **工具开发者自己写**（最准确） |
| **接入一个新工具** | 读文档 → 写 Schema → 写胶水 → 测试，半天到一天 | 配置 Server 地址 → **自动发现工具，几分钟** |
| **工具升级** | 应用侧也要同步改 | Server 侧更新即可，客户端自动获取 |
| **跨 LLM 复用** | 每个平台 Schema 不同，要分别适配 | **统一协议，一次编写到处能用** |
| **生态共享** | 各团队重复造轮子 | 社区有现成 Server，拿来即用 |

> 🔥 一句话：**MCP 之前，每个开发者都在"手工接线"；MCP 之后，工具"插上就能用"。**

### 2.1 一个生活的比喻

| 角色 | 类比 |
|---|---|
| **LLM** | 餐厅里的顾客——知道自己想吃什么，但不会做菜 |
| **MCP** | 服务员——把顾客的需求准确传达给后厨，把菜端回来 |
| **MCP Server** | 后厨——真正会做菜的人（工具的实现者） |

顾客不需要知道厨房用什么锅，只要会"点菜"（标准协议）就行。

## 三、初识：MCP 的三方架构

```text
┌─────────────── Host（宿主机应用，如 Claude Desktop / 你的 Agent 程序）───────────────┐
│                                                                                    │
│   ┌──────────────┐        ┌──────────────┐        ┌──────────────┐                │
│   │ MCP Client 1 │        │ MCP Client 2 │        │ MCP Client 3 │                │
│   └──────┬───────┘        └──────┬───────┘        └──────┬───────┘                │
└──────────┼───────────────────────┼───────────────────────┼────────────────────────┘
           │                       │                       │
    ┌──────▼──────┐         ┌──────▼──────┐         ┌──────▼──────┐
    │ MCP Server  │         │ MCP Server  │         │ MCP Server  │
    │  （天气）    │         │  （数据库）  │         │  （文件系统） │
    └─────────────┘         └─────────────┘         └─────────────┘
```

| 角色 | 职责 |
|---|---|
| **Host** | 宿主应用（你的 AI 应用/IDE/桌面客户端），管理多个连接 |
| **Client** | 与单个 Server 的 1:1 连接（协议实现） |
| **Server** | 提供工具/资源/提示词的服务端（工具的真正拥有者） |

> 📌 一个 Host 可以连多个 Server，每个 Server 只负责自己的领域能力——**能力按领域拆分，天然符合 Agent 的分工原则**。

### 3.1 MCP Server 能提供什么

MCP 不只是"工具"，它定义了三种能力：

| 能力 | 说明 | 例子 |
|---|---|---|
| **Tools（工具）** | 模型可调用的函数 | 查天气、查数据库 |
| **Resources（资源）** | 可读取的数据 | 文件内容、数据库表 |
| **Prompts（提示词模板）** | 预置的提示词 | 代码审查模板 |

> 这个项目主要用 **Tools**——把天气/地图/搜索/航班封装成工具。

## 四、初识：三种传输方式（面试常问）

MCP 支持多种"传输层"，决定 Client 和 Server 怎么通信：

| 传输方式 | 场景 | 原理 | 特点 |
|---|---|---|---|
| **stdio** | 本地进程 | 标准输入/输出管道 | 最简单、零网络开销；Server 作为子进程启动 |
| **SSE** | 远程服务 | HTTP + Server-Sent Events | 服务端单向推送；早期远程方案 |
| **Streamable HTTP** | 远程服务（新版） | HTTP 流式请求/响应 | 更通用、支持无状态与会话，**当前推荐** |

### 4.1 stdio 长什么样

```json
{
  "mcpServers": {
    "weather": {
      "command": "python",
      "args": ["weather_server.py"],
      "env": { "WEATHER_API_KEY": "xxx" }
    }
  }
}
```

Host 启动时把 `weather_server.py` 作为**子进程**拉起，通过 stdin/stdout 收发 JSON-RPC 消息。

> 🔥 这是本地开发最常见的方式——**写完 Server 脚本，配置一下就能接进任何支持 MCP 的应用**。

### 4.2 远程方式（SSE / Streamable HTTP）

Server 部署在服务器上，Host 通过 URL 连接：

```json
{
  "mcpServers": {
    "weather": { "url": "https://api.example.com/mcp/weather" }
  }
}
```

适合：多个应用共享同一套工具服务、Server 需要独立扩缩容。

> 💡 素材里有个 `MCP传输方式动画演示.html`——用动画把 stdio/SSE/HTTP 的报文往来讲得很直观，强烈建议看一眼。

## 五、初识：MCP 在真实业务里的价值

| 场景 | 没有 MCP 的痛点 | 有了 MCP |
|---|---|---|
| **企业内部知识库** | 每个 AI 应用单独写一套 RAG 接入 | 知识库团队发一个 MCP Server，**所有应用统一接入**，权限/缓存由其管理 |
| **数据库查询** | 在提示词里拼 SQL，不安全 | DBA 发布 Server，**只暴露安全查询工具**，参数化防注入 |
| **第三方 SaaS** | 每接一个（Slack/Jira/GitHub）写一套集成 | 社区已有 Server，**配置 URL 即用** |
| **多模型切换** | 从 GPT 换到通义，工具层重写 | 工具定义与模型无关，**换模型不影响工具层** |

> 📌 最后一条特别值钱：**MCP 让"工具层"和"模型层"解耦**——这正是企业最需要的（不被单一模型厂商锁定）。

## 六、总结

### 6.1 要点回顾

1. MCP 解决 Function Call 的三大痛点：**描述质量、重复集成、跨平台不通用**
2. 三方架构：**Host（宿主）→ Client（连接）→ Server（能力提供者）**
3. Server 提供三种能力：**Tools / Resources / Prompts**
4. 三种传输：**stdio（本地子进程）/ SSE（早期远程）/ Streamable HTTP（当前推荐）**
5. 核心价值：**工具层与模型层解耦**——一次编写，所有支持 MCP 的模型都能用

### 6.2 自测清单

<details>
<summary>Q1：MCP 解决了什么问题？</summary>

统一"模型 ↔ 工具"的接入标准：工具作者自己描述能力，客户端自动发现，跨模型/跨平台复用，避免重复集成。
</details>

<details>
<summary>Q2：MCP 的三种角色？</summary>

Host（宿主应用）、Client（与 Server 的 1:1 连接）、Server（提供 Tools/Resources/Prompts 的服务）。
</details>

<details>
<summary>Q3：stdio 和 HTTP 传输分别适合什么场景？</summary>

stdio 适合本地进程（Server 作为子进程，零网络开销）；SSE/Streamable HTTP 适合远程共享服务。
</details>

<details>
<summary>Q4：MCP 为什么对企业有价值？</summary>

工具标准化后，知识库/数据库/SaaS 都能一次封装多处复用；权限与安全由 Server 统一管控；且不被单一模型厂商锁定。
</details>

### 6.3 面试视角（🔥🔥🔥）

| 面试问法 | 答题要点 |
|---|---|
| MCP 是什么？解决什么问题？ | 模型与工具的标准协议；解决 Schema 手写、重复集成、跨平台不通用的痛点 |
| MCP 的架构？ | Host + Client + Server 三方；Server 提供 Tools/Resources/Prompts |
| 传输方式有哪些？ | stdio（本地）、SSE（远程旧）、Streamable HTTP（远程新，推荐） |
| MCP 和 Function Call 的关系？ | Function Call 是模型能力；MCP 是工具的标准化供给方式，最终仍通过 Function Call 调用 |
| 实际怎么用？ | 配置 Server（命令或 URL）→ 客户端自动发现工具 → 模型按需调用 |

### 6.4 下一步

工具有了标准接口。接下来是"谁来用这些工具"——**Agent 智能体**。

---

*本文对应素材：`tripagent/01_课件/SmartVoyage智慧旅游项目V8.2-beta/② 项目技术/02-MCP协议.html`、`MCP传输方式动画演示.html`*
