---
title: 外部 API 对接与 Docker 部署
date: 2026-10-23 18:30:00
categories:
  - 项目篇
  - 智慧旅游 Agent
tags:
  - Docker
  - 部署
description: 四个外部 API 的对接要点、鉴权与限流、Compose 编排全部服务——把整个多 Agent 系统跑起来
mathjax: true
---

> **一句话概括**：整个系统依赖五个外部数据源 + 六个本地进程——Docker Compose 把这一切编排成"一条命令启动"。
> **这篇有多重要**：📌 —— 收尾篇。面试问"你们怎么部署、外部依赖怎么管"，答案在这里。
> **前置知识**：eng-06 的 Docker、agent-05 的部署架构
> **对应素材**：`tripagent/01_课件/SmartVoyage智慧旅游项目V8.2-beta/④ 附录`（5 节）

## 一、初识：五个外部数据源

| 数据源 | 提供什么 | 鉴权方式 | 注意事项 |
|---|---|---|---|
| **和风天气** | 实时天气预报 | API Key（Header/Query） | 免费版有 QPS 限制，要缓存 |
| **高德地图** | 地理编码 / POI / 路径规划 | API Key + 签名 | 8 个工具共用一套 Key |
| **博查 AI** | 联网搜索 | API Key | 结果格式要清洗 |
| **飞常准** | 航班/票价（MCP 形式） | Aviation MCP 配置 | 走 MCP 协议而非 REST |
| **12306** | 火车票余票（py12306） | 无（直连） | **最不稳定**，要兜底 |

### 1.1 对接的四个通用要点

| 要点 | 做法 |
|---|---|
| **Key 统一管理** | 全部放 `config.py` / 环境变量，**不写死在代码里** |
| **超时与重试** | `timeout=5~10s` + 有限重试（指数退避），防止雪崩 |
| **限流感知** | 免费 API 有 QPS 上限，加客户端限流或缓存 |
| **失败降级** | agent-06 讲的优雅降级 + 样例兜底 |

> 🔥 面试可讲："外部依赖全部集中在 Service 层，鉴权在 config 统一管理，失败有降级和兜底——外部 API 挂掉不影响主流程。"

## 二、初识：本地服务全景（部署清单）

| 进程/容器 | 端口 | 角色 |
|---|---|---|
| `api_server.py`（FastAPI） | 8000 | Web 入口 |
| `mcp_external_server.py` | 8002 | 统一外部 MCP（16 工具） |
| `weather_server.py` | 8003 | 天气 A2A Agent |
| `ticket_server.py` | 8004 | 票务 A2A Agent |
| **商业业务 MCP（Docker）** | 8005 | 3 工具（业务团队提供） |
| `trip_server.py` | 8006 | 行程 A2A Agent |
| MySQL | 3306 | 记忆持久化 |

## 三、运用：Docker Compose 编排

```yaml
# compose.yaml
services:
  # 业务团队提供的商业 MCP（本项目只消费）
  business-mcp:
    image: registry.example.com/business-mcp:latest
    ports: ["8005:8005"]
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}    # 从 .env 读
      MYSQL_DATABASE: smartvoyage
    volumes: [mysql_data:/var/lib/mysql]
    ports: ["3306:3306"]
    restart: unless-stopped

volumes:
  mysql_data:
```

Python 服务（MCP + A2A Agent + API）跑在 conda 环境：

```bash
# 一条命令起容器（MySQL + 商业 MCP）
docker compose up -d

# 依次启动 Python 服务
conda activate smartvoyage
python mcp_external_server.py &    # 8002
python a2a_server/weather_server.py &   # 8003
python a2a_server/ticket_server.py &    # 8004
python a2a_server/trip_server.py &      # 8006
python api_server.py &                  # 8000
```

> 💡 真实项目里这些 Python 服务也可以容器化——但教学项目保留 conda 方式，方便打断点调试。面试时说明这个取舍即可。

### 3.1 启动顺序有讲究

```text
① MySQL → ② 商业业务 MCP → ③ 统一外部 MCP → ④ 三个 A2A Agent → ⑤ API 入口
```

原因：**下层没起，上层连不上**。MCP 起不来，Agent 加载工具会失败；Agent 起不来，对话服务路由会失败。

> 📌 生产环境用 `depends_on` + 健康检查自动管理；手工启动时按这个顺序，或写个启动脚本。

## 四、运用：联调排障（按这个顺序查）

