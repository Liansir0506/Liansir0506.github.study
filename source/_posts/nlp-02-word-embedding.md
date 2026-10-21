---
title: 词向量实战：从 one-hot 到 word2vec
date: 2026-10-21 14:00:00
categories:
  - 基础篇
  - NLP 基础
tags:
  - 词向量
  - word2vec
  - CBOW
  - Skip-gram
  - fasttext
description: CBOW 和 Skip-gram 怎么训练出词向量、fasttext 怎么用、怎么验证"语义相近"——RAG 向量检索从这篇开始
mathjax: true
---

> **一句话概括**：用神经网络"顺便"学出来的权重，就是词向量——语义相近的词，向量距离也近。
> **这篇有多重要**：🔥🔥 —— **RAG 的向量检索就建立在这个概念上**。理解词向量，才理解"embedding 模型"在干什么、为什么"语义搜索"能工作。
> **前置知识**：nlp-01 的 one-hot、dl-01 的张量、dl-07 的 Embedding 概念
> **对应素材**：`02-代码/day02/01-word2vec代码实现fasttext.py`、`02-word_embedding可视化.py`、`02/03-文本预处理课件`、`03-笔记/day01.md`（CBOW/Skip-gram 部分）

## 一、初识：为什么要"稠密"向量

nlp-01 的结论：one-hot 有两个硬伤——**维度爆炸**、**语义为零**。

理想中的词向量应该长这样：

- **低维稠密**：100 维、每维都是有效数字
- **语义相近 = 距离相近**：猫和狗挨着，猫和汽车离得远
- **可运算**：甚至可以"国王 − 男人 + 女人 ≈ 女王"

word2vec 就是干这件事的。

## 二、初识：word2vec 的两种训练模式

### 2.1 核心思想：用"预测邻居"来学向量

word2vec 不直接定义"什么是词义"，而是设计一个**代理任务**：

> **根据上下文预测词，或者根据词预测上下文。**

训练一个只有一个隐藏层的神经网络，训练完成后——**隐藏层的权重，就是这个词的向量**。

为什么能学到语义？因为"常出现在相似上下文里的词，意思往往相近"（分布假设）。模型为了预测得准，被迫让相似词的向量也相似。

### 2.2 CBOW vs Skip-gram

| 模式 | 输入 → 输出 | 一句话 |
|---|---|---|
| **CBOW** | 上下文（左右几个词）→ 预测**中间词** | "挖空填词" |
| **Skip-gram** | 中间词 → 预测**上下文** | "一个词能推出邻居是谁" |

用笔记里的话：

- CBOW：给我上一个词的稀疏向量和下一个词的稀疏向量，经过前向传播，得到中间词的预测值；算损失、反向传播、更新 W——**最终用 W 表示词的向量**
- Skip-gram：给我一个词，预测它左边和右边会是什么词

> 📌 实际效果：**Skip-gram 对低频词更友好**，CBOW 训练更快。fasttext 默认用 Skip-gram。

## 三、运用：用 fasttext 训练词向量

fasttext 是 Facebook 出的工具（C++ 实现，快），既能训词向量也能做文本分类。

### 3.1 训练一个词向量模型

```python
import fasttext

# 方式一：无监督训练词向量（默认 skipgram）
model = fasttext.train_unsupervised(
    "./data/wh02aa",     # 纯文本语料（一行一句）
    model="cbow",        # 模式：cbow / skipgram（默认 skipgram）
    lr=0.01,             # 学习率
    dim=50,              # 向量维度（常见 50~300）
    epoch=10,            # 训练轮数
    thread=10            # 线程数
)

model.save_model("./model/wh02aa_new.model")   # 保存
```

也可以用 `train_supervised`（有监督，用标签数据训），参数类似。

### 3.2 三个验证方式

```python
model = fasttext.load_model("./model/wh02aa_new.model")

# 1. 查看某个词的向量
vec = model.get_word_vector("china")
print(vec.shape)          # (50,) —— 词向量的维度

# 2. 找语义近邻（最能证明"词向量学到了语义"）
print(model.get_nearest_neighbors("two"))
# [(0.87, 'three'), (0.81, 'four'), (0.79, 'one'), ...]
# 数值是余弦相似度，越高越近
```

> 💡 看到 `two` 的近邻是 `three`、`four`、`one`——说明模型从纯文本里自动学到了"数字词会出现在相似上下文"的规律。这就是词向量的意义。

