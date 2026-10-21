---
title: CNN：卷积神经网络与图像分类
date: 2026-10-21 12:00:00
categories:
  - 基础篇
  - 深度学习
tags:
  - CNN
  - 卷积
  - 池化
  - 图像分类
description: 为什么图像不能硬塞给全连接网络？卷积的局部感知与参数共享、池化层降维，以及 CIFAR-10 图像分类实战
mathjax: true
---

> **一句话概括**：CNN 用"卷积核"在图像上滑动提取局部特征，再用"池化"压缩尺寸——参数少、效果好，是计算机视觉的基石。
> **这篇有多重要**：📌 —— 大模型岗位不直接做 CV，但"局部感知 + 参数共享"的思想值得懂；面试问"CNN 和全连接的区别"要能答。
> **前置知识**：dl-03 的网络搭建、dl-04 的训练循环
> **对应素材**：`day06.md` 卷积/池化、`01-课件/03-卷积神经网络.pptx`、`02-代码/day06`、`day07/01-图片识别分类案例.py`

## 一、初识：为什么图像不能直接喂给全连接网络

假设一张彩色图片 224×224，3 个通道（RGB）：

- 展平成一维：224 × 224 × 3 = **150,528 个输入**
- 如果第一层隐藏层有 1024 个神经元，光这一层的参数就是 150,528 × 1024 ≈ **1.5 亿个**

两个致命问题：

1. **参数爆炸**：一层就上亿参数，训练不动、显存爆炸
2. **丢失空间结构**：把图片拉成一维，等于把"左上角的像素"和"右下角的像素"当成无关的数字，图像的空间关系全没了

**CNN 的解法**：不搞"全连接"，而是让一个小的"卷积核"在图像上滑动，只关注**局部区域**——这就是卷积。

## 二、初识：卷积层——用"放大镜"扫过图像

### 2.1 一个直观的比喻

想象你拿一个 3×3 的小窗口（卷积核）在图片上从左到右、从上到下滑动：

- 每停一个位置，就把窗口内的 9 个像素和窗口的 9 个权重做**点积**，得到一个数
- 滑完整个图片，就得到一张新的"特征图"

那个小窗口就是**卷积核（filter / kernel）**，窗口里的权重就是**要学习的参数**。

### 2.2 两个关键思想

| 思想 | 含义 | 好处 |
|---|---|---|
| **局部感知** | 每个输出只连接输入的一小块区域 | 参数量从"全连接"的百万级降到几十个 |
| **参数共享** | 同一组卷积核权重在整张图上滑动复用 | 一个 3×3 核只有 9 个参数，却能扫遍全图 |

### 2.3 输出尺寸怎么算（面试常问）

$$\text{输出尺寸} = \frac{\text{输入尺寸} - \text{卷积核} + 2 \times \text{填充}}{\text{步长}} + 1$$

例如输入 32×32，卷积核 3×3，步长 1，填充 0：$(32-3+0)/1+1 = 30$，输出 30×30。

### 2.4 PyTorch 的卷积层

```python
import torch
import torch.nn as nn

# Conv2d(输入通道数, 输出通道数=卷积核个数, 卷积核大小, 步长, 填充)
conv = nn.Conv2d(in_channels=3, out_channels=32, kernel_size=3, stride=1, padding=1)

x = torch.randn(16, 3, 32, 32)     # (batch, 通道, 高, 宽)
out = conv(x)
print(out.shape)                   # torch.Size([16, 32, 32, 32])
```

> **通道数的含义**：输入通道 = 图片通道（RGB 是 3，灰度是 1）；输出通道 = 用了多少个卷积核 = 提取多少种特征。

## 三、初识：池化层——压缩尺寸，保留精华

卷积之后特征图还是很大（32×32），直接接全连接依然参数多。**池化（Pooling）**的作用就是降采样：

| 类型 | 规则 | API |
|---|---|---|
| **最大池化** | 每个小窗口只留最大值 | `nn.MaxPool2d(2)` |
| 平均池化 | 每个小窗口取平均 | `nn.AvgPool2d(2)` |

```python
pool = nn.MaxPool2d(kernel_size=2, stride=2)   # 2×2 窗口，尺寸减半
x = torch.randn(16, 32, 32, 32)
print(pool(x).shape)                            # [16, 32, 16, 16]
```

池化**没有可学习参数**，它只是"挑重点"：最大池化保留最显著的特征响应，同时让模型对小幅平移更不敏感。

## 四、初识：CNN 的典型结构

```text
输入图像
  ↓ 卷积 → ReLU → 池化        （提取低级特征：边缘、颜色）
  ↓ 卷积 → ReLU → 池化        （提取中级特征：纹理、部件）
  ↓ 卷积 → ReLU → 池化        （提取高级特征：物体局部）
  ↓ 展平（Flatten）
  ↓ 全连接层 → 输出
```

