---
title: 项目概述：一个企业级 RAG 平台长什么样
date: 2026-10-22 14:00:00
categories:
  - 项目篇
  - RAG 问答系统
tags:
  - RAG
description: 从业务需求到技术选型到系统架构——一个能写进简历的企业级 RAG 问答平台全景图
mathjax: true
---

> **一句话概括**：企业知识库问答平台 KnowForge——FAQ + 文档 + 多租户隔离 + 混合检索 + 版本治理，一个能撑起面试半小时讲述的完整项目。
> **这篇有多重要**：📌 —— 项目的"总览图"。面试问"介绍下你这个项目"，就从这篇的架构讲起。
> **前置知识**：dify-01 的检索三件套、eng-04 的 RAG 双管线
> **对应素材**：`RAG2/01_课件/site/01-project-overview.html`、`course-outline.html`

## 一、初识：这个项目解决什么问题

**场景**：一家公司有大量内部知识——产品 FAQ、操作手册、制度文档、历史工单。员工/客户想问问题，但：

| 痛点 | 表现 |
|---|---|
| 找不到 | 文档散落在各个系统，搜索靠关键词，命中率低 |
| 看不懂 | 搜出来一堆文档，还要自己翻 |
| 答不准 | 直接用通用大模型问？它不知道你们公司的规定，还会编 |

**KnowForge 的解法**：一个 RAG 问答平台，支持：

- 上传企业文档和 FAQ，自动构建知识库
- 用户自然语言提问，系统检索相关片段、给出**带出处的回答**
- 多租户隔离（不同部门/客户的数据互不可见）
- 知识库版本管理（更新可灰度、可回滚）

## 二、初识：技术栈全景

| 层 | 技术 | 职责 |
|---|---|---|
| **接入层** | FastAPI（异步 + WebSocket） | HTTP/流式接口 |
| **编排层** | LangChain | 串起检索、改写、生成 |
| **检索层** | **Milvus 2.5**（Dense + BM25 混合检索） | 向量检索 + 关键词检索 |
| **重排层** | **BGE Reranker** | 精排，提升准确率 |
| **模型层** | LLM（Qwen 等）+ Embedding（BGE-M3） | 生成与向量化 |
| **缓存层** | Redis | embedding 缓存、检索结果缓存 |
| **治理层** | 版本管理 / 评测 / Trace | 知识可控、质量可量、问题可查 |
| **交付层** | Docker + Compose | 一键部署 |

> 🔥 这套技术栈是**当前企业 RAG 的主流组合**——面试时说得出"为什么选这些"，比说得出"用了这些"更重要。

## 三、初识：系统架构（两条主链路）

RAG 系统的本质是两条链路（eng-04 讲过原理，这里是工程实现）：

