---
title: 测试、可观测性与 Docker 交付
date: 2026-10-22 21:00:00
categories:
  - 项目篇
  - RAG 问答系统
tags:
  - 测试
  - 可观测性
  - Trace
  - Docker交付
description: 从"能跑"到"敢上线"——三层测试、四个可观测指标、Docker 一键交付与排障
mathjax: true
---

> **一句话概括**：上线不是"代码写完"，而是"出了问题你能 5 分钟内知道、10 分钟内定位"——测试、可观测、交付三件套。
> **这篇有多重要**：📌 —— 面试问"你的项目怎么保证稳定运行"，这三点是标准答案。
> **前置知识**：eng-05 测试、eng-06 Docker、eng-08 部署、ragp-13 评测
> **对应素材**：`RAG2/01_课件/site/15-testing-system.html`、`16-observability-capacity.html`、`19-docker-containerization.html`

## 一、初识：RAG 项目要测什么

| 层 | 测什么 | 工具 |
|---|---|---|
| **单元测试** | 切片、Prompt 拼装、RRF 融合、参数校验 | pytest + mock |
| **接口测试** | `/qa` 的状态码、参数校验、降级路径 | httpx + TestClient |
| **检索回归测试** | 评测集的 Recall@K 是否达标 | pytest + 评测集 |
| **契约测试** | 上下游（Milvus/模型 API）的接口约定 | mock + schema 校验 |

### 1.1 检索回归测试（RAG 特有）

```python
import json
import pytest

CASES = [json.loads(line) for line in open("eval_set.jsonl", encoding="utf-8")]

@pytest.mark.parametrize("case", CASES[:20])
def test_retrieval_hit(case):
    """正确片段必须出现在 top5"""
    hits = retrieve(case["question"], top_k=5)
    hit_ids = {h["id"] for h in hits}
    assert hit_ids & set(case["expected_chunk_ids"]), \
        f"未命中: {case['question']}"
```

> 🔥 这个测试就是"回归防线"：**改了切片/embedding/检索参数后，跑一遍就知道有没有把原本对的问题搞坏**。

### 1.2 mock 掉外部依赖

```python
def test_qa_fallback_when_reranker_fails(client, monkeypatch):
    """Reranker 挂了应降级而不是 500"""
    monkeypatch.setattr(reranker, "rerank", lambda *a, **k: (_ for _ in ()).throw(TimeoutError()))
    resp = client.post("/qa", json={"query": "退款政策"})
    assert resp.status_code == 200
    assert "sources" in resp.json()        # 有降级结果
```

## 二、初识：可观测性三件套

```text
Metrics（指标）：系统整体健康——QPS、P99 延迟、错误率
Traces（链路）：一次请求经历了什么——每步耗时、命中情况
Logs（日志）：具体细节——参数、异常堆栈
```

### 2.1 四个必须监控的指标（RAG 特有）

| 指标 | 异常信号 |
|---|---|
| **检索耗时 P99** | 突然升高 → Milvus 压力/索引问题 |
| **召回命中率** | 下降 → 知识库/embedding/切片问题 |
| **拒答率** | 异常升高 → 检索变差或 Prompt 被改坏 |
| **引用校验失败率** | 升高 → 模型幻觉增加 |

> ⚠️ 只看 QPS 和延迟是**不够的**——一个"秒回但全在胡说"的 RAG 系统，指标很漂亮，业务已经死了。

### 2.2 Trace：一次请求的完整链路

```text
trace_id = abc123
├── intent        320ms   intent=document
├── plan          280ms   dense=10 sparse=10 rewrite=true
├── rewrite       310ms   3 variants
├── dense_search  140ms   20 hits
├── sparse_search  80ms   20 hits
├── rerank        210ms   top3 (scores: 0.82/0.71/0.45)
└── generate     2100ms   412 tokens
总耗时 3.4s
```

有了这个，**每次慢请求都能一眼看出瓶颈在哪**。

工具选择：

| 工具 | 说明 |
|---|---|
| **OpenTelemetry + Jaeger** | 开源标准，跨服务链路 |
| LangSmith | LangChain 生态，LLM 调用可视化 |
| 自研 trace 中间件 | 简单场景，记录每步耗时写日志 |

> 📌 起步阶段：**自己写个 `trace.step()` 装饰器记录耗时**，比接入完整方案更快见效。

## 三、初识：容量评估（怎么估 QPS）

### 3.1 从单请求耗时推并发

```text
单请求耗时 ≈ 3.4s（其中生成 2.1s）

一个 GPU 实例能同时跑多少生成？
  → 取决于 LLM 的并发能力（vLLM 可到几十）

单实例 QPS ≈ 并发数 / 单请求耗时
  → 20 并发 / 3.4s ≈ 5.9 QPS
```

### 3.2 压测怎么做

| 步骤 | 做法 |
|---|---|
| ① 基线 | 单并发跑 20 次，记录 P50/P99 |
| ② 逐步加压 | 5 → 10 → 20 → 50 并发，观察延迟与错误率 |
| ③ 找拐点 | 延迟陡增或错误率上升的点 = 容量上限 |
| ④ 定位瓶颈 | 看 trace：哪一步先饱和（检索？精排？生成？） |

