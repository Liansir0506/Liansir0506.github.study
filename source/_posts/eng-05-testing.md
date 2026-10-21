---
title: 测试：pytest、mock 与三环境
date: 2026-10-22 11:30:00
categories:
  - 工程篇
  - AI 工程化
tags:
  - 测试
description: 测试金字塔、pytest 三件套、用 mock 隔离大模型——以及 dev/test/prod 三环境为什么必须分开
mathjax: true
---

> **一句话概括**：测试是"改代码不心虚"的底气；AI 应用的测试还得加一层——把大模型 mock 掉，测逻辑而不是测运气。
> **这篇有多重要**：📌 —— 面试问"怎么保证代码质量"，测试是绕不开的答案；也问你"AI 输出不确定怎么测"。
> **前置知识**：eng-03 的 FastAPI 接口
> **对应素材**：`vibecoding/01课件/docs/05-testing.md`

## 一、初识：测试金字塔

```text
        /\
       /E2E\        少量：端到端（模拟真实用户走完整流程）
      /------\
     /集成测试 \     中量：接口/模块之间（API 调数据库、调模型）
    /----------\
   /  单元测试   \   大量：单个函数（快、稳、定位准）
  /--------------\
```

| 层级 | 测什么 | 特点 |
|---|---|---|
| **单元测试** | 单个函数/类 | 快（毫秒）、不依赖外部 |
| **集成测试** | 接口 + 数据库/模型 | 慢一些、能发现衔接问题 |
| **E2E** | 完整用户流程 | 最慢最脆、但最接近真实 |

> 原则：**金字塔要"下宽上窄"**——大量单元测试打底，少量 E2E 兜底。全都写 E2E，跑一次半小时，没人愿意跑。

## 二、运用：pytest 三件套

### 2.1 基础：assert

```python
# tests/test_chunk.py
from app.chunk import split_text

def test_split_basic():
    chunks = split_text("a" * 1200, size=500, overlap=50)
    assert len(chunks) == 3
    assert len(chunks[0]) == 500

def test_split_empty():
    assert split_text("") == []
```

运行：`pytest -v`（`-v` 显示每个用例名）。

### 2.2 进阶：参数化（一次测多组数据）

```python
import pytest

@pytest.mark.parametrize("text,expected", [
    ("", 0),
    ("短文本", 1),
    ("a" * 500, 1),
    ("a" * 501, 2),
])
def test_split_cases(text, expected):
    assert len(split_text(text)) == expected
```

> 比写四个函数清爽多了，加用例只要加一行数据。

### 2.3 关键：mock（隔离外部依赖）

**AI 应用测试的痛点**：调一次真模型要花钱、要等 5 秒、结果还不确定。

**mock** = 用假对象替换真依赖：

```python
from unittest.mock import patch

def test_chat_endpoint(client):
    # 把"调模型"这个动作替换成固定的假返回
    with patch("app.llm.call_model") as fake_llm:
        fake_llm.return_value = "这是模型的回答"

        resp = client.post("/chat", json={"message": "你好"})

    assert resp.status_code == 200
    assert resp.json()["reply"] == "这是模型的回答"
    fake_llm.assert_called_once()
```

这样测的是：**你的逻辑对不对**（参数传递、响应组装、错误处理），而不是"模型今天心情好不好"。

> 🔥 **AI 应用测试的核心思想：把不确定性隔离在外**。模型、向量库、第三方 API 全部 mock 掉；这些外部依赖本身的质量，用少量"真实调用"的集成测试单独验证。

## 三、初识：三环境——dev / test / prod

| 环境 | 用途 | 数据 | 特点 |
|---|---|---|---|
| **dev（开发）** | 本地开发调试 | 假数据/测试库 | 可随意改 |
| **test（测试）** | 提测、回归 | 独立测试库 | 接近生产但要隔离 |
| **prod（生产）** | 真实用户 | 真实数据 | 只读为主、变更走流程 |

### 3.1 两条铁律

**① 配置分离**（不同环境用不同配置）：

```text
.env.dev        # 本地：指向本地数据库、用测试 API Key
.env.test       # 测试环境
.env.prod       # 生产：真实 Key（由 CI/CD 注入，不进代码库）
```

```python
# 代码里读环境变量，不硬编码
import os
DB_URL = os.getenv("DB_URL")
LLM_API_KEY = os.getenv("LLM_API_KEY")
```

**② 数据隔离**（测试不能碰生产数据）：

> ⚠️ 真实事故：测试脚本连了生产数据库，一个 `DELETE` 清空了线上数据。**测试环境必须连独立的库**，这是红线。

## 四、运用：AI 应用测什么

| 测试对象 | 测什么 | 怎么测 |
|---|---|---|
| **文档切片** | 边界、长度、重叠 | 单元测试（纯函数，最好测） |
| **Prompt 拼装** | 变量替换、格式 | 单元测试 |
| **接口** | 状态码、参数校验、错误处理 | 集成测试 + mock 模型 |
| **RAG 检索** | 召回是否命中 | 构造"问题→应命中片段"的测试集 |
| **模型输出质量** | 是否忠实、是否相关 | 评测集 + LLM 评审/人工抽样（不是传统单测） |

> 📌 关键区分：**代码逻辑用单测，模型效果用评测集**——别指望用 assert 断言模型输出等于某个字符串。

## 五、总结

### 5.1 要点回顾

1. 测试金字塔：**单元多、集成中、E2E 少**
2. pytest 三件套：`assert`、`parametrize`（参数化）、`patch`（mock）
3. **mock 隔离 LLM/向量库**——测逻辑，不测模型的随机性
4. 三环境：dev / test / prod，**配置分离 + 数据隔离**
5. AI 应用：代码逻辑用单测，模型效果用**评测集**（不是断言字符串）

### 5.2 自测清单

<details>
<summary>Q1：为什么测试金字塔要"下宽上窄"？</summary>

单元测试快、稳定、定位准，适合大量写；E2E 慢且脆，写多了没人愿意跑，反馈周期变长。
</details>

<details>
<summary>Q2：mock 的作用是什么？AI 应用为什么特别需要？</summary>

用假对象替换外部依赖。AI 应用调模型慢、贵、输出不确定，mock 掉模型才能稳定测业务逻辑。
</details>

<details>
<summary>Q3：三环境为什么必须隔离？</summary>

防止测试操作污染生产数据、防止测试 Key 泄露、让开发可以随便折腾而不影响线上。数据隔离是红线。
</details>

<details>
<summary>Q4：怎么测 RAG 的检索质量？</summary>

构造测试集（问题 → 应命中的文档片段），计算命中率/召回率；生成质量用评测集 + LLM 评审 + 人工抽样。
</details>

### 5.3 面试视角（📌）

| 面试问法 | 答题要点 |
|---|---|
| 你怎么保证代码质量？ | 单测 + 集成测试 + Code Review + CI 自动跑 + 评测集（AI 部分） |
| AI 应用怎么测试？ | 外部依赖 mock；逻辑用单测；效果用评测集和抽样评估 |
| 测试环境和生产环境怎么隔离？ | 独立数据库、独立配置（环境变量）、独立密钥；禁止测试连生产 |
| 上线前检查什么？ | 测试通过、配置正确、依赖可用、回滚方案、监控告警 |

### 5.4 下一步

代码测过了，但"在我电脑上能跑"不算数——下一篇用 **Docker** 把它装进集装箱。

---

*本文对应素材：`vibecoding/01课件/docs/05-testing.md`*
