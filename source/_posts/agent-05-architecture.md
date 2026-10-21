---
title: 项目架构与数据准备
date: 2026-10-23 17:00:00
categories:
  - 项目篇
  - 智慧旅游 Agent
tags:
  - 项目架构
  - 多Agent
  - 部署
description: 从业务架构到代码架构——3 个 A2A Agent、2 个 MCP 服务、一个记忆中枢，以及从零构建的七步流程
mathjax: true
---

> **一句话概括**：SmartVoyage 的架构可以概括成一句话：**一个对话中枢 + 三个专业 Agent + 两个 MCP 服务**。
> **这篇有多重要**：📌 —— 面试问"你们系统怎么分层的"，照着这张架构图讲就行。
> **前置知识**：agent-00 的项目介绍、agent-04 的 A2A
> **对应素材**：`tripagent/01_课件/SmartVoyage智慧旅游项目V8.2-beta/③ 项目实现/01-项目架构和项目流程介绍.html`、`02-数据准备.html`

## 一、初识：业务架构全景

```text
用户（命令行 main.py / Web api_server.py + index.html）
   ↓ 自然语言："五一去成都，帮我查天气和火车票"
[chat_service.py] ← 核心协调器（意图识别 + 任务拆分 + 路由）
   ↓ A2A 协议
   ├── WeatherAgent（weather_server.py）  天气查询
   ├── TicketAgent（ticket_server.py）   火车票 + 航班
   └── TripAgent（trip_server.py）       租车/保险/跟团/攻略/本地生活
              ↓ MCP 协议
   [统一外部 MCP :8002]  ← 16 个工具（天气/高德/12306/博查/飞常准）
   [商业业务 MCP :8005]  ← 3 个工具（租车/保险/旅游团，其他团队 Docker 部署）
              ↓
   [memory.py] 记忆中枢（短期对话/偏好/实体/长期记忆 → MySQL）
```

| 组件 | 文件 | 职责 |
|---|---|---|
| **对话协调器** | `chat_service.py` | 意图识别、任务拆分、子任务路由、结果整合 |
| **天气 Agent** | `a2a_server/weather_server.py` | 连统一外部 MCP，查实时天气 |
| **票务 Agent** | `a2a_server/ticket_server.py` | 12306 火车票（py12306）+ 航班（飞常准） |
| **行程 Agent** | `a2a_server/trip_server.py` | 租车/保险/跟团（商业 MCP）+ 攻略（博查）+ 本地生活（高德） |
| **统一外部 MCP** | `mcp_external_server.py`（:8002） | 16 个工具，第三方 API 的集中封装 |
| **商业业务 MCP** | 外部服务（:8005） | 3 个工具，MySQL + ES，**其他团队负责** |
| **记忆中枢** | `memory.py` | 五类记忆数据，MySQL 持久化 |

> 🔥 注意 TripAgent 连了**两个** MCP（统一外部 + 商业业务）——这就是"双 MCP 架构"，也是 A2A/MCP 组合灵活性的体现。

## 二、初识：为什么拆成两个 MCP 服务

这是个真实的工程决策，面试可以直接用：

| 原因 | 说明 |
|---|---|
| **职责分离** | 天气/票务/本地生活 与 租车/保险/旅游团 分属不同业务线、不同团队 |
| **数据源差异** | 外部 MCP 以 REST API 为主；商业 MCP 以结构化数据为主（MySQL + ES） |
| **部署独立** | 商业 MCP 由业务团队用 Docker 独立部署，本项目**只消费不管理** |
| **扩展灵活** | 新增工具只改对应 MCP，互不影响 |

### 2.1 还有一次"重构"值得讲

早期版本：4 个独立 MCP 服务器（端口 8001~8004）——启动要跑 4 个进程，联调复杂。

重构后：合并成**1 个统一外部 MCP**（8002）——A2A Agent 只需连一个地址。

> 📌 面试可讲："早期按业务拆了 4 个 MCP，但部署和联调成本太高；重构为统一外部 MCP + 独立商业 MCP 两层，兼顾简洁与职责分离。"

## 三、初识：代码架构（分层）