> 💡 常见瓶颈顺序：**LLM 生成 > Reranker > 向量检索 > 应用层**。

## 四、运用：Docker 交付（一键起整套）

RAG 项目依赖多：应用 + Milvus + Redis + （可选）模型服务。

`compose.yaml`：

```yaml
services:
  api:
    build: .
    ports: ["8000:8000"]
    env_file: .env
    depends_on: [milvus, redis]
    restart: unless-stopped

  milvus:
    image: milvusdb/milvus:v2.5-latest
    ports: ["19530:19530"]
    volumes: [milvus_data:/var/lib/milvus]

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes: [redis_data:/data]

volumes:
  milvus_data:
  redis_data:
```

```bash
docker compose up -d            # 一键启动
docker compose ps               # 状态
docker compose logs -f api      # 看应用日志
```

### 4.1 排障三件套（出问题先看这三个）

```bash
docker compose ps                          # 1. 谁挂了？
docker compose logs --tail=100 api         # 2. 应用报什么错？
docker exec -it api curl localhost:8000/health   # 3. 服务活着吗？
```

### 4.2 健康检查要检查"下游"

```python
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "milvus": await ping_milvus(),
        "redis": await ping_redis(),
        "llm": await ping_llm(),
    }
```

> 📌 只返回 `ok` 的健康检查是骗自己——**下游挂了，你的服务其实已经废了**。

## 五、初识：上线检查清单（RAG 项目版）

- [ ] 评测集（≥50 条）跑过，Recall@5 达标
- [ ] 降级路径测试过（Reranker/LLM 超时能兜底）
- [ ] `/health` 检查下游，网关能探活
- [ ] Trace 能打出每步耗时；日志带 trace_id
- [ ] 指标：QPS/P99/召回率/拒答率 有面板
- [ ] kb_version 切换与回滚演练过
- [ ] 密钥走环境变量，不在代码里
- [ ] 压测过容量上限，知道能扛多少

## 六、总结

### 6.1 要点回顾

1. 四层测试：单元 / 接口 / **检索回归** / 契约；回归测试用评测集守住"不退化"
2. 可观测三件套：**Metrics + Traces + Logs**；RAG 特有指标：召回率、拒答率、引用校验失败率
3. **Trace 记录每步耗时**，慢请求一眼定位瓶颈
4. 容量评估：单请求耗时 → 并发 → QPS；压测找拐点，看 trace 定位瓶颈
5. Docker Compose 一键交付；**健康检查要探下游**，排障看 ps/logs/health

### 6.2 自测清单

<details>
<summary>Q1：RAG 的"检索回归测试"测什么？</summary>

用评测集断言"正确片段必须出现在 top-k"，防止改切片/参数/embedding 后把原本正确的问题搞坏。
</details>

<details>
<summary>Q2：RAG 必须监控的四个特有指标？</summary>

检索耗时 P99、召回命中率、拒答率、引用校验失败率——它们反映"答得对不对"，比 QPS 更能暴露问题。
</details>

<details>
<summary>Q3：怎么做容量评估？</summary>

先用单并发测基线耗时，再逐步加压找延迟/错误率拐点；用 trace 定位先饱和的环节（通常是 LLM 生成）。
</details>

<details>
<summary>Q4：健康检查为什么必须探下游？</summary>

Milvus/Redis/LLM 挂掉时应用本身"活着"但功能已失效；探活下游才能让网关正确摘除实例。
</details>

### 6.3 面试视角（📌）

| 面试问法 | 答题要点 |
|---|---|
| 怎么保证 RAG 项目稳定？ | 测试（含检索回归）+ 可观测（指标/trace/日志）+ 降级 + 压测 |
| 线上效果变差了怎么查？ | 看指标趋势→trace 定位慢/失败环节→归因检索或生成→对比版本 |
| 怎么做发布保障？ | 评测集门禁 + 灰度 + 版本回滚 + 上线检查清单 |
| 怎么评估能扛多少流量？ | 压测找拐点、看瓶颈环节、按延迟预算规划扩容 |
| 项目怎么交付？ | Docker Compose 编排应用+Milvus+Redis；健康检查+排障手册 |

### 6.4 模块完结：RAG 问答系统 15 篇全齐 🎉

| 批次 | 篇目 |
|---|---|
| 基础与框架 | 项目概述 / RAG 核心概念 / LangChain / Milvus |
| 核心前段 | 最小实践 / 意图分类 / 检索策略 / 查询改写 |
| 核心后段 | 混合检索 / QAService / Pipeline+Prompt / FastAPI 异步 |
| 治理与生产 | 知识库治理 / 质量评测 / 测试可观测交付 |

**这就是一个完整的企业级 RAG 项目从 0 到 1 的全过程。** 面试聊项目，从 ragp-00 的架构讲起，按链路往下讲，最后落到评测与治理——半小时都能讲满。

下一个模块：**项目篇 / 投满分 NLP 项目**（5–7 篇）。

---

*本文对应素材：`RAG2/01_课件/site/15-testing-system.html`、`16-observability-capacity.html`、`19-docker-containerization.html`*
