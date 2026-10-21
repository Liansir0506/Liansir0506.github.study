---
title: FastAPI 异步与流式：把问答做成高性能服务
date: 2026-10-22 19:30:00
categories:
  - 项目篇
  - RAG 问答系统
tags:
  - FastAPI
  - 异步
  - SSE
description: async/await 在 RAG 链路里到底省了什么、SSE 和 WebSocket 怎么选、并发与超时怎么控
mathjax: true
---

> **一句话概括**：RAG 的每个环节都在"等"（等模型、等检索、等精排）——异步让单机能同时等几十上百个请求。
> **这篇有多重要**：📌 —— 服务能不能上生产的分水岭；面试问"怎么支撑高并发"就答这篇。
> **前置知识**：eng-03 的 FastAPI 基础、ragp-09 的 QAService
> **对应素材**：`RAG2/01_课件/site/11-fastapi-async.html`、`12-app-entry-preflight.html`

## 一、初识：为什么 RAG 服务必须异步

### 1.1 一次请求的耗时构成

```text
意图分类   300ms（等 LLM）
检索       150ms（等 Milvus）
精排       200ms（等 Reranker）
生成      3000ms（等 LLM 流式输出）
———————————————
总计       ~3.6s，其中 99% 是"等"
```

**全是 IO 等待，CPU 几乎不干活**——这是典型的 IO 密集型场景。

### 1.2 同步 vs 异步的差别

| | 同步（def + requests） | 异步（async def + httpx） |
|---|---|---|
| 一个请求等待时 | **线程被占住**，什么也干不了 | 线程释放，去处理别的请求 |
| 并发能力 | ≈ 线程数（几十） | 几千~上万 |
| 内存 | 每线程栈开销 | 单线程事件循环 |

> 🔥 一句话：**同步是"一个人排队等咖啡"，异步是"点完单去干别的，好了叫你"**。

## 二、运用：把链路写成异步

### 2.1 全链路用异步客户端

```python
import httpx
from fastapi import FastAPI

app = FastAPI()
http = httpx.AsyncClient(timeout=10)      # 复用连接池，别每次新建

@app.post("/qa")
async def qa(req: QARequest):
    intent = await classify(req.query)                    # await LLM
    hits = await retrieve(req.query, intent)               # await Milvus
    chunks = await rerank(req.query, hits)                 # await Reranker
    answer = await generate(req.query, chunks)             # await LLM
    return {"answer": answer, "sources": chunks}
```

三个容易踩的坑：

| 坑 | 后果 | 正确做法 |
|---|---|---|
| 在 `async def` 里用同步库（requests、pymilvus 同步客户端） | **阻塞事件循环**，整个服务卡住 | 用 httpx / 异步客户端，或 `run_in_threadpool` |
| 每次请求新建 httpx.Client | 连接无法复用，延迟翻倍 | 全局复用一个 AsyncClient |
| 在 async 函数里做 CPU 密集操作（如大文件解析） | 阻塞 | 丢到线程池/进程池 |

### 2.2 多路检索并行

```python
async def retrieve_multi(query, plan):
    tasks = []
    for variant in plan.variants:
        tasks.append(search_dense(variant))
        tasks.append(search_sparse(variant))
    results = await asyncio.gather(*tasks, return_exceptions=True)
    # 某一路失败不影响整体
    ok = [r for r in results if not isinstance(r, Exception)]
    return rrf_fuse(ok)
```

> 📌 `gather` 的总耗时 ≈ **最慢的那一路**，而不是所有路之和。4 路并行 → 从 600ms 降到 150ms。

## 三、运用：并发控制（别把自己打垮）

异步能开很多并发，但**下游扛不住**——模型 API 有 QPS 限制、Milvus 有连接数上限。

```python
import asyncio

# 限制同时进行的生成请求
llm_sem = asyncio.Semaphore(20)

async def generate_guarded(prompt):
    async with llm_sem:
        return await llm(prompt)
```

| 控制手段 | 作用 |
|---|---|
| **Semaphore** | 限制并发数（保护下游） |
| **超时**（`asyncio.wait_for`） | 防止单个请求拖死 |
| **连接池大小** | httpx limits / 数据库池 |
| **限流**（按租户/用户） | 防止单用户刷爆系统 |

```python
try:
    result = await asyncio.wait_for(generate_guarded(prompt), timeout=8)
except asyncio.TimeoutError:
    return fallback_answer()      # 降级
```

## 四、初识：流式输出——SSE vs WebSocket

### 4.1 两种方案对比

