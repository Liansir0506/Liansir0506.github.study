---
title: FastAPI：把模型能力做成 API
date: 2026-10-22 10:30:00
categories:
  - 工程篇
  - AI 工程化
tags:
  - FastAPI
  - WebAPI
  - Pydantic
  - 异步
description: 从 URL/方法/状态码讲到路由、Pydantic 校验、自动文档和异步——把大模型包装成别人能调用的服务
mathjax: true
---

> **一句话概括**：模型跑在你的脚本里只有你能用；包成 API，前端、小程序、其他服务才能调用——FastAPI 就是最快的那条路。
> **这篇有多重要**：🔥🔥 —— AI 应用后端的标配框架；面试问"你的模型服务怎么对外提供"，答案就是它。
> **前置知识**：Python 基础、eng-02 的 VibeCoding（代码可以让 AI 写，但你要会看）
> **对应素材**：`vibecoding/01课件/docs/03-fastapi.md`

## 一、初识：Web API 是什么

### 1.1 一句话理解

**API = 别人通过"网址 + 参数"来调用你的程序，你返回结果（通常是 JSON）。**

```text
客户端（网页/小程序/其他服务）
   ↓ HTTP 请求：POST /chat  {"message": "你好"}
你的服务（FastAPI）
   ↓ 调用大模型
   ↑ HTTP 响应：200  {"reply": "你好！有什么可以帮你？"}
```

### 1.2 必须认识的四个概念

| 概念 | 含义 | 例子 |
|---|---|---|
| **URL / 路径** | 资源地址 | `/chat`、`/users/1` |
| **请求方法** | 要做什么 | `GET` 查、`POST` 增、`PUT` 改、`DELETE` 删 |
| **状态码** | 结果状态 | `200` 成功、`400` 参数错、`401` 未认证、`500` 服务器错 |
| **请求/响应体** | 数据载体 | JSON：`{"message": "你好"}` |

> 📌 面试可能问：**GET 和 POST 的区别**——GET 取数据、参数在 URL 上、可缓存；POST 提交数据、参数在请求体、不缓存。

## 二、运用：FastAPI 初体验（10 行跑起来）

### 2.1 安装与最小服务

```bash
pip install fastapi uvicorn
```

```python
# main.py
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/chat")
def chat(payload: dict):
    message = payload.get("message", "")
    return {"reply": f"你说的是：{message}"}
```

```bash
uvicorn main:app --reload
# 浏览器打开 http://127.0.0.1:8000/health  → {"status":"ok"}
```

三个关键点：

- `@app.get("/health")`：**路由装饰器**，把 URL 绑定到函数
- 函数的返回值会自动转成 JSON
- `--reload`：改代码自动重启（开发时用，生产别用）

### 2.2 自动文档（FastAPI 的招牌）

打开 **http://127.0.0.1:8000/docs** —— Swagger 文档页：

- 列出所有接口
- 可以直接在页面上**填参数、点 Try it out 测试**
- 自动生成请求/响应格式

> 🔥 这是 FastAPI 相比 Flask 最大的优势之一：**接口文档自动生成、可直接调试**。前端同学不用再问你"这个接口怎么传参"。

## 三、运用：Pydantic 校验——别信前端传来的数据

用 `dict` 接参数有个问题：前端少传字段、传错类型，你的代码就崩。

**Pydantic 模型**来兜底：

```python
from pydantic import BaseModel

class ChatRequest(BaseModel):
    message: str
    temperature: float = 0.7        # 有默认值，可不传
    max_tokens: int = 512

@app.post("/chat")
def chat(req: ChatRequest):
    # req.message 一定是 str，req.temperature 一定是 float
    return {"reply": f"收到：{req.message}", "temp": req.temperature}
```

传错类型会怎样？

```json
请求：{"message": 123, "temperature": "hot"}
响应：422 Unprocessable Entity
{
  "detail": [{"loc": ["body","temperature"], "msg": "value is not a valid float"}]
}
```

> 📌 **422 是 FastAPI 的"参数校验失败"状态码**——自动挡，不用写一行 if 判断。这在生产里非常省事。

## 四、初识：异步——为什么 AI 服务必须 async

