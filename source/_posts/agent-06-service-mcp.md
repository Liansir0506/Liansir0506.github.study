---
title: 实现 Service 层与 MCP 服务
date: 2026-10-23 17:30:00
categories:
  - 项目篇
  - 智慧旅游 Agent
tags:
  - MCP
description: 薄壳注册 + 厚实 Service 的两层分离、16 个工具怎么组织、外部 API 挂了怎么兜底
mathjax: true
---

> **一句话概括**：MCP Server 只做"注册和路由"（薄壳），脏活累活都在 Service 层——两层分离，改工具不用动 Server。
> **这篇有多重要**：🔥 —— 工程规范的体现；面试问"MCP Server 怎么组织代码"，这个分层就是好答案。
> **前置知识**：agent-02 的 MCP 协议
> **对应素材**：`tripagent/01_课件/SmartVoyage智慧旅游项目V8.2-beta/③ 项目实现/03-实现Service层.html`、`04-实现MCP服务.html`

## 一、初识：两层分离架构

MCP Server 内部代码分两层：

| 层级 | 文件 | 职责 | 代码量 |
|---|---|---|---|
| **MCP 注册层** | `mcp_external_server.py` | 创建 FastMCP 实例、用 `@tool` 注册 16 个工具、**委托给 Service** | **薄（~150 行）** |
| **Service 实现层** | `services/` 5 个模块 | 真正的业务逻辑：API 调用、数据格式化 | **厚（~700 行）** |

### 1.1 为什么这么拆（一次真实重构）

早期版本：所有工具实现都写在 `mcp_external_server.py` 一个文件里 → **超过 800 行**：

- 改一个工具要打开整个 MCP 文件
- 可读性、可维护性都很差
- 不同数据源的代码混在一起

重构后：

```python
# mcp_external_server.py：只做注册 + 委托（薄壳）
from SmartVoyage.services.weather_service import fetch_weather_from_api
from SmartVoyage.services.local_life_service import LocalLifeService

local_life_service = LocalLifeService()

@external_mcp.tool(name="query_weather", description="查询指定城市未来几天的天气")
def query_weather(city: str, start_date: str, end_date: str = None) -> str:
    return fetch_weather_from_api(city, start_date, end_date)   # 直接委托

@external_mcp.tool(name="geocode", description="地理编码：地址转坐标")
def geocode(address: str, city: str = None) -> str:
    return local_life_service.geocode(address, city)
```

> 🔥 **面试可讲**："Server 文件是薄壳（注册+路由），业务实现都在 services/ 里——这样加工具只改一处，测试也可以单独测 Service。"

## 二、初识：五个 Service 模块

| 模块 | 核心类/函数 | 数据源 |
|---|---|---|
| `weather_service.py` | `fetch_weather_from_api()` | 和风天气 API（实时） |
| `local_life_service.py` | `LocalLifeService` 类 + `_amap_request` | 高德地图 REST API |
| `train_service.py` | `_query_train_from_12306()` | py12306（12306 真实接口） |
| `flight_service.py` | `VariFlightClient` 类 | 飞常准 Aviation MCP |
| `bocha_service.py` | `_call_bocha_api()` + `_format_search_results()` | 博查 AI Web Search |

> 📌 每个 Service 的职责边界清晰：**一个数据源一个模块**。换天气供应商？只改 `weather_service.py`。

## 三、初识：16 个工具的组织

统一外部 MCP 一共 16 个工具：

| 类别 | 数量 | 工具 |
|---|---|---|
| **天气** | 1 | `query_weather`（参数化查询） |
| **本地生活**（高德） | 8 | `geocode`、`regeocode`、`search_poi`、周边搜索、4 种路径规划 |
| **火车票** | 1 | 12306 余票查询 |
| **旅游攻略** | 1 | 博查联网搜索 |
| **航班** | 5 | 直飞航班、票价、行程推荐、舒适度、中转方案 |

> 💡 **按"数据源"而不是按"业务"分组**——同一个 API 的工具放一起，复用连接、统一鉴权、统一错误处理。

## 四、运用：MCP 服务的启动

```python
from mcp.server.fastmcp import FastMCP

# 1. 创建实例
external_mcp = FastMCP("SmartVoyageExternal")

# 2. 注册工具（薄壳）
@external_mcp.tool(name="query_weather", description="...")
def query_weather(city: str, start_date: str, end_date: str = None) -> str:
    ...

# 3. 启动（stdio 模式本地启动 / HTTP 模式远程启动）
if __name__ == "__main__":
    external_mcp.run(transport="streamable-http")   # 远程：Streamable HTTP
    # external_mcp.run()                            # 本地：stdio
```