```text
SmartVoyage/
├── config.py                    # 统一配置（路径/端口/API Key）
├── create_logger.py             # 日志
├── chat_service.py              # 对话协调器（核心编排）
├── memory.py                    # 记忆中枢
├── main.py                      # 命令行客户端
├── api_server.py                # FastAPI 服务（Web 入口）
├── static/index.html            # 前端页面
├── mcp_external_server.py       # 统一外部 MCP（薄壳：注册 + 委托）
├── services/                    # Service 实现层（5 个模块）
│   ├── weather_service.py       # 和风天气
│   ├── local_life_service.py    # 高德地图
│   ├── train_service.py         # 12306
│   ├── flight_service.py        # 飞常准
│   └── bocha_service.py         # 博查搜索
└── a2a_server/                  # 三个 A2A Agent
    ├── weather_server.py
    ├── ticket_server.py
    └── trip_server.py
```

## 四、运用：从零构建的七步流程

```text
① 配置基础环境（config.py + create_logger.py）
② 初始化数据库（SQL 脚本，MySQL）
③ 配置天气查询服务（weather_service.py 直连和风天气）
④ 完成统一外部 MCP（16 个工具）
⑤ 完成 A2A 代理（weather / ticket / trip）
⑥ 完成记忆模块（memory.py）与对话协调（chat_service.py）
⑦ 完成客户端（main.py 命令行 + api_server.py Web）
```

> 💡 **这个顺序就是"自底向上"的标准姿势**：先有数据与服务，再有工具协议，再有 Agent，最后是入口。面试讲"你怎么搭这个系统"，照这个顺序说。

## 五、初识：部署架构（教学环境）

```text
conda 环境（Python 进程）
├── mcp_external_server.py     :8002
├── weather_server.py (A2A)    :8003
├── ticket_server.py (A2A)     :8004
├── trip_server.py (A2A)       :8006
├── api_server.py (FastAPI)    :8000
└── memory.py → MySQL

Docker 容器
└── 商业业务 MCP                :8005（业务团队提供）

互联网
├── 和风天气 API
├── 高德地图 API
├── 博查 AI Search API
├── 飞常准 Aviation MCP
└── 12306（py12306 直连）
```

## 六、总结

### 6.1 要点回顾

1. 架构一句话：**对话协调器 + 3 个 A2A Agent + 2 个 MCP + 记忆中枢**
2. 双 MCP：**统一外部（16 工具，REST API）** + **商业业务（3 工具，MySQL/ES，其他团队）**
3. TripAgent 连两个 MCP——A2A/MCP 组合的灵活性
4. 代码分层：**Service（实现）→ MCP 注册（薄壳）→ A2A Agent（执行）→ chat_service（编排）→ 入口（CLI/Web）**
5. 构建顺序：环境 → 数据库 → Service → MCP → A2A → 记忆/对话 → 客户端
6. 部署：Python 进程 + Docker 容器 + 多个外部 API

### 6.2 自测清单

<details>
<summary>Q1：SmartVoyage 的核心组件？</summary>

chat_service（对话协调）、3 个 A2A Agent（天气/票务/行程）、2 个 MCP 服务（统一外部 + 商业业务）、memory 记忆中枢。
</details>

<details>
<summary>Q2：为什么要两个 MCP 服务？</summary>

职责分离（不同业务线/团队）、数据源差异（REST vs MySQL/ES）、部署独立（业务团队自己 Docker 部署）、扩展灵活。
</details>

<details>
<summary>Q3：项目从零构建的顺序？</summary>

环境配置 → 数据库初始化 → Service 层 → 统一外部 MCP → A2A Agent → 记忆与对话协调 → 客户端（CLI + Web）。
</details>

### 6.3 面试视角（📌）

| 面试问法 | 答题要点 |
|---|---|
| 系统架构怎么分？ | 入口层（CLI/Web）→ 编排层（chat_service）→ Agent 层（A2A ×3）→ 工具层（MCP ×2）→ 数据层 |
| 多 Agent 怎么分工？ | 天气/票务/行程按领域拆分，主助手意图识别后路由；行程 Agent 连双 MCP |
| MCP 服务怎么拆？ | 外部 API 集中一个统一 MCP；内部业务另一个，独立部署、独立维护 |
| 记忆怎么设计？ | memory.py 分层：短期对话/用户偏好/任务上下文/实体历史/长期记忆，MySQL 持久化 |

### 6.4 下一步

架构清楚了，看最实在的部分：**Service 层与 MCP 服务**怎么落地。

---

*本文对应素材：`tripagent/01_课件/SmartVoyage智慧旅游项目V8.2-beta/③ 项目实现/01-项目架构和项目流程介绍.html`、`02-数据准备.html`*
