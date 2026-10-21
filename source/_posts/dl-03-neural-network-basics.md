---
title: 神经网络基础：激活函数、损失函数与模型搭建
date: 2026-10-21 10:30:00
categories:
  - 基础篇
  - 深度学习
tags:
  - 激活函数
  - 损失函数
  - nn.Module
  - 参数初始化
description: sigmoid/tanh/ReLU/softmax 怎么选、CrossEntropy 为什么自带 softmax、nn.Module 三步搭网络、参数为什么不能全 0
mathjax: true
---

> **一句话概括**：把"神经元"装配成"网络"：激活函数负责引入非线性，损失函数负责打分，`nn.Module` 负责把层串起来。
> **这篇有多重要**：🔥🔥 —— **面试必考**：激活函数怎么选（梯度消失、ReLU 死亡）、CrossEntropy 和 softmax 的关系、参数初始化为什么不能全 0。
> **前置知识**：dl-00 的神经元概念、dl-02 的自动微分
> **对应素材**：`day03.md` 人工神经网络、`day04.md` 激活函数/搭建网络/损失函数、`02-代码/day04`

## 一、初识：从神经元到网络

回顾 dl-00 的结论：

> **神经元 = 加权求和 + 激活函数**

把神经元排成层、层叠起来，就是全连接神经网络（Fully Connected Network / MLP）：

```
输入层（特征） → 隐藏层（若干层） → 输出层（预测）
     x1            h1   h2           y
     x2     →      神经元 神经元   →   输出
     x3            ……
```

- **输入层**：特征有几个，就有几个输入
- **隐藏层**：层数、每层神经元个数，都是人定的"超参数"
- **输出层**：回归任务 1 个输出；分类任务 N 个输出（N = 类别数）

## 二、初识：四大激活函数（面试必考）

激活函数负责给网络**注入非线性**——没有它，再深的网络也只等价于一层线性变换。

| 函数 | 公式 | 值域 | 用在哪 | 优点 | 缺点 |
|---|---|---|---|---|---|
| **sigmoid** | $\frac{1}{1+e^{-x}}$ | (0, 1) | 二分类**输出层** | 输出可解释为概率 | 两端梯度趋近 0 → **梯度消失** |
| **tanh** | $\frac{e^x-e^{-x}}{e^x+e^{-x}}$ | (−1, 1) | 隐藏层（旧方案） | 以 0 为中心，比 sigmoid 好 | 仍会梯度消失 |
| **ReLU** | $\max(0, x)$ | [0, +∞) | **隐藏层默认选择** | 计算快、正区间梯度恒为 1、缓解梯度消失 | 负数区梯度为 0 → **神经元死亡** |
| **softmax** | $\frac{e^{z_i}}{\sum e^{z_j}}$ | (0,1)，和为 1 | 多分类**输出层** | 把 logits 变成概率分布 | 只用于输出层 |

### 2.1 怎么选（记住这个组合）

> **隐藏层用 ReLU（或 tanh），输出层看任务**：
> - 回归 → **不用激活函数**（直接输出数值）
> - 二分类 → **sigmoid**（输出概率）
> - 多分类 → **softmax**（输出各类概率）

### 2.2 ReLU 死亡问题（面试追问）

ReLU 在负数区间输出 0、梯度也是 0。如果某个神经元的参数更新到"永远输出负数"，它就再也不会被激活了——这叫**神经元死亡**。

缓解：用 Leaky ReLU（负数区间给个小斜率）、注意学习率别太大、参数初始化要合理。

## 三、初识：损失函数怎么选

| 任务 | 损失函数 | 说明 |
|---|---|---|
| **回归** | `MSELoss` | 均方误差，最常用 |
| 回归 | `L1Loss` | 平均绝对误差，对异常值更稳 |
| 回归 | `SmoothL1Loss` | MSE 与 L1 的折中（Huber Loss） |
| **分类** | `CrossEntropyLoss` | **多分类标配** |
| 分类 | `BCELoss` | 二分类（配合 sigmoid） |

### 3.1 ⚠️ 最大的坑：CrossEntropyLoss 自带 softmax

```python
# ❌ 错误写法：网络输出已经 softmax 过了，又用 CrossEntropy
probs = torch.softmax(logits, dim=1)
loss = torch.nn.CrossEntropyLoss()(probs, y)

# ✅ 正确写法：网络输出原始 logits，CrossEntropy 内部自己 softmax
loss = torch.nn.CrossEntropyLoss()(logits, y)
```

> PyTorch 的 `CrossEntropyLoss` = `LogSoftmax` + `NLLLoss`，**内部已经包含 softmax**。所以模型最后一层**不要**再加 softmax，否则就是"softmax 两次"，训练效果会被削弱。
>
> 这个坑几乎每个新手都踩过，面试也爱问："你的分类模型输出层用 softmax 了吗？"——正确回答是"**训练时不用，CrossEntropy 里包含；推理时再手动 softmax 拿概率。**"

## 四、运用：三步搭一个网络

PyTorch 搭网络的固定套路，**背下来**：