### 4.1 两种运行方式对应 agent-02 的传输方式

| 场景 | 传输 | 启动 |
|---|---|---|
| 本机调试 | stdio | `python mcp_external_server.py`（子进程） |
| 部署服务（本项目） | **Streamable HTTP** | 起在 8002 端口，A2A Agent 通过 URL 连接 |

> 本项目 A2A Agent 这样连 MCP：
> ```python
> from langchain_mcp_adapters.sessions import StreamableHttpConnection
> conn = StreamableHttpConnection(url="http://localhost:8002/mcp")
> tools = load_mcp_tools([conn])     # 自动发现 16 个工具
> ```

## 五、初识：两个必须做的工程实践

### 5.1 优雅降级

外部 API 会挂（限流、超时、维护）。**不能让整个 Agent 崩**：

```python
def fetch_weather_from_api(city: str, start_date: str):
    try:
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        return format_weather(resp.json())
    except requests.Timeout:
        logger.warning(f"天气 API 超时: {city}")
        return json.dumps({"error": "天气服务暂时不可用", "fallback": True})
    except Exception as e:
        logger.error(f"天气 API 异常: {e}")
        return json.dumps({"error": "天气查询失败", "detail": str(e)})
```

> 🔥 关键：**把错误当成"结果"返回给模型**，而不是抛异常——模型会知道"天气查不到"，然后告诉用户"暂时查不了"，而不是整个链路崩溃。

### 5.2 样例数据兜底

12306、飞常准这类接口**经常不稳定**（反爬、限流）。教学项目里常备"样例数据"：

```python
def _query_train_from_12306(origin, destination, date):
    try:
        return real_api_call(origin, destination, date)
    except Exception:
        logger.warning("12306 查询失败，使用样例数据兜底")
        return SAMPLE_TRAIN_DATA      # 预置的演示数据
```

> ⚠️ 但注意：**样例数据必须明确标注是"演示数据"**，别让用户以为是真的余票。

## 六、总结

### 6.1 要点回顾

1. **两层分离**：MCP 注册层（薄壳，~150 行）+ Service 实现层（厚，~700 行）
2. 五个 Service 模块按**数据源**划分，一个 API 一个模块
3. 16 个工具按数据源组织：天气 1 / 本地生活 8 / 火车票 1 / 攻略 1 / 航班 5
4. 启动两种模式：**stdio（本地）/ Streamable HTTP（部署）**
5. 两个工程实践：**优雅降级（错误当结果返回）+ 样例数据兜底（明确标注）**

### 6.2 自测清单

<details>
<summary>Q1：为什么 MCP Server 要做成"薄壳"？</summary>

注册层只负责工具定义与路由，业务实现在 Service 层——职责清晰、文件不臃肿、便于单独测试与替换数据源。
</details>

<details>
<summary>Q2：外部 API 挂了怎么办？</summary>

优雅降级：捕获异常、返回结构化错误（让模型知道失败了），必要时用样例数据兜底并明确标注"演示数据"。
</details>

<details>
<summary>Q3：A2A Agent 怎么连上 MCP Server？</summary>

通过 StreamableHttpConnection 指定 URL，用 load_mcp_tools 自动发现工具列表。
</details>

### 6.3 面试视角（🔥）

| 面试问法 | 答题要点 |
|---|---|
| MCP Server 代码怎么组织？ | 薄壳注册层 + Service 实现层；按数据源分模块 |
| 工具怎么定义？ | @tool 装饰器 + name/description/参数 schema；description 写清用途 |
| 外部服务不稳定怎么处理？ | 超时设置、异常捕获、优雅降级、样例兜底、日志告警 |
| stdio 和 HTTP 怎么选？ | 本地开发用 stdio；部署用 Streamable HTTP，Agent 通过 URL 连接 |

### 6.4 下一步

工具层完成。往上走：**A2A Server 与对话入口**——Agent 怎么调工具、怎么记上下文。

---

*本文对应素材：`tripagent/01_课件/SmartVoyage智慧旅游项目V8.2-beta/③ 项目实现/03-实现Service层.html`、`04-实现MCP服务.html`*
