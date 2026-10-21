---
title: RNN 家族：从 ngram 到 LSTM / GRU
date: 2026-10-21 15:00:00
categories:
  - 基础篇
  - NLP 基础
tags:
  - ngram
  - RNN
  - LSTM
  - GRU
description: 统计语言模型 ngram 的局限、PyTorch 里 RNN/LSTM/GRU 的用法与形状——以及为什么它们最终被 Transformer 取代
mathjax: true
---

> **一句话概括**：从"数词频"的 ngram 到"带记忆"的 RNN，再到会"选择性记忆"的 LSTM/GRU——序列建模的三级进化。
> **这篇有多重要**：📌 —— 原理在深度学习模块（dl-07）讲过，这里补上代码实战与 ngram 这条历史线；面试问"LSTM 原理""RNN 缺点"时会用上。
> **前置知识**：dl-07 的 RNN/词嵌入、nlp-02 的词向量
> **对应素材**：`04-RNN及其变体.pptx`、`02-代码/day03`（ngram / RNN / LSTM / GRU）

## 一、初识：语言模型——判断"这句话像不像人话"

NLP 里有个基础任务叫**语言模型（Language Model）**：给一句话，算它出现的概率。概率高 = "像人话"。

怎么算？链式法则：

$$P(w_1, w_2, \dots, w_n) = P(w_1) \cdot P(w_2|w_1) \cdot \dots \cdot P(w_n|w_1 \dots w_{n-1})$$

问题是：要算 $P(w_n | 前面所有词)$，得统计天文数字的语料。于是有了简化假设——

## 二、初识：ngram——只看前 n-1 个词

**n-gram 假设**：一个词出现的概率，只和它前面 n-1 个词有关。

| 类型 | 看几个词 | 例子 |
|---|---|---|
| unigram (n=1) | 不看上下文 | "我/爱/北京" 各自独立 |
| bigram (n=2) | 看前 1 个 | P(爱\|我)、P(北京\|爱) |
| trigram (n=3) | 看前 2 个 | P(北京\|我,爱) |

### 2.1 代码：bigram 样本怎么造

```python
sentence = "我 爱 北京 天安门"

words = sentence.split()
# 特征：前一个词；标签：下一个词
samples = list(zip(words[:-1], words[1:]))
print(samples)
# [('我','爱'), ('爱','北京'), ('北京','天安门')]
```

> 这就是语言模型的训练样本：**用前 n-1 个词预测第 n 个词**——和今天大模型的"预测下一个 token"本质完全一样，只是 ngram 只看很短的历史。

### 2.2 ngram 的两个硬伤

| 硬伤 | 说明 |
|---|---|
| **上下文太短** | 只看前 2 个词，"我 昨天 在 巴黎 吃 的 那个 甜点……" 后面的"好吃"就接不上了 |
| **数据稀疏** | trigram 的组合数量爆炸，很多组合在语料里从没出现过（概率为 0） |

**解法**：让模型自己"记住"任意长的历史——这就是 RNN。

## 三、初识：RNN → LSTM → GRU（一段进化史）

| 阶段 | 机制 | 问题 |
|---|---|---|
| **RNN** | 隐藏状态沿时间步传递（带记忆） | 长序列梯度消失，记不住远处 |
| **LSTM** | 三门（遗忘/输入/输出）+ 细胞状态 | 参数多、计算慢 |
| **GRU** | 两门（重置/更新），LSTM 简化版 | 略逊精度但更快 |

> 一句话理解门控：**LSTM 像有"记忆管理秘书"——决定忘什么（遗忘门）、记什么（输入门）、说什么（输出门）**。

## 四、运用：PyTorch 三件套的用法

三个 API 长得几乎一样，参数含义相同：

```python
import torch
import torch.nn as nn

# input_size：每个词的向量维度；hidden_size：隐藏状态维度；batch_first：输入形状 (batch, seq, dim)
rnn  = nn.RNN(input_size=128, hidden_size=256, num_layers=1, batch_first=True)
lstm = nn.LSTM(input_size=128, hidden_size=256, num_layers=1, batch_first=True)
gru  = nn.GRU(input_size=128, hidden_size=256, num_layers=1, batch_first=True)

x = torch.randn(16, 10, 128)      # 16 个样本、每条 10 个词、每词 128 维

out, hidden = rnn(x)
print(out.shape)       # [16, 10, 256] 每个时间步的输出
print(hidden.shape)    # [1, 16, 256]  最后一步的隐藏状态（记忆摘要）
```

### 4.1 LSTM 的 hidden 是元组

```python
out, (h_n, c_n) = lstm(x)      # LSTM 返回 (隐藏状态, 细胞状态)
print(h_n.shape, c_n.shape)    # [1,16,256] [1,16,256]
```

