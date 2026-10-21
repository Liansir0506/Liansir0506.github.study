---
title: PyTorch 张量：深度学习的"数据容器"
date: 2026-10-21 09:30:00
categories:
  - 基础篇
  - 深度学习
tags:
  - PyTorch
  - 张量
  - 张量运算
  - 形状变换
description: 张量的创建、运算、索引、形状变换与拼接——把这一篇当 PyTorch 的速查手册用
mathjax: true
---

> **一句话概括**：张量就是"多维数组"，是 PyTorch 里一切数据的载体——图片、文本、权重，全是张量。
> **这篇有多重要**：📌 —— 属于工具基本功，面试不会直接考，但**写代码时天天用**。建议当速查手册收藏。
> **前置知识**：Python 基础、NumPy 数组的基本概念（有更好，没有也能看懂）
> **对应素材**：`02_深度学习/03-笔记/day01.md` 后半、`day02.md`、`02-代码/day01`、`day02`

## 一、初识：张量到底是什么

从名字说起：

| 维度 | 名字 | 例子 |
|---|---|---|
| 0 维 | 标量（scalar） | `torch.tensor(5)` → 一个数 |
| 1 维 | 向量（vector） | `torch.tensor([1, 2, 3])` |
| 2 维 | 矩阵（matrix） | `torch.tensor([[1,2],[3,4]])` |
| 3 维+ | 张量（tensor） | 一张 RGB 图片：`(通道, 高, 宽)` |

> 你可以把张量理解成"NumPy 的 ndarray + GPU 加速 + 自动求导"。深度学习的每一步——输入、权重、输出、梯度——都是张量。

## 二、运用：创建张量（常用六招）

```python
import torch

# 1. 从数据创建（最常用）
a = torch.tensor([1, 2, 3])            # 根据数据推断类型
b = torch.tensor([[1., 2.], [3., 4.]]) # 浮点

# 2. 按范围创建
torch.arange(0, 10, 2)        # [0,2,4,6,8]  包左不包右
torch.linspace(0, 10, 5)      # [0,2.5,5,7.5,10] 包左包右

# 3. 随机张量
torch.manual_seed(42)         # 固定随机种子（复现实验必备）
torch.rand(2, 3)              # 0~1 均匀分布
torch.randn(2, 3)             # 标准正态分布（均值0方差1）
torch.randint(1, 10, (2, 3))  # 1~9 的随机整数，包左不包右

# 4. 全 0 / 全 1 / 指定值
torch.zeros(2, 3)
torch.ones(2, 3)
torch.full((2, 3), 7)         # 全部填 7

# 5. 按已有张量的形状创建（很实用）
x = torch.randn(4, 5)
torch.zeros_like(x)           # 形状同 x 的全 0 张量
torch.ones_like(x)

# 6. 类型转换
t = torch.tensor([1, 2, 3])   # 默认 int64
t.float()                     # 转 float32（神经网络必须用浮点）
t.long()                      # 转 int64
```

> 💡 **随机种子**：`torch.manual_seed(42)` 能让每次随机的数字一样，调试和复现结果时非常有用。

### 2.1 tensor 和 numpy 互转（有个"共享内存"的坑）

```python
import numpy as np

t = torch.tensor([1, 2, 3])

# tensor → numpy
n1 = t.numpy()           # ⚠️ 共享内存：改 n1，t 也会变
n2 = t.numpy().copy()    # ✅ 拷贝：互不影响

# numpy → tensor
t1 = torch.from_numpy(n1)      # 共享内存
t2 = torch.tensor(n1)          # 拷贝（推荐，避免意外）
```

> 面试偶尔会问"tensor 和 numpy 转换有什么区别"——答"共享内存 vs 拷贝"即可。

## 三、运用：运算（重点只有两个）

### 3.1 逐元素运算（+ − × ÷）

```python
a = torch.tensor([[1, 2], [3, 4]])
b = torch.tensor([[5, 6], [7, 8]])

print(a + b)        # 对应位置相加
print(a * b)        # 点乘：对应位置相乘（不是矩阵乘法！）
print(a - b, a / b)
```

> ⚠️ PyTorch 里所有带下划线的方法（如 `add_()`）表示**原地修改**，会直接改掉原张量。常见坑。

### 3.2 点乘 vs 点积（最容易混的两个概念）

| 运算 | 符号 | 含义 | 形状要求 |
|---|---|---|---|
| **点乘**（element-wise） | `*` 或 `mul` | 对应位置相乘 | 形状相同 |
| **点积**（矩阵乘法） | `@` 或 `matmul` | 行 × 列求和 | A 的列数 = B 的行数 |

```python
a = torch.tensor([[1, 2], [3, 4]])   # 2×2
b = torch.tensor([[5, 6], [7, 8]])   # 2×2

print(a * b)      # 点乘：[[5,12],[21,32]]
print(a @ b)      # 点积（矩阵乘法）：[[19,22],[43,50]]
print(torch.matmul(a, b))   # 同上
```

> 🔥 **记住**：神经网络里"输入 × 权重"用的是**点积 `@`**（矩阵乘法），不是 `*`。这是新手最常犯的错。

### 3.3 常用统计与数学函数

