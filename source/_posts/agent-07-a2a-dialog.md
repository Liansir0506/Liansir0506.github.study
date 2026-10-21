---
title: 实现 A2A Server 与对话入口
date: 2026-10-23 18:00:00
categories:
  - 项目篇
  - 智慧旅游 Agent
tags:
  - A2A实现
  - AgentCard
  - 对话服务
  - 记忆模块
description: 用 LangChain Agent 调 MCP 工具、用 python_a2a 做任务状态管理、用五层记忆实现"记得用户"——智能体的完整落地
mathjax: true
---

> **一句话概括**：A2A Agent = LangChain Agent（会思考）+ MCP Tools（会动手）+ Task 状态管理（可追踪）+ 记忆（记得用户）。
> **这篇有多重要**：🔥 —— 把前面所有协议"落地成代码"的一篇；面试问"Agent 怎么实现"，这套组合就是标准答案。
> **前置知识**：agent-04 的 A2A、agent-06 的 MCP 服务
> **对应素材**：`tripagent/01_课件/SmartVoyage智慧旅游项目V8.2-beta/③ 项目实现/05-实现A2AServer.html`、`06-实现核心入口与对话服务.html`

## 一、初识：天气 Agent 的完整链路

```text
用户："成都明天天气怎么样？"
   ↓ ① 主助手（chat_service）意图识别 → 天气任务
   ↓ ② A2A：发送 Task 给 WeatherAgent
   ↓ ③ WeatherAgent（LangChain Agent）
        ├── 分析输入：需要查"成都"的"明天"天气
        ├── 选择工具：query_weather（MCP 提供）
        ├── 获取结果：和风天气 API 返回
        └── 格式化回复：自然语言
   ↓ ④ A2A：Task 状态 SUBMITTED → WORKING → COMPLETED，返回 artifacts
   ↓ ⑤ 主助手整合，返回用户
```

这个"分析 → 选工具 → 执行 → 格式化"的循环，就是 **agent-03 讲的 Agent 执行循环**。

## 二、运用：A2A Server 的实现

用 `python_a2a` 库实现：

```python
from python_a2a import A2AServer, run_server, AgentCard, AgentSkill, TaskStatus, TaskState

class WeatherAgentServer(A2AServer):
    def __init__(self):
        super().__init__()
        # ① Agent Card：声明能力（其他 Agent 靠它发现我）
        self.agent_card = AgentCard(
            name="WeatherAgent",
            description="提供城市天气预报查询服务",
            skills=[
                AgentSkill(
                    id="query_weather",
                    name="查询天气",
                    description="查询指定城市未来 1~7 天天气",
                )
            ],
        )

    def handle_task(self, task):
        # ② Task 状态机
        task.status = TaskStatus(state=TaskState.WORKING)

        result = self.agent_run(task.message)      # 执行

        task.status = TaskStatus(state=TaskState.COMPLETED)
        task.artifacts = [{"text": result}]
        return task
```

| 组件 | 作用 |
|---|---|
| `A2AServer` | 基类，处理协议细节（收发消息、状态流转） |
| `AgentCard` | 能力名片——**别的 Agent 靠它知道"你能干什么"** |
| `TaskStatus / TaskState` | 状态机：`WORKING → COMPLETED / FAILED / INPUT_REQUIRED` |
| `artifacts` | 任务产物（天气结果） |

### 2.1 AgentCard 的验证（联调必做）

```bash
# 验证 Server 是否正常暴露能力
curl http://localhost:8003/.well-known/agent.json

# 检查四件事：名称、URL、技能数量、技能类型
```

> 📌 联调时第一步就是看 Agent Card——拿不到它，说明 Server 没起来或地址错了。

## 三、运用：Agent 的大脑——LangChain Agent + MCP Tools

```python
from langchain_openai import ChatOpenAI
from langchain_mcp_adapters.tools import load_mcp_tools
from langchain_mcp_adapters.sessions import StreamableHttpConnection
from langchain.agents import create_agent

llm = ChatOpenAI(model="qwen-plus")

# 连接 MCP Server，自动发现工具
connection = StreamableHttpConnection(url="http://localhost:8002/mcp")
tools = load_mcp_tools([connection])          # 16 个工具自动加载

# 创建 Agent（自动构建工具调用循环）
agent = create_agent(llm, tools)

result = agent.invoke({"input": "成都明天天气怎么样？"})
```

> 🔥 注意 `load_mcp_tools`——**工具是"自动发现"的，不是手写的**。这正是 agent-02 讲的 MCP 核心价值：MCP Server 自己描述能力，客户端拿来即用。

### 3.1 Agent 执行循环

```text
① 分析输入：需要成都的明天天气
② 选择工具：query_weather(city="成都", start_date="2026-04-30")
③ 获取结果：JSON 天气数据
④ 格式化回复：用自然语言组织给用户
   （如果工具报错 → Agent 自己判断重试/换参数/告知用户）
```

## 四、运用：记忆模块——五层结构

`memory.py` 是整个系统的"记忆中枢"，五类数据：

| 层 | 字段 | 内容 | 对应 agent-03 |
|---|---|---|---|
| **工作记忆** | `short_term_messages` | 最近 10 条对话 | 短期记忆 |
| **语义记忆** | `user_profile` | 用户偏好（"二等座""经济舱"） | 长期记忆 |
| **任务上下文** | `current_task` | 当前正在处理的子任务 | 工作记忆 |
| **情景记忆** | `entity_history` | 提取的关键实体（城市、日期，最多 20 条） | 长期记忆 |
| **长期记忆** | `long_term_memories` | 跨会话沉淀的偏好/事实（"常去北京"） | 长期记忆 |

