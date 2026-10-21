---
title: 决策树：像人一样做判断
date: 2026-10-20 22:30:00
categories:
  - 基础篇
  - 机器学习
tags:
  - 决策树
  - one-hot编码
description: 从"银行批贷款"理解决策树的判断逻辑，讲清 Gini、剪枝、one-hot 编码，再用泰坦尼克号走一遍完整流程
mathjax: true
---

> **一句话概括**：把"如果…就…否则…"的判断过程画成一棵树，让模型学会像人一样一步步做决策。
> **这篇有多重要**：📌 —— 传统 ML 面试的重点（Gini、剪枝、为什么容易过拟合）；大模型岗位了解原理和场景即可。
> **前置知识**：ml-00 的建模流程、ml-03 的评估指标（这篇会用到分类报告）
> **对应素材**：`01_机器学习/03-笔记/day03.md` 后半、`day04.md` 前半、`01-课件/04_决策树.pptx`、`02-代码/day03/04-泰坦尼克号生存预测.py`

## 一、初识：其实就是"一串是 / 否问题"

### 1.1 从"批贷款"说起

想象你是银行信审员，来了一个客户，你怎么判断批不批？

大概率是这样一串判断：

- 月收入 > 2 万吗？
  - 是 → 有信用卡逾期吗？
    - 没有 → **批准**
    - 有 → **拒绝**
  - 否 → 有房产抵押吗？
    - 有 → **批准**
    - 没有 → **拒绝**

把这一串问题画出来，就是一棵倒过来的树——**决策树（Decision Tree）**。

### 1.2 树的结构就三个词

| 概念 | 含义 | 上面的例子 |
|---|---|---|
| **根节点** | 第一个判断 | 月收入 > 2 万吗？ |
| **内部节点** | 中间的判断 | 有逾期吗？有抵押吗？ |
| **叶节点** | 最终结论 | 批准 / 拒绝 |

### 1.3 树是怎么"长"出来的（三个关键问题）

决策树的训练过程，就是不断地问三个问题：

**① 每次怎么切？—— 强制二分**

- 分类问题：是 xxx / 不是 xxx
- 回归问题：x ≥ 阈值 / x < 阈值

不管特征有多少个取值，树的每一次分裂都是"一刀切两半"。

**② 哪个特征先切？—— 看谁切完更"纯"**

每次分裂，都希望切完之后的每个分支里，样本尽可能"清一色"。衡量"纯度"的工具有两个：

| 指标 | 用在哪 | 一句话 |
|---|---|---|
| **Gini 系数** | 分类 | 越小越纯；从一堆随机样本里抽两个，类别不一样的概率 |
| **信息增益（熵）** | 分类 | 切完之后"不确定性"减少得越多越好 |
| MSE | 回归 | 切完之后各组的误差平方和越小越好 |

> 📌 面试时不用背公式，能说清"**每次选让分支最纯的特征来切**"就够。

**③ 什么时候停？—— 剪枝**

树可以一直长下去，直到每个叶子只剩一个样本——但那样就**完美记住训练集**了，也就是过拟合。

所以必须给它"刹车"，常用三个参数：

| 参数 | 作用 |
|---|---|
| `max_depth` | 限制树的最大深度 |
| `min_samples_split` | 一个节点至少要有多少样本才允许继续分裂 |
| `min_samples_leaf` | 一个叶子节点至少要保留多少样本 |

### 1.4 为什么决策树特别容易过拟合

因为它**太自由**了：只要允许，它能把每个样本都单独分到一个叶子，训练集准确率 100%，但换个数据集就崩。

所以记住一句话：**剪枝不是可选项，是决策树的必需品。**

## 二、运用：从 CSV 到评估报告

### 2.1 基本用法

```python
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

# 分类
clf = DecisionTreeClassifier(max_depth=5, criterion="gini", random_state=42)

# 回归（同一棵树的逻辑，只是叶子输出平均值）
reg = DecisionTreeRegressor(max_depth=5)
```

### 2.2 类别特征怎么办：one-hot 编码

决策树只认数字。"性别 = male / female"没法直接算，需要拆成两列 0/1：

```python
import pandas as pd

# 性别一列 → 两列布尔值
x_new = pd.get_dummies(x)
```

转换效果：

| Sex_male | Sex_female |
|---|---|
| True | False |
| False | True |

> 这就是 **one-hot 编码**（独热编码）。除了树模型，逻辑回归、神经网络也都用它处理类别特征。

### 2.3 完整案例：泰坦尼克号生存预测

用 ml-00 的六步骨架走一遍：

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import classification_report

# 1. 准备数据
df = pd.read_csv("titanic_train.csv")