普通函数（`def`）处理请求时**独占线程**：调一次大模型要 5 秒，这 5 秒里该线程干不了别的。

FastAPI 支持 `async def` + `await`：

```python
import asyncio

@app.post("/chat")
async def chat(req: ChatRequest):
    # 等待大模型返回时，事件循环可以去处理其他请求
    reply = await call_llm_async(req.message)
    return {"reply": reply}
```

| 场景 | 推荐 |
|---|---|
| 调用大模型 API（IO 等待） | `async def` + `await`（异步 HTTP 客户端） |
| 纯 CPU 计算（如图像处理） | 普通 `def`（FastAPI 会丢到线程池） |

> 🔥 AI 应用几乎都是 **IO 密集型**（等模型、等数据库、等向量库）——异步能让单机扛住几十上百并发，这是"能不能上生产"的分水岭。

## 五、运用：把大模型包成接口（完整示例）

```python
from fastapi import FastAPI
from pydantic import BaseModel
import openai

app = FastAPI()
client = openai.AsyncOpenAI(base_url="https://dashscope.aliyuncs.com/compatible-mode/v1")

class AskRequest(BaseModel):
    question: str
    history: list[dict] = []      # 可选：多轮对话历史

@app.post("/ask")
async def ask(req: AskRequest):
    messages = req.history + [{"role": "user", "content": req.question}]
    res = await client.chat.completions.create(
        model="qwen-plus",
        messages=messages,
        temperature=0.7,
    )
    return {
        "answer": res.choices[0].message.content,
        "usage": res.usage.total_tokens,
    }
```

启动后：

```bash
curl -X POST http://127.0.0.1:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "什么是 RAG？"}'
```

> 这就是一个最小可用的"大模型服务"——前端、小程序、其他系统都能通过它调用模型能力。

## 六、总结

### 6.1 要点回顾

1. Web API = 通过 URL + 参数调用程序，返回 JSON；四个概念：路径、方法、状态码、请求/响应体
2. FastAPI 三步：`FastAPI()` → `@app.get/post` 装饰器 → `uvicorn` 启动
3. **`/docs` 自动生成 Swagger 文档**，可直接测试
4. **Pydantic 模型**做参数校验，传错自动返回 422，不用手写 if
5. AI 服务必须用 **`async def` + `await`**（IO 密集型，异步才能扛并发）

### 6.2 自测清单

<details>
<summary>Q1：GET 和 POST 的区别？</summary>

GET 获取数据，参数在 URL、可缓存、幂等；POST 提交数据，参数在请求体、不缓存，通常用于创建/提交操作。
</details>

<details>
<summary>Q2：FastAPI 的 /docs 是什么？</summary>

自动生成的 Swagger UI 接口文档，列出接口、参数、响应格式，还能直接在线调试。
</details>

<details>
<summary>Q3：为什么 AI 接口要用 async？</summary>

调用模型是 IO 等待，同步写法会阻塞线程；async/await 让事件循环在等待期间处理其他请求，大幅提升并发能力。
</details>

<details>
<summary>Q4：Pydantic 校验失败返回什么状态码？</summary>

422 Unprocessable Entity，body 里会说明哪个字段、什么错误。
</details>

### 6.3 面试视角（🔥🔥）

| 面试问法 | 答题要点 |
|---|---|
| FastAPI 相比 Flask 的优势？ | 自动文档、Pydantic 校验、原生异步、类型提示、性能更好 |
| 你的模型服务怎么对外提供？ | FastAPI 包成 REST 接口，Pydantic 校验 + 异步调用模型 + 错误处理 + 限流 |
| 怎么防参数注入/滥用？ | Pydantic 严格校验、鉴权（API Key/JWT）、限流、输入长度限制 |
| 高并发怎么处理？ | 异步 IO + 多 worker（uvicorn/gunicorn）+ 队列削峰 + 缓存 |
| 怎么返回流式输出？ | StreamingResponse / SSE，逐 token 推送（对应大模型打字机效果） |

### 6.4 下一步

接口有了，接下来把"检索"这件事落成工程：**RAG 的索引管线与查询管线**。

---

*本文对应素材：`vibecoding/01课件/docs/03-fastapi.md`*