```python
x = torch.tensor([[1., 2., 3.], [4., 5., 6.]])

x.sum()          # 全部求和 = 21
x.sum(dim=0)     # 按第 0 维（列）求和 → [5., 7., 9.]
x.sum(dim=1)     # 按第 1 维（行）求和 → [6., 15.]
x.mean()         # 均值
x.max(), x.min() # 最大 / 最小
x.exp()          # e 的幂
x.log()          # 自然对数
```

> `dim` 是"消掉哪一维"：`dim=0` 把行方向压掉（得到每列的和），`dim=1` 把列方向压掉（得到每行的和）。画个表就永远不会错。

## 四、运用：索引与形状变换（写代码最常改的地方）

### 4.1 索引

```python
x = torch.randint(1, 10, (3, 4))   # 3 行 4 列

x[0]          # 第 0 行
x[:, 0]       # 第 0 列
x[1, 2]       # 第 1 行第 2 列
x[:2, :3]     # 切片：前 2 行、前 3 列
x[x > 5]      # 布尔索引：所有大于 5 的元素
```

### 4.2 形状变换四件套（必须会）

```python
x = torch.randn(2, 3, 4)

x.reshape(6, 4)          # 重新排列（元素总数不变）
x.reshape(-1, 4)         # -1 自动推算（这里 = 6）

x.unsqueeze(0)           # 升维：在第 0 维加一个 1 → (1,2,3,4)
x.unsqueeze(-1)          # 在最后一维加 1 → (2,3,4,1)

y = torch.randn(1, 2, 1, 3)
y.squeeze()              # 降维：删掉所有长度为 1 的维度 → (2,3)
y.squeeze(0)             # 只删第 0 维 → (2,1,3)

z = torch.randn(2, 3, 4)
z.transpose(0, 1)        # 交换两个维度 → (3,2,4)
z.permute(2, 0, 1)       # 按指定顺序重排所有维度 → (4,2,3)
```

> 🔑 **实战场景**：模型要求输入是 `(batch, features)`，但你手上的数据是 `(features,)` → 用 `unsqueeze(0)` 升一维就对了。反过来，预测结果要取标量值 → `squeeze()` 去掉多余维度。

### 4.3 拼接：cat vs stack

```python
a = torch.randn(2, 3)
b = torch.randn(2, 3)

torch.cat([a, b], dim=0)     # 沿现有维度拼 → (4, 3)  不升维
torch.cat([a, b], dim=1)     # 沿列方向拼 → (2, 6)    不升维

torch.stack([a, b], dim=0)   # 新建一个维度 → (2, 2, 3)  升维
torch.stack([a, b], dim=1)   # → (2, 2, 3)
```

> 记忆：**cat 是在已有维度上接长，stack 是"叠成一摞"新开一维。**

## 五、总结

### 5.1 要点回顾

1. 张量 = 多维数组 + GPU 加速 + 自动求导，是 PyTorch 一切数据的载体
2. 创建常用：`tensor` / `arange` / `linspace` / `rand` / `randn` / `zeros` / `ones` / `full`，复现实验记得 `manual_seed`
3. tensor ↔ numpy 转换有**共享内存 vs 拷贝**的区别
4. **点乘 `*`（对应位置）≠ 点积 `@`（矩阵乘法）**——神经网络用后者
5. 形状变换四件套：`reshape` / `unsqueeze` / `squeeze` / `transpose`·`permute`
6. `cat` 不升维、`stack` 升维

### 5.2 自测清单

<details>
<summary>Q1：`a * b` 和 `a @ b` 有什么区别？</summary>

`*` 是逐元素相乘（要求形状相同）；`@` 是矩阵乘法（要求 A 的列数等于 B 的行数）。神经网络里输入与权重相乘用 `@`。
</details>

<details>
<summary>Q2：`unsqueeze` 和 `squeeze` 分别干什么？</summary>

unsqueeze 在指定位置插入一个长度为 1 的维度（升维）；squeeze 删除所有（或指定）长度为 1 的维度（降维）。常用于匹配模型对输入形状的要求。
</details>

<details>
<summary>Q3：tensor 转 numpy 时要注意什么？</summary>

`.numpy()` 与张量共享内存，修改会互相影响；需要独立副本时用 `.numpy().copy()`。
</details>

<details>
<summary>Q4：`cat` 和 `stack` 的区别？</summary>

cat 在已有维度上拼接，不增加维度数（其他维度必须一致）；stack 会新建一个维度，要求所有张量形状完全相同。
</details>

### 5.3 面试视角（📌 基本功）

| 面试问法 | 答题要点 |
|---|---|
| 张量是什么？和 numpy 数组的区别？ | 多维数组；张量支持 GPU 加速和自动求导（autograd） |
| 点乘和点积的区别？ | 逐元素 vs 矩阵乘法 |
| 广播机制（broadcast）了解吗？ | 形状不同但可对齐时，PyTorch 会自动扩展后再运算（如 (3,1) 与 (3,4)） |
| 为什么神经网络输入要转 float？ | 参数和梯度都是浮点数，整数张量无法参与梯度计算 |

### 5.4 下一步

张量会建、会算了。接下来是最神奇的部分：**PyTorch 的自动微分**——你只管写正向计算，梯度它帮你算。

---

*本文对应素材：`02_深度学习/03-笔记/day01.md`、`day02.md`、`02-代码/day01`、`day02`*
