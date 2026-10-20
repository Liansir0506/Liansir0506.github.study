---
title: KNN：物以类聚的第一个分类算法
date: 2026-10-20 21:30:00
categories:
  - 基础篇
  - 机器学习
tags:
  - KNN
  - 特征缩放
  - 归一化
  - 标准化
description: KNN 一句话原理、K 值怎么选、为什么它必须先做特征缩放——再用鸢尾花数据集走一遍完整流程
mathjax: true
---

> **一句话概括**：想判断一个新样本属于哪一类？看看离它最近的 K 个"邻居"是谁。
> **这篇有多重要**：📌 —— 面试会问原理、K 值影响、"为什么必须归一化"；实战里它是最直观的分类器，也是理解"距离"这个概念的最佳入口。
> **前置知识**：ml-00 的建模六步、ml-01 的过拟合概念（K 值选大了小了的后果，本质就是过/欠拟合）
> **对应素材**：`01_机器学习/03-笔记/day02.md` 后半、`day03.md` 前半、`02-代码/day03/01-鸢尾花案例.py`

## 一、初识：什么叫"物以类聚"

### 1.1 一句话讲完 KNN

KNN（K-Nearest Neighbors，K 近邻）的逻辑特别朴素：**物以类聚，人以群分**。

来了一个新样本，怎么判断它属于哪一类？

1. 算一算它和训练集里每个样本的**距离**
2. 找出距离最近的 **K 个邻居**
3. **分类**：让这 K 个邻居投票，哪个类别票多，就判给它
4. **回归**：取这 K 个邻居标签的**平均值**

就这么简单。没有公式推导，没有参数学习——它连"训练"都算不上。

### 1.2 它是最"懒"的算法

对比一下 ml-01 的线性回归：`fit()` 的时候忙着算最优的 w 和 b，预测时直接套公式，很快。

KNN 完全反过来：

| 阶段 | 线性回归 | KNN |
|---|---|---|
| 训练（fit） | 认真算参数 | 只是把数据**存起来** |
| 预测（predict） | 套公式，很快 | 要**算一遍所有距离**，数据越大越慢 |

这种"平时不学习、考试才突击"的模式，业内叫**懒惰学习（Lazy Learning）**。

**优缺点一句话总结**：

- ✅ 简单、无需训练、天然支持多分类
- ❌ 预测慢（每次都要全量算距离）、内存开销大（要存全部数据）、对量纲和噪声敏感

### 1.3 K 值怎么选（面试爱问）

K 是 KNN 唯一的"超参数"——**人定的，不是学出来的**。

| K 值 | 会发生什么 | 说白了 |
|---|---|---|
| **太小**（比如 1） | 结果被最近的个别点左右，对噪声极其敏感 → **过拟合** | 只听身边一个人的话，容易被带偏 |
| **太大** | 邻居里混入别的类，边界模糊 → **欠拟合** | 问全村人的意见，嘈杂、没有区分度 |
| **合适** | 一般 3~10，用交叉验证 / 网格搜索找 | 听几个靠谱邻居的意见 |

> 📌 小技巧：二分类时 K 通常取**奇数**，避免出现平票。

## 二、运用：为什么 KNN 必须先做特征缩放

### 2.1 一个残酷的例子

假设样本有两个特征：身高（cm）和体重（kg）。算两个样本的欧氏距离：

$$\sqrt{(170-16)^2 + (60-56)^2} = \sqrt{154^2 + 4^2}$$

看到问题没有？身高的差值 154，体重只差 4——**身高的影响完全碾压了体重**。

换成"收入（万元）vs 年龄（岁）"更夸张：收入差 5 万就是 5，年龄差 5 岁也是 5，量纲根本不在一个尺度上。

**结论：KNN 靠"距离"吃饭，而距离对量纲极其敏感 → 必须先缩放。**

### 2.2 两种缩放方法（都得会）

| 方法 | 公式 | sklearn API | 特点 |
|---|---|---|---|
| **归一化（Min-Max）** | $\frac{x - min}{max - min}$ | `MinMaxScaler` | 压缩到 [0,1]；**对异常值敏感**（一个极端值会把所有人挤在一起） |
| **标准化（Z-Score）** | $\frac{x - \mu}{\sigma}$ | `StandardScaler` | 均值 0、标准差 1；**对异常值更稳**，实战更常用 |

> 📌 **怎么选**：数据干净、有明确上下界（如图像像素）→ 归一化；数据有异常值、分布不明 → 标准化。拿不准就用标准化。

### 2.3 一个必须记住的坑：数据泄漏

缩放有一个铁律：

