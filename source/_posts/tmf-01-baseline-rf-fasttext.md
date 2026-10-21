---
title: 基线方案：随机森林与 fasttext
date: 2026-10-23 09:30:00
categories:
  - 项目篇
  - 投满分 NLP 项目
tags:
  - 随机森林
  - fasttext
  - TF-IDF
  - 文本分类
description: 两个简单但能打的基线——随机森林靠 TF-IDF 词袋，fasttext 靠词向量平均，跑得飞快
mathjax: true
---

> **一句话概括**：先立基线再优化——随机森林和 fasttext 这两条"便宜路线"，往往能在几分钟内给你一个及格线成绩。
> **这篇有多重要**：📌 —— 面试讲"从简到繁"的起点；也说明你懂得"先有基线再谈优化"的工程习惯。
> **前置知识**：ml-05 的随机森林、nlp-03 的 fasttext 分类
> **对应素材**：`tmf/01课件/07-markdown/day02_RandomForest和fasttext模型.md`

## 一、初识：为什么先做基线

新手常犯的错：一上来就上 BERT、上大模型，跑一天出结果——但不知道"这个结果算好还是坏"。

**基线的价值**：

| 作用 | 说明 |
|---|---|
| **及格线** | 后面的方案必须显著超过它，否则没意义 |
| **成本参照** | 基线只要几秒训练，效果差 5 个点但成本差 100 倍——这就是选型依据 |
| **排查工具** | 如果 BERT 还不如基线，说明数据或流程有问题 |

> 这个项目里，随机森林和 fasttext 就是基线。

## 二、运用：随机森林做文本分类

### 2.1 思路

文本不能直接喂树模型——先转成**数值特征**，最常用的是 **TF-IDF**（词频-逆文档频率）。

```text
文本 → 分词 → TF-IDF 向量（几万维稀疏向量）→ 随机森林 → 类别
```

TF-IDF 直觉：

| 词 | 在本文档出现多 | 在语料中很常见 | TF-IDF 值 |
|---|---|---|---|
| "军事" | 是 | 不常见 | **高**（有区分度） |
| "的" | 是 | 到处都是 | 低（没区分度） |

### 2.2 代码骨架

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report

# 1. 特征：TF-IDF
vectorizer = TfidfVectorizer(max_features=20000, ngram_range=(1, 2))
X_train = vectorizer.fit_transform(train_texts)
X_test = vectorizer.transform(test_texts)      # 注意：只 transform

# 2. 模型
rf = RandomForestClassifier(
    n_estimators=200,      # 树的数量
    max_depth=None,        # 不限制（也可限制防过拟合）
    n_jobs=-1,             # 全部核心并行
    random_state=42,
)
rf.fit(X_train, train_labels)

# 3. 评估
pred = rf.predict(X_test)
print(classification_report(test_labels, pred, digits=4))
```

### 2.3 随机森林的优缺点（文本分类场景）

| 优点 | 缺点 |
|---|---|
| 训练快、可并行 | 高维稀疏特征下效果一般 |
| 对参数不敏感 | 不懂词序和语义（"不好"和"好"在词袋里是两个词） |
| 可解释（特征重要性） | 维度几万时推理也不慢但内存占用高 |

> 📌 面试点：**词袋模型的根本缺陷是"丢了语序和语义"**——这也是后面 fasttext / BERT 要解决的问题。

## 三、运用：fasttext 做文本分类

### 3.1 思路

fasttext 把一句话里所有词的向量**求平均**，接一个线性分类器：

```text
文本 → 分词 → 词向量平均 → 线性分类器 → 类别
```

它比 TF-IDF + 随机森林多了一层"词向量"——相似词在向量空间里靠近，泛化能力更好一点。

### 3.2 代码骨架

```python
import fasttext

# 数据格式：__label__类别 文本（每行一条）
# __label__军事 二战期间的战术分析
# __label__美妆 新款面霜的成分