| | **SSE（Server-Sent Events）** | **WebSocket** |
|---|---|---|
| 协议 | HTTP（单向：服务器→客户端） | 独立协议（双向） |
| 实现复杂度 | 低（就是长连接的 HTTP 响应） | 中（需握手、心跳） |
| 断线重连 | 浏览器自动 | 自己实现 |
| 适合 | **AI 流式回答**（只要服务端推） | 双向交互（语音、多人协作） |

> 🔥 结论：**RAG 的流式回答用 SSE 就够了**——单向推送、实现简单、浏览器自动重连。

### 4.2 FastAPI 实现 SSE

```python
from fastapi.responses import StreamingResponse

@app.post("/qa/stream")
async def qa_stream(req: QARequest):
    async def event_gen():
        async for token in qa_service.stream(req.query):
            # SSE 格式：data: xxx\n\n
            yield f"data: {json.dumps({'token': token}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

两个关键 header：

- `Cache-Control: no-cache`：禁止 CDN/浏览器缓存
- `X-Accel-Buffering: no`：**关掉 Nginx 的缓冲**，否则流式会变成"一次性返回"

> ⚠️ 上线最常见的坑：**本地流式正常，部署后变成"转圈 3 秒然后一次性出现"**——就是 Nginx 缓冲没关。

## 五、初识：生产环境的四个配置

| 配置 | 建议 | 说明 |
|---|---|---|
| **worker 数** | `2~4 × CPU核数`（uvicorn/gunicorn） | 每个 worker 独立事件循环 |
| **超时** | 网关 60s + 应用内 8~10s | 网关超时要比应用长 |
| **健康检查** | `/health` 检查下游（Milvus/Redis） | 别只返回 ok |
| **优雅关闭** | 收到 SIGTERM 后停止接新请求、等待在途完成 | 避免用户请求被砍断 |

```bash
gunicorn main:app -k uvicorn.workers.UvicornWorker -w 4 --timeout 60
```

## 六、总结

### 6.1 要点回顾

1. RAG 是 **IO 密集型**：99% 时间在等模型/检索；**必须异步**
2. 三个坑：同步库阻塞事件循环、连接不复用、CPU 密集操作放错地方
3. 多路检索用 `asyncio.gather` 并行，耗时≈最慢一路
4. 并发要**主动控制**：Semaphore、超时、限流、连接池
5. **流式用 SSE**（单向推送）、WebSocket 用于双向；**记得关 Nginx 缓冲**

### 6.2 自测清单

<details>
<summary>Q1：为什么 RAG 服务必须用异步？</summary>

链路各环节都是 IO 等待（模型、检索、精排），同步会占住线程导致并发极低；异步在等待时处理其他请求，单机可支撑高并发。
</details>

<details>
<summary>Q2：async 里用了同步库会怎样？</summary>

阻塞事件循环——所有协程都卡住，并发能力退化甚至完全停止响应。要用异步客户端或丢线程池。
</details>

<details>
<summary>Q3：SSE 和 WebSocket 怎么选？</summary>

只需服务端推送（AI 流式回答）用 SSE：实现简单、浏览器自动重连；需要双向实时交互才用 WebSocket。
</details>

<details>
<summary>Q4：流式部署后失效，最常见的原因？</summary>

Nginx/网关的响应缓冲（proxy_buffering / X-Accel-Buffering），导致数据被攒起来一次性返回。
</details>

### 6.3 面试视角（📌）

| 面试问法 | 答题要点 |
|---|---|
| 怎么支撑高并发？ | 全链路异步 + 并行 + 缓存 + 限流 + 连接池 + 多 worker |
| 流式回答怎么实现？ | LLM astream → SSE StreamingResponse；关缓冲、处理断开 |
| 异步有什么坑？ | 同步库阻塞、CPU 密集阻塞、忘记 await、并发失控 |
| 超时怎么设计？ | 应用内预算（8~10s）+ 网关更长（60s）+ 各环节降级 |
| 怎么做优雅关闭？ | SIGTERM 后停止接新请求，等待在途请求完成再退出 |

### 6.4 批次小结：核心链路完成（12/15）

到这里，**RAG 的核心问答链路全部打通**：

```text
意图 → 计划 → 改写 → 混合检索 → 融合 → 精排 → Prompt → 流式生成
```

剩下三篇是"让它可靠地跑在生产"：**知识库治理 → 质量评测 → 测试/可观测/交付**。

---

*本文对应素材：`RAG2/01_课件/site/11-fastapi-async.html`、`12-app-entry-preflight.html`*
