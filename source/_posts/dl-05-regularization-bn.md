---
title: 正则化与归一化：Dropout、BatchNorm 与手机价格预测
date: 2026-10-21 11:30:00
categories:
  - 基础篇
  - 深度学习
tags:
  - Dropout
  - BatchNorm
  - 过拟合
  - 模型保存
description: Dropout 怎么随机失活、BatchNorm 为什么放在激活前、train/eval 模式的区别，附完整的多分类实战案例
mathjax: true
---

> **一句话概括**：模型学太好反而是灾难——Dropout 让神经元"随机掉线"防死记硬背，BatchNorm 让每层输入保持稳定，训练更快更稳。
> **这篇有多重要**：📌 —— 概念要懂（BN 和 Dropout 的思想在大模型里也到处是：LayerNorm、dropout rate），实战案例很典型。
> **前置知识**：dl-04 的训练循环、ml-03 的过拟合与评估
> **对应素材**：`day06.md`（Dropout / BatchNorm / 手机价格预测）、`02-代码/day06`

## 一、初识：深度学习的过拟合更凶

ml-01 讲过过拟合：模型把训练数据"背下来"了，换个数据就崩。

在深度学习里，这个问题被放大了：网络动辄几十万、几百万参数，**完全有能力把整个训练集一字不差地记住**。

两种常用"刹车"：

| 手段 | 作用位置 | 一句话 |
|---|---|---|
| **Dropout** | 激活函数之后 | 训练时随机让一部分神经元失活 |
| **BatchNorm** | 加权求和之后、激活之前 | 把每层输入标准化，稳定训练 |

## 二、初识：Dropout——随机"掉线"防死记硬背

### 2.1 机制

训练时，每个神经元以概率 $p$ **随机失活**（输出置 0）；没失活的神经元输出放大 $\frac{1}{1-p}$ 倍，保证总输出量级不变。

$$\text{输出} = \frac{\text{mask} \odot x}{1-p}$$

直觉：每次训练的网络都是"不同的残缺版"，逼着每个神经元都不能依赖某几个"大腿"，必须自己学到有用的特征。

### 2.2 两个关键细节

```python
dropout = torch.nn.Dropout(p=0.5)     # 每个神经元 50% 概率失活
```

1. **只在训练时生效**。推理时必须关掉——靠 `model.train()` / `model.eval()` 切换。
2. **p 的取值**：隐藏层常用 0.2~0.5；太大会欠拟合。

> 📌 面试踩坑点：如果推理时忘了 `model.eval()`，Dropout 还在随机失活，预测结果每次都不一样而且偏小——这是很经典的 bug。

## 三、初识：BatchNorm——让每层输入"端平"

### 3.1 为什么需要

训练时，前面层参数一变，后面层的输入分布就跟着变（内部协变量偏移），网络得不停"适应新分布"，训练又慢又难收敛。

BatchNorm 的做法：**在一个 batch 内，把每个神经元的输出标准化**（减均值、除标准差），再学两个参数 $\gamma$、$\beta$ 做缩放平移（保留表达能力）。

$$y = \gamma \cdot \frac{x - \mu_{batch}}{\sigma_{batch}} + \beta$$

### 3.2 三个要点

| 要点 | 说明 |
|---|---|
| **位置** | 放在**加权求和之后、激活函数之前**（`relu(bn(fc(x)))`） |
| **作用** | 加速收敛、允许更大学习率、有一定正则化效果 |
| **推理时** | 用训练期间累计的**全局均值/方差**，而不是当前 batch 的（所以同样需要 `eval()`） |

```python
self.bn1 = torch.nn.BatchNorm1d(num_features=128)   # 全连接层用 1d
self.bn2 = torch.nn.BatchNorm2d(num_channels=64)    # 卷积层用 2d
```

## 四、运用：手机价格预测（完整多分类案例）

数据集：2000 条手机参数，预测价格档位（4 个类别）。这个案例把前面的知识全用上了：数据管道、BN、Adam、学习率衰减、模型保存/加载。

### 4.1 准备数据

```python
import pandas as pd
import numpy as np
import torch
from sklearn.model_selection import train_test_split
from torch.utils.data import TensorDataset, DataLoader

def create_data():
    data = pd.read_csv("手机价格预测.csv")
    x = data.iloc[:, :-1]      # 特征：除最后一列
    y = data.iloc[:, -1]       # 标签：最后一列（价格档位 0~3）

    x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=0)

    train_ds = TensorDataset(
        torch.tensor(x_train.values, dtype=torch.float32),
        torch.tensor(y_train.values)
    )
    test_ds = TensorDataset(
        torch.tensor(x_test.values, dtype=torch.float32),
        torch.tensor(y_test.values)
    )
    return train_ds, test_ds, x.shape[1], len(np.unique(y))
```

### 4.2 定义模型（带 BN）

