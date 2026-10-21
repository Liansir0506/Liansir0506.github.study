---
title: 自动微分：PyTorch 怎么帮你算梯度
date: 2026-10-21 10:00:00
categories:
  - 基础篇
  - 深度学习
tags:
  - 自动微分
  - autograd
  - 反向传播
  - 梯度下降
description: requires_grad、backward、梯度累积的坑、detach、链式法则——理解这套机制，才算真正入门 PyTorch
mathjax: true
---

> **一句话概括**：你只管写"正向计算"，PyTorch 自动记录计算过程，一个 `backward()` 就把所有参数的梯度算出来。
> **这篇有多重要**：🔥🔥🔥 —— **整个深度学习训练的地基**。面试问"反向传播怎么实现""梯度为什么要清零"，考的就是这里。
> **前置知识**：ml-01 的梯度下降、dl-01 的张量运算（`@` 点积）
> **对应素材**：`day02.md` 自动微分、`day03.md` 自动微分使用、`day05.md` 反向传播原理

## 一、初识：梯度是什么，为什么要自动算

先回忆 ml-01 的结论：训练模型 = 不断调整参数，让损失函数变小，方法是：

$$W_{新} = W_{旧} - 学习率 \times \frac{\partial L}{\partial W}$$

其中 $\frac{\partial L}{\partial W}$ 就是**梯度**——损失函数对参数求的导数。

问题来了：神经网络动辄几百万个参数、几十层函数嵌套，**手推导数根本不现实**。

PyTorch 的解决方案叫**自动微分（autograd）**：

> 正向计算时，PyTorch 悄悄记录下每一步运算，织成一张"计算图"；调用 `backward()` 时，沿着图反向走一遍，用链式法则自动算出每个参数的梯度。

你只需要做两件事：

1. 告诉它"哪些参数需要梯度"（`requires_grad=True`）
2. 算完损失后喊一声 `loss.backward()`

## 二、运用：三个核心操作

### 2.1 requires_grad：标记"需要求导的张量"

```python
import torch

x = torch.tensor([1.0, 2.0, 3.0], requires_grad=True)
y = x ** 2 + 3 * x           # 对 x 做了一堆运算
print(y.requires_grad)       # True —— y 也在计算图里
```

> 神经网络的权重默认就是 `requires_grad=True`；输入数据和标签一般不需要梯度。

### 2.2 backward()：一键求导

```python
x = torch.tensor([2.0], requires_grad=True)
y = 4 * x ** 2                # y = 4x²

y.backward()                  # 自动求导
print(x.grad)                 # dy/dx = 8x = 16
```

数学验证：$y = 4x^2$ 的导数是 $8x$，代入 $x=2$ 得 16——结果对上了。

### 2.3 为什么只能对标量求导

```python
x = torch.tensor([1.0, 2.0], requires_grad=True)
y = x * 2          # 形状 (2,)，不是标量

# y.backward()     # ❌ 报错：grad can be implicitly created only for scalar outputs
y.sum().backward() # ✅ 先 sum 变成标量，再求导
```

原因：**梯度必须相对于一个标量（损失值）来定义**。所以实际训练中，我们总是对 `loss`（一个数）调用 `backward()`。

## 三、运用：两个必须记住的坑

### 3.1 坑一：梯度会累积，必须手动清零

```python
x = torch.tensor([2.0], requires_grad=True)

for i in range(3):
    y = 4 * x ** 2
    y.backward()
    print(f"第{i+1}次 x.grad =", x.grad)     # 16 → 32 → 48 ！！！
```

看到问题了吗？梯度**不会自动清零**，每次都往上加。

> 这正是训练循环里 `optimizer.zero_grad()` 存在的原因。忘了清零，梯度会越滚越大，模型直接训练崩。

正确写法：

```python
for i in range(3):
    y = 4 * x ** 2
    y.backward()
    print(x.grad)
    x.grad.zero_()      # ✅ 每次求完导立即清零
```

### 3.2 坑二：带梯度的张量不能直接转 numpy

```python
x = torch.tensor([2.0], requires_grad=True)
y = 4 * x ** 2
y.backward()

# print(x.numpy())        # ❌ 报错：Can't call numpy() on Tensor that requires grad
print(x.detach().numpy()) # ✅ 先 detach 脱离计算图，再转 numpy
```

`detach()` 的作用：**创建一个"不需要梯度"的副本**，与计算图断开。画图、打印、转 numpy 时常用。

## 四、运用：反向传播是怎么"倒着算"的

自动微分背后是**链式法则**（复合函数求导）：

假设两层网络：

$$x \xrightarrow{w_1} z_1 \xrightarrow{\text{sigmoid}} a_1 \xrightarrow{w_2} z_2 \xrightarrow{\text{sigmoid}} a_2 \xrightarrow{} Loss$$

要算 $\frac{\partial Loss}{\partial w_1}$，就是把路径上每一步的导数**连乘**起来：

$$\frac{\partial L}{\partial w_1} = \frac{\partial L}{\partial a_2} \cdot \frac{\partial a_2}{\partial z_2} \cdot \frac{\partial z_2}{\partial a_1} \cdot \frac{\partial a_1}{\partial z_1} \cdot \frac{\partial z_1}{\partial w_1}$$