```python
import torch
import torch.nn as nn

class MyModel(nn.Module):
    # 第一步：继承 nn.Module
    def __init__(self, input_dim, output_dim):
        super().__init__()                          # 必须调父类初始化
        # 第二步：定义层（这里定义 2 个隐藏层 + 1 个输出层）
        self.fc1 = nn.Linear(input_dim, 128)
        self.fc2 = nn.Linear(128, 64)
        self.out = nn.Linear(64, output_dim)

    # 第三步：定义前向计算流程
    def forward(self, x):
        x = torch.relu(self.fc1(x))     # 隐藏层：线性 + ReLU
        x = torch.relu(self.fc2(x))
        x = self.out(x)                 # 输出层：不加激活（交给 CrossEntropy）
        return x

model = MyModel(input_dim=20, output_dim=4)
print(model)
```

三个必须知道的点：

1. `super().__init__()` 不能省——不调用父类初始化，注册层会报错
2. 层写在 `__init__` 里，**计算流程写在 `forward` 里**
3. 调用时**不要**手动调 `forward()`，直接 `model(x)`（PyTorch 会处理 hook 等机制）

### 4.1 参数初始化：为什么不能全 0

如果所有权重都初始化为 0，同一层的所有神经元会算出**完全一样**的输出、收到**完全一样**的梯度——永远同步更新，等于白搭一层。

常用初始化：

| 方法 | 适用 | API |
|---|---|---|
| **kaiming（He）** | **ReLU 网络首选** | `nn.init.kaiming_normal_(w)` |
| **xavier（Glorot）** | tanh / sigmoid 网络 | `nn.init.xavier_normal_(w)` |
| 正态 / 均匀 | 通用 | `nn.init.normal_(w)`、`nn.init.uniform_(w)` |
| 全 1 | 偏置常用 | `nn.init.ones_(b)` |

```python
def __init__(self):
    super().__init__()
    self.fc1 = nn.Linear(20, 128)
    nn.init.kaiming_normal_(self.fc1.weight)   # 权重用 kaiming
    nn.init.zeros_(self.fc1.bias)              # 偏置初始 0 是常规操作
```

> 📌 注意：PyTorch 的 `nn.Linear` 已经内置了合理的默认初始化（kaiming uniform），**大多数情况不用手动初始化**。但面试可能会问，知道原理就好。

## 五、总结

### 5.1 要点回顾

1. 神经元 = 加权求和 + 激活；层叠起来就是全连接网络（输入层/隐藏层/输出层）
2. **激活函数**：隐藏层默认 ReLU（快、缓解梯度消失，但有神经元死亡风险）；输出层按任务选（回归不加、二分类 sigmoid、多分类 softmax）
3. **损失函数**：回归 MSE / L1 / SmoothL1；分类 CrossEntropy / BCE
4. **CrossEntropyLoss 内部自带 softmax**，输出层不要再手动加
5. 搭网络三步：继承 `nn.Module` → `__init__` 定义层 → `forward` 定义计算流
6. 参数不能全 0 初始化（会破坏对称性），ReLU 网络用 kaiming 初始化

### 5.2 自测清单

<details>
<summary>Q1：隐藏层为什么默认用 ReLU，而不是 sigmoid？</summary>

sigmoid 两端梯度接近 0，深层网络反向传播时梯度层层衰减（梯度消失）；ReLU 在正区间梯度恒为 1，缓解梯度消失，而且计算更快。
</details>

<details>
<summary>Q2：多分类模型的输出层要不要加 softmax？</summary>

训练时不要——CrossEntropyLoss 内部已经包含 softmax；推理阶段想输出概率时再手动加 softmax。
</details>

<details>
<summary>Q3：为什么参数不能全部初始化为 0？</summary>

所有神经元会得到相同输出和相同梯度，更新后依然相同，网络失去表达能力（对称性无法打破）。
</details>

<details>
<summary>Q4：回归任务的输出层用什么激活函数？</summary>

不用（恒等映射），直接输出数值；若标签有固定范围，也可以用 sigmoid 之类压缩，但一般不用。
</details>

### 5.3 面试视角（🔥 必背）

| 面试问法 | 答题要点 |
|---|---|
| 常用激活函数及区别？ | sigmoid（0~1，易梯度消失）/ tanh（−1~1）/ ReLU（缓解梯度消失，可能神经元死亡）/ softmax（多分类输出概率） |
| 什么是梯度消失？怎么缓解？ | 深层链式求导连乘小于 1 的数→梯度趋近 0；用 ReLU、残差连接、BN、合理初始化缓解 |
| CrossEntropy 和 softmax 的关系？ | CrossEntropyLoss 内部含 LogSoftmax，训练时输出层不要重复加 softmax |
| 损失函数怎么选？ | 回归 MSE/L1；二分类 BCE；多分类 CrossEntropy |
| 为什么要参数初始化？ | 打破对称性、控制激活值/梯度尺度（kaiming 对应 ReLU，xavier 对应 tanh） |

### 5.4 下一步

网络搭好了，但还没训练。下一篇把训练循环写完整：**数据管道 + 优化器 + 学习率调度**，跑通一个真实的训练案例。

---

*本文对应素材：`02_深度学习/03-笔记/day03.md`、`day04.md`、`02-代码/day04`*