```python
class ConversationMemory:
    def __init__(self, short_term_limit: int = 10):
        self.short_term_messages = []      # 工作记忆
        self.user_profile = {}             # 用户偏好
        self.current_task = {}             # 任务上下文
        self.entity_history = []           # 实体历史
        self.long_term_memories = {}       # 长期记忆
        self._db_conn = None               # 数据库连接（由 ChatService 注入）
```

> 🔥 三个工程细节值得讲：
> 1. **依赖注入**：`_db_conn` 由 ChatService 初始化时注入——记忆模块不依赖具体数据库配置，便于测试
> 2. **自动沉淀**：长期记忆不是手动录入的，系统从对话中自动抽取（"我每次都坐二等座" → `user_profile["seat_type"] = "二等座"`）
> 3. **MySQL 持久化**：所有记忆写库，服务重启后恢复

## 五、运用：对话入口（chat_service + 前后端）

### 5.1 chat_service 的核心流程

```text
用户输入
  ↓ ① 加载记忆（短期对话 + 长期偏好）
  ↓ ② 意图识别（LLM 分类 + 启发式规则兜底）
  ↓ ③ 任务拆分（"查天气+订票" → 两个子任务）
  ↓ ④ Planning：规划执行顺序（先天气 → 再订票，因为订票依赖天气结果）
  ↓ ⑤ ReAct 循环：逐个子任务路由给对应 A2A Agent
  ↓ ⑥ 结果整合：合并多个 Agent 的返回
  ↓ ⑦ 更新记忆（实体、偏好、对话历史）
  ↓ 回复用户
```

> 🔥 **Planning + ReAct 的组合**：先规划"分几步、什么顺序"，再逐步执行——这是高 Agentic 系统的典型做法（agent-03 讲的"规划模式"）。

### 5.2 启发式路由（兜底）

LLM 意图识别之外，还有规则兜底：

```python
# 明确的关键词直接走对应 Agent，省一次 LLM 调用
if "天气" in query or "下雨" in query:
    return RouteDecision(target="WeatherAgent", reason="关键词命中")
# 其余走 LLM 意图识别
```

### 5.3 前后端与鉴权

| 组件 | 职责 |
|---|---|
| `api_server.py` | FastAPI：REST 接口 + WebSocket 流式 |
| `static/index.html` | 前端页面（对话 UI + 卡片渲染） |
| 登录认证 | Token 机制，前端带 Token 访问 |
| 卡片推送 | 结构化数据约定（天气卡片/车次卡片/航班卡片） |

> 💡 **卡片推送的数据约定**是前后端协作的关键：后端返回 `{"type": "weather", "data": {...}}`，前端按类型渲染不同卡片——比纯文本体验好得多。

## 六、总结

### 6.1 要点回顾

1. A2A Agent = **LangChain Agent（决策）+ MCP Tools（能力）+ Task 状态机（可控）+ 记忆（上下文）**
2. 实现三件套：`A2AServer`（协议）+ `AgentCard`（能力声明）+ `TaskStatus/TaskState`（状态机）
3. **`load_mcp_tools` 自动发现工具**——MCP 价值的代码体现
4. 记忆五层：工作记忆 / 用户偏好 / 任务上下文 / 实体历史 / 长期记忆（MySQL 持久化）
5. 对话流程：**加载记忆 → 意图识别 → 任务拆分 → Planning → ReAct 执行 → 整合 → 更新记忆**
6. 工程细节：依赖注入便于测试、启发式规则省 LLM 调用、卡片推送结构化约定

### 6.2 自测清单

<details>
<summary>Q1：A2A Server 的四个核心组件？</summary>

A2AServer（协议基类）、AgentCard（能力名片）、TaskStatus/TaskState（状态机）、artifacts（任务产物）。
</details>

<details>
<summary>Q2：Agent 怎么获得 MCP 工具？</summary>

通过 StreamableHttpConnection 连 MCP Server，用 load_mcp_tools 自动发现并加载工具列表——不需要手写 Schema。
</details>

<details>
<summary>Q3：记忆模块为什么要依赖注入数据库连接？</summary>

让记忆模块不依赖具体数据库配置，便于单元测试（可注入 mock 连接），也符合"关注点分离"原则。
</details>

<details>
<summary>Q4：Planning + ReAct 在对话流程里怎么配合？</summary>

Planning 先拆解任务、排定顺序（先查天气再订票）；ReAct 循环逐个执行子任务，每步"思考→调用→观察"。
</details>

### 6.3 面试视角（🔥）

| 面试问法 | 答题要点 |
|---|---|
| Agent 怎么实现？ | LangChain Agent + MCP Tools；A2A Server 做状态管理；记忆模块做上下文 |
| 多步任务怎么编排？ | 意图识别 → 任务拆分 → Planning 排序 → ReAct 逐个执行 → 结果整合 |
| 记忆怎么设计？ | 五层（工作/偏好/任务/实体/长期）+ MySQL 持久化 + 依赖注入 |
| 怎么降本？ | 启发式路由兜底、缓存、只对需要的 Agent 发任务 |
| 前后端怎么协作？ | REST + WebSocket 流式；卡片结构化数据约定；Token 鉴权 |

### 6.4 下一步

最后一篇：**外部 API 对接与 Docker 部署**——把整个系统跑起来。

---

*本文对应素材：`tripagent/01_课件/SmartVoyage智慧旅游项目V8.2-beta/③ 项目实现/05-实现A2AServer.html`、`06-实现核心入口与对话服务.html`*