```bash
# ① 端口都起着吗？
netstat -tlnp | grep -E "800[0-9]"

# ② MCP 工具能发现吗？（Agent 起不来的最常见原因）
curl http://localhost:8002/mcp

# ③ Agent Card 暴露了吗？
curl http://localhost:8003/.well-known/agent.json

# ④ 数据库连上了吗？
mysql -h 127.0.0.1 -u root -p smartvoyage -e "show tables;"

# ⑤ 外部 API 通吗？（看日志里的降级记录）
tail -f logs/smartvoyage.log | grep -E "fallback|timeout|error"
```

| 现象 | 优先查 |
|---|---|
| Agent 起不来 | MCP Server（8002）是否在跑 |
| 回复"天气不可用" | 和风 API Key / 限流（看降级日志） |
| 订票没结果 | 12306 是否走了样例兜底 |
| 记忆不生效 | MySQL 连接与表结构 |

## 五、初识：这个项目的可复用资产

做完这个项目，你沉淀了什么：

| 资产 | 说明 |
|---|---|
| **统一外部 MCP 模板** | 5 个数据源 + 16 工具的封装方式，换个项目直接复用 |
| **A2A Agent 骨架** | AgentCard + Task 状态 + LangChain Agent 的标准结构 |
| **记忆模块** | 五层记忆 + MySQL 持久化，可移植到任何对话系统 |
| **降级与兜底模式** | 外部依赖不可靠时的工程处理套路 |

## 六、总结

### 6.1 要点回顾

1. 五个外部数据源：和风天气 / 高德 / 博查 / 飞常准 / 12306——**Key 统一管理、超时重试、限流、降级**
2. 部署清单：7 个组件（API/MCP×2/Agent×3/MySQL），端口 8000–8006 + 3306
3. Docker Compose 管容器（MySQL + 商业 MCP），Python 服务 conda 启动（方便调试）
4. **启动顺序**：MySQL → 商业 MCP → 外部 MCP → A2A Agent → API
5. 排障五步：端口 → MCP 工具 → Agent Card → 数据库 → 外部 API 日志
6. 可复用资产：MCP 模板、A2A 骨架、记忆模块、降级模式

### 6.2 自测清单

<details>
<summary>Q1：外部 API Key 怎么管理？</summary>

集中在 config.py 或环境变量，代码里只读配置；CI/生产用 secret 注入，绝不硬编码或提交到仓库。
</details>

<details>
<summary>Q2：服务启动顺序是什么？为什么？</summary>

MySQL → 商业 MCP → 外部 MCP → A2A Agent → API。下层没起来，上层连接会失败；生产用 depends_on + 健康检查。
</details>

<details>
<summary>Q3：Agent 起不来最先查什么？</summary>

它连的 MCP Server（8002）是否在跑——load_mcp_tools 拿不到工具列表，Agent 初始化就会失败。
</details>

### 6.3 面试视角（📌）

| 面试问法 | 答题要点 |
|---|---|
| 项目怎么部署？ | Docker Compose 管容器、conda 跑 Python 服务；按依赖顺序启动 |
| 外部 API 怎么管？ | 统一 Service 封装 + config 管理 Key + 超时重试 + 降级兜底 |
| 服务挂了怎么发现？ | 健康检查、日志告警、降级监控（fallback 计数） |
| 多 Agent 联调怎么做？ | 先验证 MCP 工具可发现、再验证 Agent Card、最后端到端对话测试 |

### 6.4 模块完结：智慧旅游 Agent 9 篇全齐 🎉

| 篇目 | 一句话 |
|---|---|
| agent-00 项目介绍 | MCP 连工具、A2A 连 Agent |
| agent-01 Function Call | 手写 Schema 三痛点 |
| agent-02 MCP 🔥 | Type-C 类比 + 三种传输 |
| agent-03 Agent 🔥 | Agentic 连续谱 + 五种模式 |
| agent-04 A2A 🔥 | 四大能力 + MCP vs A2A |
| agent-05 架构 | 双 MCP + 七步构建 |
| agent-06 Service+MCP 🔥 | 薄壳/厚层分离 + 16 工具 |
| agent-07 A2A+对话 🔥 | 状态机 + 五层记忆 + Planning/ReAct |
| agent-08 API+Docker | 五数据源 + Compose + 排障 |

**这是全博客最后一个模块。** 从 MCP 到 A2A、从 Service 到记忆模块，一个完整的多 Agent 工程全链路——**技术栈踩在 2025–2026 的最前沿**。

---

*本文对应素材：`tripagent/01_课件/SmartVoyage智慧旅游项目V8.2-beta/④ 附录`（和风天气/高德/博查/飞常准 API 对接、Docker 部署）*
