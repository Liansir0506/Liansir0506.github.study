---
title: 训练全流程：优化器与学习率调度
date: 2026-10-21 11:00:00
categories:
  - 基础篇
  - 深度学习
tags:
  - 优化器
  - PyTorch
description: 训练循环六步、五种优化器的演进、三种学习率衰减方案，最后一个完整的线性回归训练案例
mathjax: true
---

> **一句话概括**：把前面所有零件装成一台能跑的"训练机器"——数据怎么喂、参数怎么更新、学习率怎么调。
> **这篇有多重要**：🔥🔥 —— Adam 和学习率是大模型训练里最常调的两个东西；"训练循环六步"是写代码的基本功，面试问"怎么训练一个模型"就答它。
> **前置知识**：dl-02 自动微分、dl-03 网络搭建与损失函数
> **对应素材**：`day03.md` 模拟线性回归、`day05.md` 优化器与学习率衰减、`02-代码/day03`、`day05`

## 一、初识：训练循环六步（背下来）

不管模型多复杂，训练循环永远是这六步：

| # | 步骤 | 代码 |
|---|---|---|
| 1 | 前向传播：模型预测 | `pred = model(x)` |
| 2 | 计算损失 | `loss = loss_fn(pred, y)` |
| 3 | 反向传播：算梯度 | `loss.backward()` |
| 4 | 更新参数 | `optimizer.step()` |
| 5 | 清零梯度 | `optimizer.zero_grad()` |
| 6 | 下一批数据 | 循环 |

写成代码骨架：

```python
for epoch in range(epochs):            # 轮：整个数据集过一遍
    for x, y in dataloader:            # 批：每次一小撮数据
        pred = model(x)                # 1. 前向
        loss = loss_fn(pred, y)        # 2. 损失
        loss.backward()                # 3. 反向（算梯度）
        optimizer.step()               # 4. 更新参数
        optimizer.zero_grad()          # 5. 清零（下一批从头算）
```

> 为什么是"批"（batch）而不是一次全量？——全量太慢占内存，单条太抖。**小批量（mini-batch）是二者的折中**，也是现在所有训练的标准做法。

## 二、初识：数据管道——从张量到 DataLoader

PyTorch 喂数据有三层：

```text
张量 Tensor  →  数据集 TensorDataset  →  加载器 DataLoader（分批、打乱、并行）
```

```python
from torch.utils.data import TensorDataset, DataLoader

x = torch.randn(100, 5)      # 100 个样本、5 个特征
y = torch.randn(100, 1)      # 100 个标签

dataset = TensorDataset(x, y)                            # 打包成数据集
dataloader = DataLoader(dataset, batch_size=16, shuffle=True)  # 每批 16 条，打乱

for x_batch, y_batch in dataloader:
    print(x_batch.shape)     # [16, 5]（最后一批可能不足 16）
```

两个参数的含义：

- `batch_size`：每批几条数据（常见 16 / 32 / 64 / 128）
- `shuffle`：每个 epoch 是否打乱顺序（**训练集打乱，测试集不打乱**——否则评估结果不稳定）

## 三、初识：五种优化器（一条演进线）

优化器负责"用梯度更新参数"。从最朴素到最好用，一共五代：

| 优化器 | 核心改进 | 一句话 |
|---|---|---|
| **SGD** | 基础版：$W = W - lr \cdot grad$ | 老实走下坡 |
| **Momentum** | 加"惯性"：累积历史梯度方向 | 下坡带惯性，冲过小坑，减少震荡 |
| **Adagrad** | **自适应学习率**：每个参数有自己的步长（更新多的参数步子变小） | 自动给不同参数配不同步长 |
| **RMSProp** | 改进 Adagrad：用滑动平均，避免学习率过早衰减到 0 | Adagrad 的修正版 |
| **Adam** | Momentum + RMSProp 合体：动量 + 自适应学习率 | **默认首选，80% 场景直接用它** |

```python
import torch.optim as optim

optimizer = optim.SGD(model.parameters(), lr=0.01)
optimizer = optim.SGD(model.parameters(), lr=0.01, momentum=0.9)   # 动量
optimizer = optim.Adagrad(model.parameters(), lr=0.01)
optimizer = optim.RMSprop(model.parameters(), lr=0.01, alpha=0.9)
optimizer = optim.Adam(model.parameters(), lr=0.001, betas=(0.9, 0.999))  # 常用
```

> 📌 **面试提示**："Adam 为什么好用？"——答"结合了动量和自适应学习率，对不同参数自动调整步长，收敛快、对超参不敏感"。大模型微调（LoRA 等）也基本用 AdamW（Adam 的权重衰减修正版）。

## 四、初识：学习率衰减（让训练越走越稳）

**为什么衰减？** 训练初期步子大（快速下降），后期步子小（精细收敛）。固定学习率很难两头兼顾。

三种常见策略：

| 策略 | 规则 | API |
|---|---|---|
| **等间隔衰减 StepLR** | 每隔固定轮数，学习率 × gamma | `StepLR(opt, step_size=5, gamma=0.1)` |
| **指定节点衰减 MultiStepLR** | 在第 [3,5,8] 轮时衰减 | `MultiStepLR(opt, milestones=[3,5,8], gamma=0.1)` |
| **指数衰减 ExponentialLR** | 每轮都乘 gamma | `ExponentialLR(opt, gamma=0.9)` |

