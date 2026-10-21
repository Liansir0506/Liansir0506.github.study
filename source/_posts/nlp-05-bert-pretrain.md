---
title: 迁移学习与 BERT：预训练 + 微调
date: 2026-10-21 15:30:00
categories:
  - 基础篇
  - NLP 基础
tags:
  - BERT
  - 迁移学习
  - transformers
description: 预训练+微调是怎么成为主流的、BERT 的关键设计、transformers 三种用法——今天所有大模型的起点
mathjax: true
---

> **一句话概括**：先在海量语料上"通读天下文章"（预训练），再用自己的小数据"专项补课"（微调）——这套范式支撑了整个大模型时代。
> **这篇有多重要**：🔥🔥🔥 —— **面试必考**："BERT 和 GPT 的区别""预训练和微调是什么"；而且 RAG 用的 embedding 模型就是 BERT 这类 encoder。
> **前置知识**：nlp-02 的词向量、nlp-04 的 RNN（了解历史）、dl-03 的 Transformer 概念
> **对应素材**：`05-迁移学习(上).pptx`、`06-迁移学习(下).pptx`、`02-代码/day05`（pipeline / 自动模型 / 指定模型）

## 一、初识：迁移学习解决了什么痛点

以前的 NLP 模式：**每个任务从头训练一个模型**。

- 情感分析：标注 10 万条情感数据 → 训练
- 意图识别：再标注 10 万条 → 再训练
- 每个任务都从零开始，数据贵、训练慢、效果还不一定好

**迁移学习**换了个思路：**先在超大规模通用语料上训练一个"通才"（预训练），再让它针对具体任务"补课"（微调）**。

| 阶段 | 数据 | 目标 | 产物 |
|---|---|---|---|
| **预训练** | 无标注的海量文本（维基、网页、书籍） | 学会语言本身（词汇、语法、常识） | 一个通用语言模型（如 BERT） |
| **微调** | 少量带标签的任务数据 | 适配具体任务（分类/抽取/问答） | 任务模型 |

> 一个形象的类比：**预训练 = 读完大学通识课；微调 = 入职后的岗前培训。**

## 二、初识：BERT 的关键设计

BERT（Bidirectional Encoder Representations from Transformers，2018）是"预训练+微调"范式的开山之作。

### 2.1 三个关键点

| 设计 | 含义 |
|---|---|
| **双向 Transformer Encoder** | 同时看左右上下文（不像 RNN 只能单向） |
| **`[CLS]` 和 `[SEP]` 特殊 token** | `[CLS]` 放句首、聚合整句语义（做分类用）；`[SEP]` 分隔两个句子 |
| **两个预训练任务** | **MLM**（随机遮住 15% 的词，让模型猜）+ **NSP**（判断两句是否连续） |

### 2.2 MLM：为什么它这么关键

把一句话随机抠掉几个词：

```text
输入：我 [MASK] 北京 天安门
让模型猜：是 / 在 / 爱 …
```

因为要猜被遮住的词，模型必须**同时利用左右两侧的信息**——这就逼出了"双向理解"能力。

> 顺带一提：你等下要跑的 `fill-mask`（完形填空）任务，就是 MLM 的直接应用。

### 2.3 BERT vs GPT：Encoder 与 Decoder 的分岔

| | BERT | GPT |
|---|---|---|
| 结构 | **Encoder**（双向） | **Decoder**（单向，从左到右） |
| 预训练任务 | MLM（完形填空） | 预测下一个 token |
| 擅长 | 理解类任务（分类/抽取/检索） | **生成类任务**（写作/对话） |
| 今天的地位 | RAG 的 embedding、分类/抽取主力 | 大模型（ChatGPT 等）的底座 |

> 🔥 一句话记住：**BERT 会"读"，GPT 会"写"**。今天的大模型几乎全是 GPT 路线（Decoder-only），但 RAG 检索用的向量模型（如 bge、text-embedding）多为 BERT 系。

## 三、运用：transformers 库的三种用法

HuggingFace 的 `transformers` 是 NLP 的"应用商店"：几万预训练模型，一行代码调用。

```bash
pip install transformers torch
```

### 3.1 三种用法从简到繁

| 用法 | 适合 | 代码量 |
|---|---|---|
| **pipeline** | 快速验证、demo | 2 行 |
| **AutoModel** | 自己接下游层 | 10 行 |
| **指定模型类** | 精细控制（改结构/训练） | 20 行+ |

### 3.2 用法一：pipeline（一行搞定）

```python
from transformers import pipeline

# 情感分析
clf = pipeline(task="sentiment-analysis", model="./models/chinese_sentiment")
print(clf("这个衣服太丑了"))
# [{'label': 'negative', 'score': 0.98}]
```

pipeline 支持几十种任务：`sentiment-analysis`、`text-classification`、`ner`、`fill-mask`、`feature-extraction`、`summarization`…

### 3.3 用法二：特征提取（RAG 的 embedding 就来自这里）🔥

```python
from transformers import pipeline
import numpy as np

extractor = pipeline(task="feature-extraction", model="./models/bert-base-chinese")
output = extractor("老潘今天挺帅的")

print(np.array(output).shape)    # (1, 16, 768)
```

三个数字分别代表：

| 维度 | 含义 |
|---|---|
| **1** | 1 个样本 |
| **16** | token 数（原句 14 个字 + `[CLS]` + `[SEP]`） |
| **768** | bert-base 的向量维度（每 token 一个 768 维向量） |