```python
# ✅ 正确：训练集 fit_transform（算出 min/max 或 μ/σ 并转换）
scaler = StandardScaler()
x_train = scaler.fit_transform(x_train)

# ✅ 测试集只 transform（用训练集算出的参数，绝不能重新 fit）
x_test = scaler.transform(x_test)
```

如果测试集也 `fit_transform`，等于**提前偷看了测试数据的分布**——评估结果会虚高，这叫**数据泄漏**。面试常考。

## 三、运用：鸢尾花案例（完整六步）

用 ml-00 的六步骨架走一遍真实数据：

```python
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score

# 1. 准备数据：sklearn 自带的鸢尾花数据集（150 个样本、4 个特征、3 个品种）
iris = load_iris()
x, y = iris.data, iris.target

# （可选）看一眼数据：4 个特征、3 个类别
print(iris.feature_names)   # ['sepal length', 'sepal width', 'petal length', 'petal width']
print(iris.target_names)    # ['setosa', 'versicolor', 'virginica']

# 2. 划分训练集 / 测试集
x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=42)

# 3. 特征缩放：标准化（fit 只在训练集上做！）
scaler = StandardScaler()
x_train = scaler.fit_transform(x_train)
x_test = scaler.transform(x_test)

# 4. 训练
model = KNeighborsClassifier(n_neighbors=5)
model.fit(x_train, y_train)

# 5. 预测
y_pred = model.predict(x_test)

# 6. 评估
print("准确率:", accuracy_score(y_test, y_pred))   # 约 0.97~1.0
# 也可以直接 model.score(x_test, y_test)
```

### 常见坑清单

| 现象 | 原因 | 解决 |
|---|---|---|
| `ValueError: Expected 2D array` | 特征传成了一维 | 特征写成 `[[x1, x2]]` 二维 |
| 准确率莫名很低 | 忘了做标准化 | 加 `StandardScaler` |
| 二分类出现平票 | K 取了偶数 | K 取奇数 |
| 评估分数虚高 | 测试集也 `fit_transform` 了 | 测试集只 `transform` |

## 四、总结

### 4.1 要点回顾

1. KNN = 找最近的 K 个邻居，**分类投票、回归取平均**
2. 没有训练过程（fit 只是存数据），预测时才计算——"懒惰学习"
3. K 值：**太小过拟合、太大欠拟合**，常用 3~10 的奇数，用交叉验证选
4. KNN 靠距离计算 → **必须特征缩放**；标准化比归一化更稳，实战首选
5. 缩放参数只能在训练集上 fit，测试集只 transform（否则数据泄漏）

### 4.2 自测清单

<details>
<summary>Q1：KNN 需要"训练"吗？</summary>

形式上要调 `fit()`，但它只是把训练数据存起来，没有参数学习过程。真正的计算都发生在预测时——所以叫懒惰学习。
</details>

<details>
<summary>Q2：K 值过大或过小分别会怎样？</summary>

过小（如 1）：对噪声敏感，容易过拟合；过大：决策过于平滑，容易欠拟合。
</details>

<details>
<summary>Q3：为什么 KNN 必须做特征缩放？</summary>

KNN 用距离度量相似度，量纲大的特征会主导距离计算，导致其他特征形同虚设。缩放让各特征"话语权"均衡。
</details>

<details>
<summary>Q4：归一化和标准化怎么选？</summary>

归一化（Min-Max）对异常值敏感，适合有明确边界的数据；标准化（Z-Score）对异常值更稳，是通用默认选择。
</details>

### 4.3 面试视角（📌）

| 面试问法 | 答题要点 |
|---|---|
| KNN 的原理？ | 找最近的 K 个邻居，分类投票 / 回归平均；无需训练 |
| KNN 的优缺点？ | 简单直观、无需训练、支持多分类；预测慢、内存大、对尺度/噪声敏感 |
| K 值怎么选？ | 交叉验证/网格搜索；小过拟合、大欠拟合；二分类取奇数 |
| KNN 为什么必须归一化/标准化？ | 距离度量对量纲敏感；缩放参数只能在训练集上 fit |
| KNN 适合什么场景？ | 小数据、低维度；数据量大或维度高时性能差（维度灾难） |

### 4.4 下一步

KNN 里我们用"准确率"评估模型——但准确率真的靠谱吗？下一篇 **《模型评估与调参：准确率是会说谎的》** 会告诉你：99% 的准确率可能一点用都没有。

---

*本文对应素材：`01_机器学习/03-笔记/day02.md`、`day03.md`、`02-代码/day03/01-鸢尾花案例.py`*