用法固定：

```python
scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=5, gamma=0.1)

for epoch in range(100):
    # ... 训练一个 epoch ...
    scheduler.step()              # 更新学习率（每个 epoch 调一次）
    print(scheduler.get_last_lr())
```

> ⚠️ 顺序注意：一般先 `optimizer.step()` 更新参数，再 `scheduler.step()` 更新学习率。

## 五、运用：完整案例——模拟线性回归

用 `make_regression` 造一批带噪声的数据，让模型自己学出斜率和偏置。

```python
import torch
from sklearn.datasets import make_regression
from torch.utils.data import TensorDataset, DataLoader

# 1. 造数据：100 个样本、1 个特征、真实斜率 27.48、偏置 3、带噪声
x, y, coef = make_regression(
    n_samples=100, n_features=1, n_targets=1,
    bias=3, noise=10, coef=True, random_state=3
)
x = torch.tensor(x, dtype=torch.float32)
y = torch.tensor(y.reshape(-1, 1), dtype=torch.float32)

# 2. 数据管道
dataloader = DataLoader(TensorDataset(x, y), batch_size=16, shuffle=True)

# 3. 模型与优化器
model = torch.nn.Linear(in_features=1, out_features=1)
optimizer = torch.optim.SGD(model.parameters(), lr=0.01)

# 4. 训练
loss_list = []
for epoch in range(100):
    total_loss, count = 0, 0
    for x_batch, y_batch in dataloader:
        pred = model(x_batch)
        loss = torch.nn.MSELoss()(pred, y_batch)
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()
        total_loss += loss.item()
        count += 1
    loss_list.append(total_loss / count)
    if (epoch + 1) % 10 == 0:
        print(f"第{epoch+1}轮，平均损失: {total_loss/count:.4f}")

# 5. 看结果（模型学到的 vs 真实值）
print("模型学到的:", model.state_dict())    # weight 应接近 27.48，bias 接近 3
print("真实值: coef=27.48, bias=3")
```

训练结束后你会看到两件事：

1. **损失曲线**：从高快速下降，几十轮后趋于平稳
2. **学到的参数**：weight ≈ 27.5，bias ≈ 3——和造数据时的真实值几乎一致

> 这就是"模型训练"的全部真相：**给数据、定损失、反复"预测→算错→改错"**，参数就会收敛到真实规律附近。

## 六、总结

### 6.1 要点回顾

1. **训练循环六步**：前向预测 → 算 loss → `backward()` → `step()` → `zero_grad()` → 下一批
2. 数据管道：张量 → `TensorDataset` → `DataLoader`（batch_size / shuffle）；训练集打乱、测试集不打乱
3. 优化器演进：SGD → Momentum（惯性）→ Adagrad（自适应学习率）→ RMSProp（改进）→ **Adam（默认首选）**
4. 学习率衰减三大策略：StepLR（等间隔）、MultiStepLR（指定节点）、ExponentialLR（指数）
5. 训练的本质：反复"预测 → 算损失 → 反向修参数"，直到损失收敛

### 6.2 自测清单

<details>
<summary>Q1：训练循环六步是什么？</summary>

前向传播预测 → 计算损失 → loss.backward() 求梯度 → optimizer.step() 更新参数 → optimizer.zero_grad() 清零梯度 → 取下一批数据。
</details>

<details>
<summary>Q2：为什么要用 mini-batch，而不是全量或单条？</summary>

全量：内存和计算压力大、更新次数少；单条：梯度噪声大、训练不稳定。mini-batch 是效率与稳定性的折中。
</details>

<details>
<summary>Q3：Adam 相比 SGD 的优势？</summary>

结合动量（利用历史梯度方向）和自适应学习率（每个参数步长不同），收敛更快、对学习率不那么敏感。
</details>

<details>
<summary>Q4：为什么要做学习率衰减？</summary>

初期大学习率快速逼近，后期小学习率精细收敛；固定学习率容易在最优值附近震荡或收敛太慢。
</details>

### 6.3 面试视角（🔥）

| 面试问法 | 答题要点 |
|---|---|
| 训练一个模型的完整流程？ | 数据准备/管道 → 定义模型 → 损失函数 → 优化器 → 训练循环（六步）→ 评估/保存 |
| 优化器怎么选？ | 默认 Adam；追求极致泛化可调 SGD+Momentum；大模型常用 AdamW |
| Adam 的原理？ | 一阶动量（梯度均值）+ 二阶动量（梯度平方均值）自适应调整每个参数的学习率 |
| 为什么要学习率衰减？ | 前期大步快降、后期小步精调，避免震荡 |
| batch_size 怎么选？ | 受显存限制；太小训练抖、太大泛化变差；常见 16~256，可用梯度累积模拟大 batch |

### 6.4 下一步

训练机器能跑了。但跑着跑着模型可能"背题"——过拟合。下一篇讲怎么治：**Dropout、BatchNorm 和一次完整的实战案例**。

---

*本文对应素材：`02_深度学习/03-笔记/day03.md`、`day05.md`、`02-代码/day03`、`day05`*