<svg class="lm-diagram" viewBox="0 0 720 492" role="img" xmlns="http://www.w3.org/2000/svg">
  <title>KnowForge 系统架构分层图</title>
  <defs>
    <marker id="dArrD" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M2 1L8 5L2 9" fill="none" stroke="#49b1f5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
  </defs>
  <text x="16" y="70" class="d-accent-ink">接入层</text>
  <rect x="86" y="30" width="534" height="72" rx="12" class="d-lane"/>
  <rect x="98" y="42" width="250" height="48" rx="8" class="d-box"/>
  <text x="223" y="66" class="d-ink" text-anchor="middle">Web / IM 入口</text>
  <text x="223" y="82" class="d-sub" text-anchor="middle">多端接入</text>
  <rect x="368" y="42" width="250" height="48" rx="8" class="d-box"/>
  <text x="493" y="66" class="d-ink" text-anchor="middle">API 网关</text>
  <text x="493" y="82" class="d-sub" text-anchor="middle">鉴权 · 限流 · 租户识别</text>
  <line x1="353" y1="102" x2="353" y2="114" class="d-flow" marker-end="url(#dArrD)"/>
  <text x="16" y="158" class="d-accent-ink">服务层</text>
  <rect x="86" y="118" width="534" height="72" rx="12" class="d-lane"/>
  <rect x="98" y="130" width="166" height="48" rx="8" class="d-box-soft"/>
  <text x="181" y="154" class="d-accent-ink" text-anchor="middle">QAService 编排</text>
  <text x="181" y="170" class="d-sub" text-anchor="middle">串起整条链路</text>
  <rect x="277" y="130" width="166" height="48" rx="8" class="d-box"/>
  <text x="360" y="154" class="d-ink" text-anchor="middle">意图分类</text>
  <text x="360" y="170" class="d-sub" text-anchor="middle">FAQ / 文档 / 闲聊 / 人工</text>
  <rect x="456" y="130" width="166" height="48" rx="8" class="d-box"/>
  <text x="539" y="154" class="d-ink" text-anchor="middle">查询改写</text>
  <text x="539" y="170" class="d-sub" text-anchor="middle">补全 · 扩展 · 变体</text>
  <line x1="353" y1="190" x2="353" y2="202" class="d-flow" marker-end="url(#dArrD)"/>
  <text x="16" y="246" class="d-accent-ink">检索层</text>
  <rect x="86" y="206" width="534" height="72" rx="12" class="d-lane"/>
  <rect x="98" y="218" width="122" height="48" rx="8" class="d-box"/>
  <text x="159" y="242" class="d-ink" text-anchor="middle">Milvus</text>
  <text x="159" y="258" class="d-sub" text-anchor="middle">向量检索</text>
  <rect x="231" y="218" width="122" height="48" rx="8" class="d-box"/>
  <text x="292" y="242" class="d-ink" text-anchor="middle">ES</text>
  <text x="292" y="258" class="d-sub" text-anchor="middle">全文 BM25</text>
  <rect x="364" y="218" width="122" height="48" rx="8" class="d-box"/>
  <text x="425" y="242" class="d-ink" text-anchor="middle">RRF 融合</text>
  <text x="425" y="258" class="d-sub" text-anchor="middle">双路召回合并</text>
  <rect x="497" y="218" width="122" height="48" rx="8" class="d-box-soft"/>
  <text x="558" y="242" class="d-accent-ink" text-anchor="middle">Reranker</text>
  <text x="558" y="258" class="d-sub" text-anchor="middle">精排取 TopK</text>
  <line x1="353" y1="278" x2="353" y2="290" class="d-flow" marker-end="url(#dArrD)"/>
  <text x="16" y="334" class="d-accent-ink">模型层</text>
  <rect x="86" y="294" width="534" height="72" rx="12" class="d-lane"/>
  <rect x="98" y="306" width="166" height="48" rx="8" class="d-box"/>
  <text x="181" y="330" class="d-ink" text-anchor="middle">LLM</text>
  <text x="181" y="346" class="d-sub" text-anchor="middle">流式生成</text>
  <rect x="277" y="306" width="166" height="48" rx="8" class="d-box"/>
  <text x="360" y="330" class="d-ink" text-anchor="middle">Embedding</text>
  <text x="360" y="346" class="d-sub" text-anchor="middle">文本向量化</text>
  <rect x="456" y="306" width="166" height="48" rx="8" class="d-box"/>
  <text x="539" y="330" class="d-ink" text-anchor="middle">Reranker 模型</text>
  <text x="539" y="346" class="d-sub" text-anchor="middle">相关性精排</text>
  <line x1="353" y1="366" x2="353" y2="378" class="d-flow" marker-end="url(#dArrD)"/>
  <text x="16" y="422" class="d-accent-ink">数据层</text>
  <rect x="86" y="382" width="534" height="72" rx="12" class="d-lane"/>
  <rect x="98" y="394" width="166" height="48" rx="8" class="d-box"/>
  <text x="181" y="418" class="d-ink" text-anchor="middle">MySQL</text>
  <text x="181" y="434" class="d-sub" text-anchor="middle">租户 · 知识库版本</text>
  <rect x="277" y="394" width="166" height="48" rx="8" class="d-box"/>
  <text x="360" y="418" class="d-ink" text-anchor="middle">Redis</text>
  <text x="360" y="434" class="d-sub" text-anchor="middle">缓存 · 限流</text>
  <rect x="456" y="394" width="166" height="48" rx="8" class="d-box"/>
  <text x="539" y="418" class="d-ink" text-anchor="middle">MinIO</text>
  <text x="539" y="434" class="d-sub" text-anchor="middle">原始文档</text>
  <rect x="636" y="30" width="68" height="424" rx="12" class="d-box-soft"/>
  <text x="670" y="64" class="d-accent-ink" text-anchor="middle">可观测</text>
  <text x="670" y="96" class="d-sub" text-anchor="middle">Trace</text>
  <text x="670" y="128" class="d-sub" text-anchor="middle">日志</text>
  <text x="670" y="160" class="d-sub" text-anchor="middle">指标</text>
  <text x="670" y="192" class="d-sub" text-anchor="middle">告警</text>
  <text x="360" y="478" class="d-sub" text-anchor="middle">在线链路：编排 → 意图 → 改写 → 混合检索 → 精排 → 生成；每一步有缓存、超时与降级</text>
</svg>
<p class="lm-diagram-cap">图 4 · KnowForge 的五层架构：右边竖条是贯穿所有层的可观测能力——面试讲架构时，先讲分层再讲链路</p>

### 3.1 为什么在线链路这么"长"