规律：**通道数越来越多（特征种类变多），尺寸越来越小（空间压缩）**。

## 五、运用：图像分类实战（CIFAR-10）

用经典的 CIFAR-10 数据集（10 类小图：飞机、汽车、鸟、猫…，32×32 彩色）：

```python
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

# 1. 数据准备（自动下载 + 转张量 + 标准化）
transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.5, 0.5, 0.5), (0.5, 0.5, 0.5)),
])
train_set = datasets.CIFAR10(root="./data", train=True, download=True, transform=transform)
test_set  = datasets.CIFAR10(root="./data", train=False, download=True, transform=transform)

train_loader = DataLoader(train_set, batch_size=64, shuffle=True)
test_loader  = DataLoader(test_set, batch_size=64)

# 2. 定义 CNN
class ImageModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),   # 32→16
            nn.Conv2d(16, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),  # 16→8
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),  # 8→4
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(64 * 4 * 4, 256), nn.ReLU(),
            nn.Linear(256, 10),          # 10 个类别
        )

    def forward(self, x):
        return self.classifier(self.features(x))

# 3. 训练
device = "cuda" if torch.cuda.is_available() else "cpu"
model = ImageModel().to(device)
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
loss_fn = nn.CrossEntropyLoss()

for epoch in range(10):
    model.train()
    total, count = 0, 0
    for x, y in train_loader:
        x, y = x.to(device), y.to(device)
        pred = model(x)
        loss = loss_fn(pred, y)
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()
        total += loss.item(); count += 1
    print(f"第{epoch+1}轮 平均损失: {total/count:.4f}")

# 4. 评估
model.eval()
correct, total = 0, 0
with torch.no_grad():
    for x, y in test_loader:
        x, y = x.to(device), y.to(device)
        pred = model(x).argmax(dim=1)
        correct += (pred == y).sum().item()
        total += len(y)
print(f"测试集准确率: {correct/total:.2%}")
```

> 这个模型跑 10 轮，准确率大约能到 **70% 左右**——对 CPU 训练来说不错了。想更高就得加深网络、加数据增强（这些是 CV 方向的进阶内容）。

## 六、总结

### 6.1 要点回顾

1. 图像不能直接接全连接：**参数爆炸 + 丢失空间结构**
2. **卷积层**：小卷积核在图上滑动做点积——**局部感知 + 参数共享**，参数极少
3. **池化层**：降采样压缩尺寸（最大池化最常用），无参数
4. 输出尺寸公式：`(输入 − 核 + 2×填充) / 步长 + 1`
5. CNN 的规律：特征图**通道变多、尺寸变小**，最后展平接全连接分类

### 6.2 自测清单

<details>
<summary>Q1：CNN 相比全连接网络的优势？</summary>

参数量大幅减少（局部感知 + 参数共享），保留空间结构，对图像平移有一定不变性。
</details>

<details>
<summary>Q2：卷积核越大越好吗？</summary>

不一定。大卷积核感受野大但参数多；现代网络常用多个 3×3 堆叠，用更少参数获得同样甚至更大感受野。
</details>

<details>
<summary>Q3：池化层的作用？有参数吗？</summary>

降低特征图尺寸、减少计算量、保留主要特征、提升一定平移不变性。没有可学习参数。
</details>

<details>
<summary>Q4：输入 32×32，卷积核 3×3、步长 1、填充 1，输出多大？</summary>

(32 − 3 + 2×1)/1 + 1 = 32，输出仍是 32×32（same padding 的效果）。
</details>

### 6.3 面试视角（📌）

| 面试问法 | 答题要点 |
|---|---|
| CNN 的核心思想？ | 局部感知 + 参数共享，用卷积核提取局部特征，池化降维 |
| 卷积输出尺寸怎么算？ | (输入 − 核 + 2×填充)/步长 + 1 |
| 池化的作用？ | 降维、减少计算、提升平移不变性、防止过拟合 |
| 1×1 卷积的作用？ | 跨通道信息融合、调整通道数（降维/升维），几乎不增加计算量 |
| CNN 和全连接的区别？ | 局部连接 vs 全连接；参数共享 vs 每个连接独立参数 |

### 6.4 下一步

CNN 擅长"看"，但处理文本这种**有顺序**的数据就抓瞎了——下一篇讲 RNN，以及一个对 RAG 极其重要的概念：**词嵌入**。

---

*本文对应素材：`02_深度学习/03-笔记/day06.md`、`01-课件/03-卷积神经网络.pptx`、`02-代码/day06`、`day07/01-图片识别分类案例.py`*