> 🔥 **这就是 RAG 的向量来源**：把文档块送进这种模型，拿 `[CLS]` 位置的向量（或所有 token 的池化）作为"文档向量"，存进向量库。检索时把问题也这么编码，算余弦相似度。
>
> 注意：直接用 bert-base 做检索效果一般，工业界会用专门训练的 embedding 模型（bge-m3、text-embedding-3 等）——但**原理完全相同**。

### 3.4 用法三：完形填空与 NER

```python
# 完形填空（BERT 的 MLM 任务直接可用）
fill = pipeline(task="fill-mask", model="./models/chinese-bert-wwm")
print(fill("我[MASK]老潘"))
# [{'score':0.49, 'token_str':'是', ...}, {'score':0.24, 'token_str':'叫', ...}]

# 命名实体识别
ner = pipeline(task="ner", model="./models/roberta-base-finetuned-cluener2020-chinese")
print(ner("我爱北京天安门，吴彦祖在天安门当保安"))
# [{'entity':'B-address','word':'北'}, {'entity':'I-address','word':'京'}, ...,
#  {'entity':'B-position','word':'保'}, {'entity':'I-position','word':'安'}]
```

NER 的标签规则是 **BIO 编码**：

| 标签 | 含义 |
|---|---|
| `B-xxx` | 实体的**开始**（Begin） |
| `I-xxx` | 实体的**内部**（Inside） |
| `O` | 不属于任何实体（Outside） |

> 看到 `B-address 北` + `I-address 京` + `I-address 天` + …，就知道"北京天安门"被识别成了一个地址实体。

## 四、初识：从 BERT 到大模型——这条线怎么走

```text
2017 Transformer（注意力机制）
  ├─ 2018 BERT：Encoder 路线 → 理解任务 + embedding
  ├─ 2018 GPT-1：Decoder 路线 → 生成
  ├─ 2020 GPT-3：参数暴涨 → 涌现能力（few-shot）
  └─ 2022 ChatGPT / 之后：RLHF 对齐 → 对话助手
```

> 你现在学的每一个概念（词向量 → 预训练 → 微调 → 注意力），都是这条线上的一个节点。等后面写 RAG 项目时，会看到这些概念怎么拼成一个真实系统。

## 五、总结

### 5.1 要点回顾

1. **迁移学习 = 预训练（通才）+ 微调（专才）**，解决了"每个任务从零训练"的痛点
2. BERT 三要素：**双向 Transformer、`[CLS]`/`[SEP]`、MLM+NSP 预训练任务**
3. **BERT（Encoder，会读）vs GPT（Decoder，会写）**——今天的大模型是 GPT 路线，RAG 的 embedding 是 BERT 系
4. transformers 三种用法：`pipeline`（快速）→ `AutoModel`（灵活）→ 指定模型类（精细）
5. `feature-extraction` 输出 `(1, 16, 768)` = 样本数 × token 数 × 向量维度——**RAG 的 embedding 就是它**
6. NER 用 **BIO 编码**：B-实体开始、I-实体内部、O-非实体

### 5.2 自测清单

<details>
<summary>Q1：预训练和微调分别做什么？</summary>

预训练：在海量无标注语料上学通用语言能力（自监督任务）；微调：在少量标注数据上适配具体任务。
</details>

<details>
<summary>Q2：BERT 的 [CLS] 和 [SEP] 有什么用？</summary>

[CLS] 放在句首，其输出向量聚合整句语义，常用于分类；[SEP] 用于分隔句子（如句对任务）。
</details>

<details>
<summary>Q3：BERT 和 GPT 最本质的区别？</summary>

结构和训练目标：BERT 是双向 Encoder + 完形填空（擅长理解）；GPT 是单向 Decoder + 预测下一个词（擅长生成）。
</details>

<details>
<summary>Q4：feature-extraction 输出的 (1, 16, 768) 各是什么？</summary>

1 个样本、16 个 token（含 [CLS]/[SEP]）、每个 token 768 维向量。
</details>

### 5.3 面试视角（🔥 必背）

| 面试问法 | 答题要点 |
|---|---|
| 什么是预训练和微调？ | 海量无标注语料自监督预训练学通用表示；小规模标注数据微调适配任务 |
| BERT 的预训练任务？ | MLM（掩码语言模型）+ NSP（下一句预测） |
| BERT 和 GPT 的区别？ | Encoder 双向/理解 vs Decoder 单向/生成；MLM vs 自回归 |
| 为什么 BERT 适合做 embedding？ | 双向编码能融合上下文，[CLS] 向量或池化向量可作为句子表示 |
| 大模型微调有哪些方式？ | 全参微调、LoRA/QLoRA（低秩适配）、Prompt/Prefix Tuning |
| RAG 里 embedding 模型怎么选？ | 看中文效果（bge-m3 等）、向量维度/性能、是否支持长文本 |

### 5.4 模块小结：NLP 基础 6 篇完结

| 篇目 | 一句话 |
|---|---|
| nlp-00 NLP 入门 | NLU/NLG + 四步流水线 |
| nlp-01 文本预处理 | jieba 分词 + 词性 + one-hot |
| nlp-02 词向量 🔥 | CBOW/Skip-gram、fasttext、静态 vs 上下文 embedding |
| nlp-03 文本分类 | fasttext 实战 + 数据探索 + 多标签 |
| nlp-04 RNN 家族 | ngram → RNN → LSTM/GRU → 为什么被 Transformer 取代 |
| nlp-05 BERT 🔥 | 预训练范式 + transformers 三种用法 + RAG embedding 来源 |

下一个模块：**应用篇 / 提示词工程**——从"训练模型"转向"使用大模型"，把 Prompt 写明白。

---

*本文对应素材：`03_NLP基础/01-课件/05-迁移学习(上).pptx`、`06-迁移学习(下).pptx`、`02-代码/day05`*