初学者常问：为什么不直接"问题 → 检索 → 回答"三步搞定？

因为真实企业场景有三个约束：

| 约束 | 需要什么能力 |
|---|---|
| 问题类型多（FAQ/文档/闲聊） | **意图分类** + 分流 |
| 用户表达口语化、有指代 | **查询改写** |
| 单一检索方式召回不全 | **混合检索 + Reranker** |

> 每一步都是被真实问题"逼"出来的——这也是这个项目最有价值的地方：**它不是一个 demo，而是一条工程链路。**

## 四、初识：这个项目的四个亮点（面试素材）

| 亮点 | 说明 | 面试怎么讲 |
|---|---|---|
| **混合检索** | Dense + BM25 双路召回 + RRF 融合 + Reranker 精排 | "单路召回有短板，双路互补 + 精排，召回率和准确率都提上去了" |
| **意图路由** | 不同问题走不同的检索策略 | "不是所有问题都值得查知识库——闲聊直接答，FAQ 走精确匹配，文档问题走混合检索" |
| **版本治理** | 知识库可灰度、可回滚 | "知识是活的，要有版本管理，出问题能回滚到上一版" |
| **质量闭环** | 评测集 + Bad Case 归因 | "不只看'能不能答'，还能量化'答得好不好'，并且形成改进闭环" |

## 五、初识：学习路线（本模块的 15 篇怎么读）

```text
基础与框架（4 篇）
  01 项目概述 ← 你在这
  02 RAG 核心概念（Embedding/向量/混合检索）
  03 LangChain 生态
  04 Milvus 索引机制
      ↓
核心链路前段（4 篇）
  05 最小混合检索实践
  06 意图分类
  07 检索策略与动态计划
  08 查询改写与变体
      ↓
核心链路后段（4 篇）
  09 混合检索（Dense+BM25+RRF+Reranker）
  10 QAService 编排
  11 RAG Pipeline 与 Prompt
  12 FastAPI 异步与流式
      ↓
治理与生产化（3 篇）
  13 知识库治理与版本发布
  14 质量评测与 Bad Case 闭环
  15 测试、可观测与 Docker 交付
```

> 💡 如果只想快速了解项目（面试前复习），优先看：**01 → 02 → 09 → 11 → 14**——这五篇覆盖了"是什么、为什么这么设计、怎么实现、怎么保证质量"。

## 六、总结

### 6.1 要点回顾

1. KnowForge = 企业知识库 RAG 平台：文档入库 + 自然语言问答 + 多租户 + 版本治理
2. 技术栈：**FastAPI + LangChain + Milvus（混合检索）+ BGE Reranker + Redis + Docker**
3. 两条链路：**离线入库**（解析→切片→向量化→入库）和**在线问答**（意图→计划→改写→检索→重排→生成）
4. 在线链路之所以长，是被真实约束逼出来的：意图多、表达口语化、单路召回不全
5. 四个面试亮点：**混合检索、意图路由、版本治理、质量闭环**

### 6.2 自测清单

<details>
<summary>Q1：这个项目为什么需要"意图分类"？</summary>

不同问题需要不同处理：闲聊不需要检索、FAQ 适合精确匹配、文档问题适合混合检索——先分类才能选对策略，避免"所有问题都查一遍"的浪费和误答。
</details>

<details>
<summary>Q2：为什么用 Milvus 而不是直接用向量文件？</summary>

数据量大时需要 ANN 索引（HNSW）保证检索速度；还需要标量过滤、多租户隔离、增量更新和持久化——这些是专业向量数据库的能力。
</details>

<details>
<summary>Q3：这个项目最值得在面试里讲的亮点是什么？</summary>

混合检索 + RRF + Reranker 的完整链路，配合意图路由与质量评测闭环——体现的是"工程化 RAG"能力，而不只是"调了 OpenAI API"。
</details>

### 6.3 面试视角（📌）

| 面试问法 | 答题要点 |
|---|---|
| 介绍下你的 RAG 项目 | 业务场景 → 架构（双链路）→ 技术选型 → 亮点（混合检索/意图/版本/评测）→ 效果与改进 |
| 为什么这样选型？ | Milvus 支持混合检索与多租户；LangChain 做编排；Reranker 提精度；Redis 降延迟 |
| 项目规模/数据量？ | 说清楚文档数、chunk 数、QPS、延迟指标（面试官关心真实感） |
| 项目难点？ | 召回不全（混合检索）、多租户隔离、版本回滚、Bad Case 定位 |

### 6.4 下一步

架构图有了，下一篇把 RAG 的底层概念补扎实：**Embedding、向量检索、混合检索**。

---

*本文对应素材：`RAG2/01_课件/site/01-project-overview.html`、`course-outline.html`*