- 从输出层往输入层**逐层倒推**
- 每一步只需要求"本层"的局部导数，再乘上从后面传来的梯度
- 这就是为什么叫**反向**传播

> 📌 面试答法："反向传播本质是链式法则；从损失出发，逐层反向计算局部梯度并相乘，得到每个参数的梯度。PyTorch 的 autograd 通过构建计算图自动完成这件事。"

## 五、运用：亲手做一次梯度下降

用最简单的 $y = 4x^2$ 感受不同学习率的效果：

```python
import torch

def gradient_descent(lr, steps=4):
    x = torch.tensor([2.0], requires_grad=True)
    for i in range(steps):
        y = 4 * x ** 2
        y.backward()
        print(f"step{i}: x={x.item():.4f}, grad={x.grad.item():.4f}, loss={y.item():.4f}")
        x.data.sub_(lr * x.grad)   # x = x − lr × 梯度
        x.grad.zero_()

gradient_descent(lr=0.1)     # 稳定下降
# gradient_descent(lr=0.3)   # 步子太大：loss 爆炸
# gradient_descent(lr=0.01)  # 步子太小：下降极慢
```

你会看到三种结局：

| 学习率 | 现象 |
|---|---|
| 0.01 | 每步只挪一点点，4 步后还在原地附近 |
| 0.1 | 稳步逼近谷底（x=0） |
| 0.3 | 一步跨过谷底，越弹越高（梯度爆炸/发散） |

> 这就是 ml-01 那张"学习率表"的代码版——亲手跑一遍，比背十遍都管用。

## 六、运用：用 autograd 手动训练一个线性层

不用任何高层 API，纯手工走一遍训练流程：

```python
import torch

# 1. 准备数据（2 个样本、5 个特征）
X = torch.ones(2, 5)
Y = torch.zeros(2, 3)                              # 真实值

# 2. 定义要学习的参数
W = torch.randn(5, 3, requires_grad=True)          # 权重
B = torch.randn(3, requires_grad=True)             # 偏置

# 3. 正向传播：预测 + 损失
Z = X @ W + B
loss_fn = torch.nn.MSELoss()
loss = loss_fn(Z, Y)
print("loss:", loss.item())

# 4. 反向传播：自动算梯度
loss.backward()
print("W 的梯度:\n", W.grad)
print("B 的梯度:", B.grad)
```

> 这一段是 `nn.Linear` 的手工版。等到 dl-04 用优化器时，`optimizer.step()` 做的就是"用这些梯度更新参数"。

## 七、总结

### 7.1 要点回顾

1. **自动微分 = 正向记录计算图 + 反向链式法则求导**
2. 三步走：`requires_grad=True` 标记 → 正向算 `loss` → `loss.backward()`，梯度存到 `.grad`
3. **只能对标量求导**：非标量要先 `.sum()` 之类变成标量
4. **梯度会累积**：每次求完导要 `zero_grad()`（训练循环里必做）
5. 带梯度的张量转 numpy 要先 `detach()`
6. 反向传播的本质是**链式法则**，从输出层往输入层逐层反推

### 7.2 自测清单

<details>
<summary>Q1：为什么每次训练循环都要 zero_grad()？</summary>

PyTorch 的梯度默认是累加的（.grad += 新梯度）。不清零的话，上一批的梯度会叠加到这一批，导致更新方向错误、梯度爆炸。
</details>

<details>
<summary>Q2：为什么 backward() 只能用在标量上？</summary>

梯度的定义是"标量对向量的导数"。损失是一个标量，其它非标量输出需要先归约为标量（如 sum、mean）。
</details>

<details>
<summary>Q3：detach() 有什么用？</summary>

返回一个脱离计算图、不需要梯度的张量副本。用于转 numpy、绘图、或截断梯度传播。
</details>

<details>
<summary>Q4：反向传播的数学本质是什么？</summary>

链式法则。从损失出发，按计算图反向逐层计算局部导数并连乘，得到每个参数的梯度。
</details>

### 7.3 面试视角（🔥 高频）

| 面试问法 | 答题要点 |
|---|---|
| 反向传播是什么？ | 链式法则逐层反向求导；PyTorch 的 autograd 基于计算图自动实现 |
| 为什么要梯度清零？ | 梯度默认累加，不清零会叠加上一批的梯度 |
| detach 的作用？ | 脱离计算图，阻断梯度；常用于转 numpy 或冻结部分网络 |
| requires_grad 有什么意义？ | 标记哪些张量参与求导（如模型参数），节省不必要的计算 |
| 计算图是什么？ | 记录正向运算的有向无环图，反向时按图求导，求完即释放（动态图） |

### 7.4 下一步

梯度能自动算了，接下来把"零件"组装起来：**激活函数、损失函数、网络搭建**——一个完整的神经网络模型。

---

*本文对应素材：`02_深度学习/03-笔记/day02.md`、`day03.md`、`day05.md`、`02-代码/day03`*