> LSTM 比 RNN 多一个 **细胞状态 c**（长期记忆），h 是短期输出。

### 4.2 多层与双向

```python
# num_layers=2：堆两层（加深）
# bidirectional=True：双向（同时看左右上下文，BERT 的思想雏形）
lstm = nn.LSTM(128, 256, num_layers=2, batch_first=True, bidirectional=True)
out, _ = lstm(x)
print(out.shape)   # [16, 10, 512] —— 双向拼接后 256×2
```

## 五、运用：文本长度处理——padding 与截断

真实文本长短不一，但张量必须是矩形。做法：

```python
# 目标长度 20
max_len = 20

def pad_or_truncate(ids, max_len=20, pad_id=0):
    if len(ids) >= max_len:
        return ids[:max_len]           # 截断
    return ids + [pad_id] * (max_len - len(ids))   # 补 0

print(pad_or_truncate([5, 2, 9]))          # [5, 2, 9, 0, 0, ...]
```

工业级做法用 `torch.nn.utils.rnn.pad_sequence` 或 tokenizer 的 `padding=True, truncation=True`（nlp-05 会看到）。

> ⚠️ padding 会引入大量 0，注意对损失计算的影响（用 mask 把 padding 位置排除）。

## 六、初识：RNN 的终局——为什么被 Transformer 取代

RNN 家族有两个绕不过去的死穴：

| 死穴 | 说明 |
|---|---|
| **无法并行** | 时间步是串行的，第 100 步必须等第 99 步算完——GPU 再强也用不上 |
| **长依赖仍有限** | LSTM 缓解了梯度消失，但面对几千 token 的文档仍然力不从心 |

2017 年 Transformer 用**自注意力机制**同时解决了两点：任意两个位置直接建立联系（无距离衰减）、所有位置可以并行计算。

> 这就是为什么 2017 年之后 NLP 全面转向 Transformer——BERT（nlp-05）是它的 Encoder，GPT 是它的 Decoder。

## 七、总结

### 7.1 要点回顾

1. **ngram**：用前 n-1 个词预测下一个词（统计方法），硬伤是**上下文短 + 数据稀疏**
2. **RNN**：隐藏状态沿时间步传递，有了"记忆"，但长序列梯度消失
3. **LSTM**：三门 + 细胞状态，选择性记忆；**GRU**：两门的简化版
4. PyTorch 三件套用法一致，形状 `(batch, seq_len, hidden)`；LSTM 的 hidden 是 `(h, c)` 元组
5. 文本要 **padding / 截断** 到统一长度才能成批训练
6. RNN 的终局：**无法并行 + 长依赖有限** → 被 Transformer 取代

### 7.2 自测清单

<details>
<summary>Q1：ngram 的核心假设和缺点？</summary>

假设：一个词只与前面的 n-1 个词有关。缺点：上下文窗口太短、数据稀疏（很多组合没出现过）。
</details>

<details>
<summary>Q2：LSTM 相比 RNN 多了什么？</summary>

多了细胞状态 c 和三个门（遗忘门/输入门/输出门），可以学习"忘记哪些旧信息、写入哪些新信息"，缓解长依赖问题。
</details>

<details>
<summary>Q3：为什么 RNN 不能并行？</summary>

隐藏状态 h_t 依赖 h_{t-1}，必须按时间步串行计算，无法同时处理所有位置。
</details>

<details>
<summary>Q4：Transformer 为什么能取代 RNN？</summary>

自注意力让任意位置两两直接交互（不受距离限制），且可完全并行计算，训练效率高得多。
</details>

### 7.3 面试视角（📌）

| 面试问法 | 答题要点 |
|---|---|
| RNN/LSTM/GRU 的区别？ | 单门 vs 三门+细胞状态 vs 两门；LSTM 记忆能力强但慢，GRU 折中 |
| LSTM 的门控机制？ | 遗忘门筛掉旧信息、输入门写入新信息、输出门决定输出；细胞状态是长期记忆通道 |
| RNN 为什么梯度消失？ | 反向传播沿时间步连乘，梯度小于 1 时指数衰减 |
| 为什么大模型用 Transformer 不用 RNN？ | 可并行、长距离依赖强、易于扩展到超大规模参数 |
| 双向 RNN 的原理？ | 两个方向分别处理序列再拼接，能同时利用左右上下文（但只适合非生成任务） |

### 7.4 下一步

RNN 时代结束，NLP 进入"预训练"时代。最后一篇：**BERT 与迁移学习**——今天所有大模型的起点。

---

*本文对应素材：`03_NLP基础/01-课件/04-RNN及其变体.pptx`、`02-代码/day03/03-ngram代码实现.py`、`05-传统RNN代码实现.py`、`07-LSTM的代码实现.py`、`08-GRU的代码实现.py`*
