---
title: 文本分类实战：fasttext 情感分析
date: 2026-10-21 14:30:00
categories:
  - 基础篇
  - NLP 基础
tags:
  - 文本分类
  - fasttext
  - 情感分析
  - 多标签分类
description: 从数据探索到训练调参、多标签处理、模型评估——用 fasttext 完整走一遍文本分类项目
mathjax: true
---

> **一句话概括**：fasttext 把词向量平均一下、接个线性分类器——简单粗暴但极快，是文本分类的"性价比之王"。
> **这篇有多重要**：📌 —— 文本分类是 NLP 最常见的落地任务，面试常问"文本分类怎么做、有哪些方案"；这个案例也补上了数据探索、多标签、评估口径这些工程细节。
> **前置知识**：nlp-02 的词向量（fasttext 的底子）、ml-03 的评估指标（P/R/F1）
> **对应素材**：`02-代码/day04/02-fasttext文本分类实现.py`、`day02/03-06`（数据探索与词云）、`03-文本预处理-下.pptx`

## 一、初识：fasttext 凭什么"快"

fasttext 做分类的思路极其简单：

1. 把句子里每个词的词向量**求平均**，得到整句的向量
2. 接一个**线性分类器**（softmax）
3. 训练（同时也在训练词向量）

对比 BERT 那种上亿参数的模型，fasttext 只有几百万参数、训练几分钟——**在"数据量大、要求快"的场景（如广告分类、垃圾过滤）里，它往往是第一选择**。

| 维度 | fasttext | BERT 微调 |
|---|---|---|
| 速度 | 极快（CPU 即可） | 慢（需 GPU） |
| 效果 | 一般（中上） | 好（SOTA） |
| 数据需求 | 大 | 中等（可微调） |
| 适用 | 海量数据粗分类、基线 | 追求效果的任务 |

## 二、运用：数据准备与探索

### 2.1 数据格式

fasttext 要求一种特殊格式：**每行 = 一个样本，标签以 `__label__` 开头，后面跟文本**：

```text
__label__sauce How much does potato starch affect a cheese sauce recipe?
__label__cheese Regulation and balancing of readymade packed mayonnaise
```

数据准备通常是："原始数据（csv/txt）→ 清洗 → 转成这个格式 → 训练/验证集切分"。

### 2.2 先别急着训练：做数据探索

一个靠谱的 NLP 项目，**30% 的时间花在看数据上**。要看什么：

```python
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv("train.tsv", sep="\t")

# 1. 标签分布：正负样本均衡吗？（不均衡会影响指标判断）
print(df["label"].value_counts())

# 2. 句子长度分布：有没有超长文本要截断？
df["len"] = df["text"].apply(len)
print(df["len"].describe())
plt.hist(df["len"], bins=50); plt.xlabel("句子长度"); plt.title("长度分布"); plt.show()

# 3. 正负样本的长度是否差异明显（有时长度本身就是强特征）
print(df.groupby("label")["len"].mean())

# 4. 词云：直观看看高频词
from wordcloud import WordCloud
text = " ".join(df["text"].tolist())
wc = WordCloud(font_path="SimHei.ttf", width=800, height=400).generate(text)
plt.imshow(wc); plt.axis("off"); plt.show()
```

> 💡 这些分析看起来"不算法"，但能提前发现坑：标签不均衡（准确率会骗人）、长度分布异常（可能需要截断）、数据脏（需要清洗）。

## 三、运用：训练与调参

### 3.1 最简训练

```python
import fasttext

model = fasttext.train_supervised("./data/cooking.pre.train")
result = model.test("./data/cooking.pre.valid")
print(result)   # (3000, 0.169, 0.0731) —— (样本数, P@1, R@1)
```

`test()` 返回三元组：**样本数、P@1（前 1 个预测命中的精确率）、R@1（召回率）**。

> 结果只有 0.169？——正常。默认参数训练不够，接下来一步步调。

### 3.2 五个调参旋钮（效果从 0.169 → 0.59）

| 参数 | 作用 | 实验值 |
|---|---|---|
| `epoch` | 训练轮数 | 30（默认只有 5） |
| `lr` | 学习率 | 0.3 |
| `wordNgrams` | 用 n-gram 特征捕捉词序 | 2 |
| `loss` | 损失函数：`ns`（负采样）/ `hs`（层次 softmax）/ `ova`（多标签） | hs / ova |
| `dim` | 词向量维度 | 50~100 |

