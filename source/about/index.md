---
title: 关于本站
date: 2026-10-23 10:00:00
type: 'about'
comments: true
keywords: 关于,AI学习笔记,转行AI,机器学习,深度学习,RAG,Agent,连少
description: 连少的 AI 学习笔记博客——78 篇文章系统覆盖机器学习、深度学习、NLP、提示词工程、Coze、Dify、RAG 与 Agent，附三条阅读路线和 10 篇精读清单
---

> **一句话概括**：这是连少的 AI 学习笔记博客——用 78 篇文章，把「机器学习 → 深度学习 → NLP → 提示词工程 → Coze / Dify → 工程化 → 三大项目」完整走了一遍。
> **适合谁看**：正在转行 AI 应用开发、想系统补基础 + 攒项目经验的人。

---

## 👋 我是谁

一个正在**转型 AI 应用开发**的学习者，目标岗位是 **AI 应用 / 算法工程师**。

这个博客记录我从零开始的学习全过程：不搬运课件，每一篇都按自己的理解重写——**先讲人话，再上代码，最后落到"面试会怎么问"**。

## 🗺️ 博客地图：4 大系列 · 10 个模块 · 78 篇

| 系列 | 模块 | 篇数 | 一句话概括 |
|---|---|---|---|
| **基础篇** | [机器学习](https://liansir0506.github.io/Liansir0506.github.study/categories/基础篇/机器学习/) | 7 | 线性回归 🔥 / KNN / 模型评估 🔥 / 决策树 / 集成学习 / 聚类 |
| | [深度学习](https://liansir0506.github.io/Liansir0506.github.study/categories/基础篇/深度学习/) | 8 | 自动微分 🔥 / 训练流程 🔥 / CNN / RNN 与词嵌入 🔥 |
| | [NLP 基础](https://liansir0506.github.io/Liansir0506.github.study/categories/基础篇/NLP-基础/) | 6 | 分词 / 词向量 🔥 / fasttext / BERT 🔥 |
| **应用篇** | [提示词工程](https://liansir0506.github.io/Liansir0506.github.study/categories/应用篇/提示词工程/) | 6 | Few-shot / CoT / **Function Calling 🔥** / **ReAct 🔥** |
| | [Coze 智能体](https://liansir0506.github.io/Liansir0506.github.study/categories/应用篇/Coze-智能体/) | 6 | 工作流 / 知识库 🔥 / Multi-Agent 🔥 / AI 面试助手 |
| | [Dify 平台](https://liansir0506.github.io/Liansir0506.github.study/categories/应用篇/Dify-应用平台/) | 4 | **检索三件套 🔥** / 对话流 / 法律助手 |
| **工程篇** | [AI 工程化](https://liansir0506.github.io/Liansir0506.github.study/categories/工程篇/AI-工程化/) | 10 | VibeCoding / FastAPI 🔥 / RAG 管线 🔥 / Docker 🔥 / vLLM 🔥 |
| **项目篇** | [RAG 问答系统](https://liansir0506.github.io/Liansir0506.github.study/categories/项目篇/RAG-问答系统/) | 15 | 企业级 RAG 全链路：混合检索 🔥 / 编排 / 治理 🔥 / 评测 🔥 |
| | [投满分 NLP 项目](https://liansir0506.github.io/Liansir0506.github.study/categories/项目篇/投满分-NLP-项目/) | 6 | 四方案对比 / BERT 微调 🔥 / 压缩 🔥 / **面试 8 步法 🔥🔥** |
| | [智慧旅游 Agent](https://liansir0506.github.io/Liansir0506.github.study/categories/项目篇/智慧旅游-Agent/) | 9 | **MCP 🔥🔥🔥 / A2A 🔥🔥🔥** / 五层记忆 / Docker 部署 |

> 🔥 是对「AI 应用 / 算法工程师」岗位相关度的标注：🔥 越多，越值得精读。

## 📖 三条阅读路线

**路线 A：求职冲刺（时间紧，先抓能讲的）**

```text
ml-01 线性回归 → ml-03 模型评估 → pe-01/02 提示词 → pe-03 Function Calling
→ pe-04 ReAct → ragp-00 项目概述 → ragp-06/08/09 检索与编排 → tmf-05 面试 8 步法
```

**路线 B：补基础（从数学到网络，一步一个脚印）**

```text
ml-00 入门 → ml-01 线性回归 → dl-01 张量 → dl-02 自动微分 → dl-03 网络基础
→ dl-04 训练流程 → dl-06 CNN → nlp-02 词向量 → nlp-05 BERT
```

**路线 C：项目向（直接奔着"能写进简历的东西"去）**

```text
eng-03 FastAPI → eng-04 RAG 管线 → ragp-00 ~ ragp-14 全链路 → agent-00 ~ agent-08 全链路
```

## ⭐ 如果只有时间读 10 篇

| # | 文章 | 为什么是它 |
|---|---|---|
| 1 | ml-03 模型评估 | P/R/F1 —— 所有 AI 岗位的公共语言 |
| 2 | dl-02 自动微分 | 理解一切训练的地基 |
| 3 | nlp-02 词向量 | "文本变向量" —— RAG 的起点 |
| 4 | pe-01 提示词基础 | 工作里天天用 |
| 5 | pe-03 Function Calling | 工具调用的原理，Agent 的地基 |
| 6 | pe-04 ReAct | Agent 循环的原始形态 |
| 7 | eng-04 RAG 管线 | 索引 + 查询双管线，RAG 工程的骨架 |
| 8 | ragp-08 混合检索 | RRF + Reranker，面试高频 |
| 9 | agent-02 MCP | 2025 年最值得知道的工具协议 |
| 10 | tmf-05 面试准备 | 把 78 篇讲成一场半小时的面试 |

## ✍️ 写作原则

1. **先讲人话**：每个概念先用生活例子讲明白，再上公式和代码
2. **落到岗位**：每篇结尾有「面试视角」——会怎么问、怎么答
3. **代码可跑**：案例代码都来自真实课程项目（鸢尾花 / 泰坦尼克 / CIFAR-10 / KnowForge / SmartVoyage）
4. **诚实标注**：🔥 标出岗位相关度，📌 标注"了解即可"，不制造焦虑

## 🔗 其他

- **GitHub**：[Liansir0506](https://github.com/Liansir0506)
- **本站源码**：[Liansir0506.github.study](https://github.com/Liansir0506/Liansir0506.github.study)（Hexo + Butterfly，push 即自动部署）
- **技术栈**：Hexo 8 · Butterfly 5 · MathJax · GitHub Actions

---

> 如果这个博客对你有帮助，欢迎去 GitHub 点个 ⭐。