# 2. 数据清洗：选特征 + 补缺失值
x = df[["Pclass", "Age", "Sex"]].copy()   # copy 避免修改原数据的警告
y = df["Survived"]
x["Age"] = x["Age"].fillna(x["Age"].mean())   # 年龄缺失 → 填均值

# 3. 特征工程：one-hot 编码
x = pd.get_dummies(x)

# 4. 划分 + 训练
x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=42)
model = DecisionTreeClassifier(max_depth=5)
model.fit(x_train, y_train)

# 5. 预测
y_pred = model.predict(x_test)

# 6. 评估
print(classification_report(y_test, y_pred))
```

`classification_report` 会打出每个类别的精确率 / 召回率 / F1——这正是 ml-03 讲过的东西，这里终于用上了。

### 2.4 决策树也能做回归

同一个算法换个"叶子输出方式"就能做回归。波士顿房价（或任何连续值预测）：

```python
from sklearn.tree import DecisionTreeRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

reg = DecisionTreeRegressor(max_depth=5)
reg.fit(x_train, y_train)
y_pred = reg.predict(x_test)

print("MAE :", mean_absolute_error(y_test, y_pred))
print("MSE :", mean_squared_error(y_test, y_pred))
print("RMSE:", mean_squared_error(y_test, y_pred) ** 0.5)
```

### 2.5 💤 把树画出来（了解即可）

决策树最大的优点之一是"可解释"——它能画出来给你看：

```python
from sklearn.tree import plot_tree
import matplotlib.pyplot as plt

plt.figure(figsize=(20, 12))
plot_tree(model, filled=True, max_depth=3)   # 别画太深，会糊成一团
plt.savefig("tree.png")
```

> 真实项目里很少真的去画（树一大就看不清），但面试时可以提一句"决策树天生可解释"。

### 2.6 常见坑

| 现象 | 原因 | 解决 |
|---|---|---|
| 训练集 100%，测试集很差 | 树长太深，过拟合 | 设 `max_depth` / `min_samples_leaf`，或换随机森林 |
| 报错 `could not convert string to float` | 类别特征没编码 | `pd.get_dummies` 或 `LabelEncoder` |
| 修改数据时出现 SettingWithCopyWarning | 切片后直接改 | 先 `.copy()` |
| 树的样子很怪、某个特征特别重要 | 特征量纲/分布问题 | 决策树对量纲不敏感，但要注意异常值 |

## 三、总结

### 3.1 要点回顾

1. 决策树 = 一串"是/否"问题串成的判断流程：根节点 → 内部节点 → 叶节点
2. 每次分裂**强制二分**，选"切完最纯"的特征（分类看 Gini / 信息增益，回归看 MSE）
3. **剪枝是必需品**：`max_depth`、`min_samples_split`、`min_samples_leaf` 三个刹车
4. 决策树天然**可解释**（能画出来），但**极易过拟合**
5. 同一套逻辑，换个叶子输出方式就能做回归（`DecisionTreeRegressor`）

### 3.2 自测清单

<details>
<summary>Q1：决策树每次分裂为什么是"二分"？</summary>

每次只用一个特征的一个阈值把当前节点切成两半（是/否，或 ≥/<）。切完再对每个分支递归重复。
</details>

<details>
<summary>Q2：Gini 系数是什么？越小越好还是越大越好？</summary>

衡量节点"纯度"的指标：越小说明节点里类别越单一、越纯，划分质量越高。
</details>

<details>
<summary>Q3：决策树为什么容易过拟合？怎么防？</summary>

树可以无限生长，直到每个叶子只剩一个样本，等于死记训练集。靠剪枝（max_depth / min_samples_split / min_samples_leaf）限制复杂度。
</details>

<details>
<summary>Q4：one-hot 编码是干什么的？</summary>

把类别特征（如 male/female）拆成多列 0/1，让只能处理数值的模型能使用它。
</details>

### 3.3 面试视角（📌）

| 面试问法 | 答题要点 |
|---|---|
| 决策树的原理？ | 递归二分：每次选最"纯"的特征与阈值分裂，直到满足停止条件 |
| Gini 和信息增益的区别？ | 都是纯度度量：Gini 越小越纯；信息增益是熵的减少量，越大越好 |
| 决策树为什么容易过拟合？ | 无限制生长会记住噪声；需要剪枝/限制深度 |
| 决策树的优缺点？ | 可解释、无需归一化、能处理非线性；易过拟合、对数据扰动敏感 |
| 决策树怎么做回归？ | 叶子输出该区域样本的均值，分裂准则换成 MSE |

### 3.4 下一步

一棵树容易过拟合、还容易"看走眼"。那……**种一片森林呢？** 下一篇《集成学习》讲怎么把一堆弱模型组合成强模型。

---

*本文对应素材：`01_机器学习/03-笔记/day03.md`、`day04.md`、`02-代码/day03/04-泰坦尼克号生存预测.py`*