```python
model = fasttext.train_supervised(
    "./data/cooking.pre.train",
    epoch=30,          # 多训几轮
    lr=0.3,            # 学习率调大
    wordNgrams=2,      # 加入二元词组特征
    loss="hs"
)
print(model.test("./data/cooking.pre.valid"))   # P@1 ≈ 0.57
```

> 📌 `wordNgrams=2` 很关键：它把"两个相邻词"也当成特征，等于让模型能感知一点词序（"不 好吃" vs "很 好吃"）。

### 3.3 自动调参

懒得手调？fasttext 提供了 autotune（给定验证集和时间预算，自动搜索）：

```python
model = fasttext.train_supervised(
    "./data/cooking.pre.train",
    autotuneValidationFile="./data/cooking.pre.valid",
    autotuneDuration=300     # 搜索 5 分钟
)
```

## 四、运用：多标签分类

真实场景里，一条文本可能同时属于多个类别（一道菜既是"酱料"又是"奶酪"）。fasttext 的处理：

```python
model = fasttext.train_supervised(
    "./data/cooking.pre.train",
    epoch=30, lr=0.2, wordNgrams=2,
    loss="ova"       # one-vs-all：每个标签独立判断
)

# 预测时控制"要几个标签"或"概率阈值"
model.predict("How much does potato starch affect a cheese sauce recipe?", k=2, threshold=0.5)
# k=2            → 最多返回 2 个标签
# threshold=0.5  → 概率低于 0.5 的不要
# k=-1           → 返回所有超过阈值的标签
```

> 多标签的评估和单标签不同：不能只看"是否命中一个"，要看每个标签的 P/R/F1（用 sklearn 的 `classification_report` 或 `hamming_loss` 更合适）。

## 五、运用：保存、加载与预测

```python
model.save_model("./model/cooking.model")        # 保存（一个二进制文件，很小）

model = fasttext.load_model("./model/cooking.model")   # 加载
result = model.predict("Regulation and balancing of mayonnaise", k=2, threshold=0.5)
print(result)
# (('__label__sauce', '__label__cheese'), array([0.62, 0.51]))
```

## 六、总结

### 6.1 要点回顾

1. fasttext = **词向量平均 + 线性分类器**，主打"快"，适合海量数据和大规模粗分类
2. 数据格式：`__label__标签 文本`，一行一条
3. 训练前先做**数据探索**：标签分布、长度分布、词云——提前发现数据坑
4. 五个调参旋钮：**epoch / lr / wordNgrams / loss / dim**，P@1 从 0.17 调到 0.57
5. 多标签用 `loss='ova'` + `k` / `threshold` 控制返回结果
6. `test()` 返回 `(样本数, P@1, R@1)`

### 6.2 自测清单

<details>
<summary>Q1：fasttext 为什么快？</summary>

模型结构极简（词向量平均 + 线性层），参数少；C++ 实现 + 多线程；没有 Transformer 的注意力计算。
</details>

<details>
<summary>Q2：wordNgrams 参数有什么用？</summary>

把相邻的 n 个词组合成新特征，让模型能感知词序信息（如"不 好吃"这种组合），一般设 2 就能明显提分。
</details>

<details>
<summary>Q3：test() 返回的三个数字是什么？</summary>

(样本数, P@1 精确率, R@1 召回率)。P@1 表示预测概率最高的标签命中真实标签的比例。
</details>

<details>
<summary>Q4：多标签和单标签分类有什么区别？</summary>

单标签：每个样本只属于一个类别（用 softmax）；多标签：样本可同时属于多个类别（用 ova/sigmoid，每个标签独立判断）。
</details>

### 6.3 面试视角（📌）

| 面试问法 | 答题要点 |
|---|---|
| 文本分类有哪些方案？ | 传统：TF-IDF + 朴素贝叶斯/SVM；词向量 + fasttext；深度学习：TextCNN/LSTM；预训练：BERT 微调 |
| fasttext 的原理？ | 词向量平均 + 线性分类器，训练快，适合大规模数据 |
| 文本分类项目怎么做？ | 数据探索与清洗 → 分词/预处理 → 划分数据集 → 训练 → 调参 → 评估（P/R/F1）→ 上线 |
| 样本不均衡怎么处理？ | 重采样（过采样/欠采样）、类别权重、F1 评估、阈值调整 |

### 6.4 下一步

fasttext 处理文本时把词序"平均"掉了，只能靠 ngram 粗糙补救。要真正建模"顺序"，得上序列模型：**RNN 家族**。

---

*本文对应素材：`03_NLP基础/02-代码/day04/02-fasttext文本分类实现.py`、`day02/03-获取标签数量分布.py`、`04-分析句子长度.py`、`06-词云的绘制.py`*