```python
class PhonePriceModel(torch.nn.Module):
    def __init__(self, input_dim, output_dim):
        super().__init__()
        self.fc1 = torch.nn.Linear(input_dim, 128)
        self.fc2 = torch.nn.Linear(128, 256)
        self.fc3 = torch.nn.Linear(256, 512)
        # BN：作用在加权求和之后、ReLU 之前
        self.bn1 = torch.nn.BatchNorm1d(128)
        self.bn2 = torch.nn.BatchNorm1d(256)
        self.bn3 = torch.nn.BatchNorm1d(512)
        self.out = torch.nn.Linear(512, output_dim)

    def forward(self, x):
        x = torch.relu(self.bn1(self.fc1(x)))
        x = torch.relu(self.bn2(self.fc2(x)))
        x = torch.relu(self.bn3(self.fc3(x)))
        return self.out(x)          # 不 softmax！CrossEntropy 内部处理
```

### 4.3 训练（Adam + 指数衰减）

```python
def train(train_ds, input_dim, output_dim):
    dataloader = DataLoader(train_ds, batch_size=16, shuffle=True)
    model = PhonePriceModel(input_dim, output_dim)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    scheduler = torch.optim.lr_scheduler.ExponentialLR(optimizer, gamma=0.9)

    model.train()                   # ✅ 训练模式（Dropout/BN 生效）
    for epoch in range(100):
        total, count = 0, 0
        for x, y in dataloader:
            pred = model(x)
            loss = torch.nn.CrossEntropyLoss()(pred, y)
            loss.backward()
            optimizer.step()
            optimizer.zero_grad()
            total += loss.item(); count += 1
        scheduler.step()            # 每轮衰减学习率
        if (epoch + 1) % 10 == 0:
            print(f"第{epoch+1}轮 平均损失: {total/count:.4f}")

    torch.save(model.state_dict(), "PhonePriceModel.pth")   # 保存模型参数
```

### 4.4 预测与评估

```python
def predict(test_ds, input_dim, output_dim):
    dataloader = DataLoader(test_ds, batch_size=8)
    model = PhonePriceModel(input_dim, output_dim)
    model.load_state_dict(torch.load("PhonePriceModel.pth", weights_only=True))

    model.eval()                    # ✅ 推理模式（关闭 Dropout、BN 用全局统计量）
    score, total = 0, 0
    with torch.no_grad():           # 推理不需要梯度，省内存
        for x, y in dataloader:
            pred = model(x)
            pred_label = torch.argmax(pred, dim=1)   # logits 取最大值的索引 = 预测类别
            score += (pred_label == y).sum().item()
            total += len(y)
    print(f"准确率: {score/total:.4f}")
```

### 4.5 模型保存与加载（三种常见写法）

```python
torch.save(model.state_dict(), "model.pth")            # 推荐：只存参数
model.load_state_dict(torch.load("model.pth", weights_only=True))

# 或保存整个模型（不推荐，依赖类定义）
torch.save(model, "model_full.pth")
model = torch.load("model_full.pth", weights_only=False)
```

## 五、总结

### 5.1 要点回顾

1. 深度学习参数多，**过拟合更严重**；两大刹车：Dropout、BatchNorm
2. **Dropout**：训练时以概率 p 随机失活神经元、未失活输出放大 1/(1−p)；**只在训练时生效**
3. **BatchNorm**：放在"加权求和后、激活前"，batch 内标准化 + 学习 γ/β；加速收敛
4. `model.train()` / `model.eval()` 不只是"心情"，而是真实影响 Dropout 和 BN 的行为
5. 推理时用 `torch.no_grad()` 省内存；模型保存优先用 `state_dict()`

### 5.2 自测清单

<details>
<summary>Q1：Dropout 为什么能防过拟合？</summary>

每次训练随机失活一部分神经元，等于训练了无数个"残缺网络"的子集，迫使特征不能依赖个别神经元；推理时相当于对集成做平均。
</details>

<details>
<summary>Q2：BatchNorm 放在哪？为什么？</summary>

放在线性层之后、激活函数之前。先标准化让数据分布稳定，再用 γ/β 恢复表达能力，然后过激活函数。
</details>

<details>
<summary>Q3：为什么推理时必须 model.eval()？</summary>

eval 会关闭 Dropout 的随机失活，并让 BN 使用训练时统计的全局均值/方差；不切换会导致预测结果不稳定、不准确。
</details>

<details>
<summary>Q4：CrossEntropyLoss 需要模型先 softmax 吗？</summary>

不需要。它内部包含 LogSoftmax，模型输出原始 logits 即可；推理时再用 argmax 或 softmax 得到类别/概率。
</details>

### 5.3 面试视角（📌）

| 面试问法 | 答题要点 |
|---|---|
| Dropout 原理？为什么能防过拟合？ | 训练时随机失活神经元，破坏共适应，集成式正则化；推理时关闭 |
| BatchNorm 的作用和位置？ | 稳定各层输入分布、加速收敛；线性层后激活前；推理用全局统计量 |
| BN 和 LayerNorm 的区别？ | BN 沿 batch 维标准化（依赖 batch），LN 沿特征维（不依赖 batch，适合变长序列/大模型） |
| train() 和 eval() 的区别？ | 切换 Dropout 开关、BN 使用 batch 统计还是全局统计 |
| 模型怎么保存/加载？ | 推荐 state_dict()；结构由代码定义，参数单独存取 |

### 5.4 下一步

全连接网络只能处理"一拍平"的数据。要处理图像，得上卷积神经网络——下一篇 **CNN**。

---

*本文对应素材：`02_深度学习/03-笔记/day06.md`、`02-代码/day06/03-案例-手机价格预测.py`*