### 3.3 可视化：把词向量画出来

```python
import matplotlib.pyplot as plt
from sklearn.manifold import TSNE

words = ["one", "two", "three", "cat", "dog", "china", "america"]
vectors = [model.get_word_vector(w) for w in words]

# t-SNE 把 50 维压到 2 维（只是为了能画图）
coords = TSNE(n_components=2, random_state=42).fit_transform(vectors)

plt.scatter(coords[:, 0], coords[:, 1])
for (x, y), w in zip(coords, words):
    plt.annotate(w, (x, y))
plt.title("词向量可视化（t-SNE 降维）")
plt.show()
```

> 画出来通常能看到：数字词（one/two/three）聚一起、动物词（cat/dog）聚一起、国家词聚一起——**语义相近的词在向量空间里也靠近**。

## 四、初识：两种 embedding，别搞混

| 类型 | 来源 | 特点 | 用在哪 |
|---|---|---|---|
| **静态词向量** | word2vec / fasttext / GloVe 预训练 | 训练好就固定，同一个词永远同一个向量 | 传统 NLP、小模型 |
| **动态 embedding** | `nn.Embedding`（随任务一起训练） | 每个任务的向量不同，可学习 | 深度学习模型内部 |
| **上下文相关 embedding** | BERT / 大模型 encoder | 同一个词在不同句子里向量不同 | RAG、语义检索（现代做法） |

> 🔥 **RAG 里用的是第三种**：文档块送进 embedding 模型（通常是 BERT 系列），输出一个向量存进向量库。下一篇（nlp-05）会亲手跑一遍 BERT 特征提取，看到 `(1, 16, 768)` 的输出形状。

## 五、总结

### 5.1 要点回顾

1. 词向量解决 one-hot 的两大问题：**稠密低维 + 语义相近**
2. word2vec 用"预测邻居"的代理任务训练，**权重即为词向量**
3. **CBOW**：上下文预测中间词；**Skip-gram**：中间词预测上下文（低频词更友好）
4. fasttext 三件套：`train_unsupervised`（训词向量）/ `get_word_vector`（取向量）/ `get_nearest_neighbors`（找近邻）
5. 三种 embedding 要对号入座：静态（word2vec）、动态（nn.Embedding）、上下文相关（BERT）——**RAG 用的是 BERT 这类**

### 5.2 自测清单

<details>
<summary>Q1：word2vec 为什么能学到语义？</summary>

基于分布假设：常出现在相似上下文中的词，语义往往相近。训练目标逼着模型把相似词映射到相近的向量位置。
</details>

<details>
<summary>Q2：CBOW 和 Skip-gram 的区别？</summary>

CBOW 用上下文预测中心词（快）；Skip-gram 用中心词预测上下文（低频词效果更好）。
</details>

<details>
<summary>Q3：怎么验证词向量质量？</summary>

相似词检索（get_nearest_neighbors 看近邻是否语义相近）、类比任务（国王−男人+女人≈女王）、下游任务效果。
</details>

<details>
<summary>Q4：静态词向量和上下文 embedding 的区别？</summary>

静态：一个词只有一个固定向量，无法处理多义词（"苹果"永远是同一个向量）；上下文 embedding（如 BERT）：同一个词在不同句子里向量不同。
</details>

### 5.3 面试视角（🔥）

| 面试问法 | 答题要点 |
|---|---|
| word2vec 的原理？ | 用"预测上下文/中心词"的代理任务训练浅层网络，隐藏层权重即词向量 |
| CBOW vs Skip-gram？ | 上下文→中心（快） vs 中心→上下文（低频词好） |
| 词向量怎么评估？ | 相似度检索、类比任务、下游任务表现 |
| one-hot、word2vec、BERT embedding 的关系？ | 稀疏无义 → 稠密静态（有语义）→ 稠密动态上下文相关（解决多义词） |
| fasttext 相比 word2vec 的优势？ | 引入子词（subword）信息，能处理未登录词（OOV） |

### 5.4 下一步

有了词向量，就可以做最落地的 NLP 任务了：**文本分类**——用 fasttext 训练一个情感分类器，顺便看怎么写一个完整的 NLP 项目。

---

*本文对应素材：`03_NLP基础/02-代码/day02/01-word2vec代码实现fasttext.py`、`02-word_embedding可视化.py`、`03-笔记/day01.md`*