model = fasttext.train_supervised(
    input="train.txt",
    epoch=25,          # 轮数（默认 5，太小）
    lr=0.5,            # 学习率
    wordNgrams=2,      # 二元词组特征（补一点语序信息）
    dim=100,           # 词向量维度
    loss="softmax",    # 多分类用 softmax
    thread=8,          # 多线程
)

# 评估
print(model.test("test.txt"))   # (样本数, P@1, R@1)

# 预测
labels, probs = model.predict("新款面霜适合敏感肌吗")
```

### 3.3 fasttext 的关键优势

| 优势 | 说明 |
|---|---|
| **极快** | 训练分钟级、预测毫秒级（比 BERT 快 10~100 倍） |
| 内存小 | 模型几十 MB |
| 支持子词 | subword 能处理未登录词（错别字、新词） |
| 简单可靠 | 调参少，不容易翻车 |

> 🔥 **这是线上大规模分类的常用选择**——比如每天几百万条内容要分类，BERT 成本太高，fasttext 是务实之选。

## 四、初识：两个基线的对比（项目里的真实数据视角）

| 维度 | 随机森林 + TF-IDF | fasttext |
|---|---|---|
| 训练时间 | 分钟级 | 秒~分钟级 |
| 推理速度 | 快 | **极快** |
| 文本表示 | 稀疏词袋（几万维） | 稠密词向量平均（100 维） |
| 语序信息 | 无（可用 ngram 部分补） | 无（可用 wordNgrams 部分补） |
| 准确率 | 基线水平 | 通常略高于 RF |
| 模型体积 | 大（树 + 特征） | 小 |

> 💡 结论：**fasttext 在"文本分类"这个任务上通常全面优于 TF-IDF + 随机森林**——更快、更小、效果更好。随机森林的价值更多是"练手 + 对比"。

## 五、运用：这两个方案教会我们什么

| 经验 | 说明 |
|---|---|
| **先跑通再优化** | 基线几小时就能跑通，先有结果再谈提升 |
| **特征决定上限** | 词袋丢语序语义——这是后面换方案的根本原因 |
| **成本是硬指标** | fasttext 用 1% 的成本拿到 90% 的效果，工程上很有吸引力 |
| **数据比模型重要** | 基线效果差时，先看数据（标注、分布、噪声）而不是急着换模型 |

## 六、总结

### 6.1 要点回顾

1. 基线的价值：及格线、成本参照、排查工具
2. 随机森林方案：**TF-IDF 稀疏特征 + 树模型**；快但不懂语序语义
3. fasttext 方案：**词向量平均 + 线性分类器**；极快、体积小、支持子词
4. 两者都缺"语序与语义"——这是换 BERT 的根本动机
5. 工程结论：**fasttext 通常全面优于 TF-IDF+RF**，是低成本场景的务实选择

### 6.2 自测清单

<details>
<summary>Q1：TF-IDF 的直觉是什么？</summary>

一个词在本文档出现越多、在整个语料越罕见，它的区分度越高（权重越大）；常见词（如"的"）权重低。
</details>

<details>
<summary>Q2：fasttext 为什么这么快？</summary>

结构极简（词向量平均 + 线性层），C++ 实现、多线程；没有注意力等重计算。
</details>

<details>
<summary>Q3：词袋模型的最大缺陷？</summary>

丢失语序与语义："不好"与"好"在词袋里是两个独立特征，模型无法理解否定；同义表达也无法泛化。
</details>

### 6.3 面试视角（📌）

| 面试问法 | 答题要点 |
|---|---|
| 文本分类有哪些传统方法？ | TF-IDF + 朴素贝叶斯/SVM/随机森林；词向量 + fasttext/TextCNN |
| 为什么 fasttext 快？ | 词向量平均 + 线性分类，C++ 多线程，无重计算 |
| 基线方案的意义？ | 提供对比与成本参照；先跑通再优化 |
| 词袋模型的缺陷？ | 丢语序、丢语义，无法处理否定与同义表达 |

### 6.4 下一步

基线有了，该上"真正的武器"了——**BERT 微调**：预训练模型如何把效果拉上一个台阶。

---

*本文对应素材：`tmf/01课件/07-markdown/day02_RandomForest和fasttext模型.md`*
