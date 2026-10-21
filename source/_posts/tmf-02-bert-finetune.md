---
title: BERT 微调：预训练模型的效果跃迁
date: 2026-10-23 10:00:00
categories:
  - 项目篇
  - 投满分 NLP 项目
tags:
  - BERT
  - 微调
  - 文本分类
description: 从一个 [CLS] 向量到分类结果——微调到底在调什么、超参怎么设、为什么它能吊打词袋模型
mathjax: true
---

> **一句话概括**：BERT 微调 = 在预训练好的"语言理解器"后面接一个分类头，用少量标注数据把它"调教"成分类专家。
> **这篇有多重要**：🔥 —— 主流方案，面试必问："微调怎么做""为什么效果好""超参怎么设"。
> **前置知识**：nlp-05 的 BERT 与预训练、dl-04 的训练循环
> **对应素材**：`tmf/01课件/07-markdown/day03_预训练BERT微调.md`

## 一、初识：BERT 为什么强

对比一下前面的基线：

| 方案 | 文本表示 | 理解能力 |
|---|---|---|
| TF-IDF + RF | 词袋（几万维稀疏） | 无（丢语序语义） |
| fasttext | 词向量平均 | 弱（平均会丢掉顺序信息） |
| **BERT** | **上下文相关的 768 维向量** | **强（双向注意力建模上下文）** |

关键差异：**同一个词在不同句子里，BERT 给出的向量不一样**——它理解"苹果手机"和"吃苹果"里的"苹果"不是一回事。

### 1.1 BERT 怎么做分类

```text
输入文本 → [CLS] 词1 词2 … [SEP]
              ↓
          BERT 编码器（12 层 Transformer）
              ↓
        [CLS] 位置的 768 维向量   ← 聚合了整句语义
              ↓
         Linear(768 → 类别数)
              ↓
           类别概率
```

> 🔥 记住这个设计：**`[CLS]` 就是"整句摘要位"**——它没有对应的原始词，专门用来聚合句子级信息做分类。

## 二、运用：微调的完整流程

### 2.1 数据准备（tokenizer）

```python
from transformers import BertTokenizer

tokenizer = BertTokenizer.from_pretrained("bert-base-chinese")

def encode(text):
    return tokenizer(
        text,
        max_length=256,        # 短文本够用（长文本 512）
        truncation=True,       # 超长截断
        padding="max_length",  # 补齐到统一长度
        return_tensors="pt",
    )
```

三个细节：

| 细节 | 说明 |
|---|---|
| **max_length** | 按数据长度分布定（覆盖 95% 样本即可），越长越慢 |
| **truncation** | 必须开（否则长文本报错） |
| **padding** | 训练/推理保持一致 |

### 2.2 模型（加分类头）

```python
from transformers import BertForSequenceClassification

model = BertForSequenceClassification.from_pretrained(
    "bert-base-chinese",
    num_labels=6,          # 类别数
)
```

`BertForSequenceClassification` 已经内置了 `[CLS] → Dropout → Linear` 的分类头——不用自己写。

### 2.3 训练循环（和 PyTorch 一样）

```python
from torch.optim import AdamW
from transformers import get_linear_schedule_with_warmup

optimizer = AdamW(model.parameters(), lr=2e-5, weight_decay=0.01)
scheduler = get_linear_schedule_with_warmup(
    optimizer, num_warmup_steps=int(0.1 * total_steps),
    num_training_steps=total_steps
)

for epoch in range(3):
    model.train()
    for batch in train_loader:
        outputs = model(**batch)
        loss = outputs.loss
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)   # 梯度裁剪
        optimizer.step()
        scheduler.step()
        optimizer.zero_grad()
```

### 2.4 评估

```python
model.eval()
preds, labels = [], []
with torch.no_grad():
    for batch in test_loader:
        logits = model(**batch).logits
        preds += logits.argmax(dim=1).cpu().tolist()
        labels += batch["labels"].cpu().tolist()

print(classification_report(labels, preds, digits=4))
```

## 三、初识：微调的超参为什么"小得出奇"

| 超参 | 典型值 | 为什么这么小/大 |
|---|---|---|
| **学习率** | **2e-5 ~ 5e-5** | 预训练模型已接近最优，大学习率会"把学到的知识冲掉"（灾难性遗忘） |
| **epoch** | 3~5 | 小数据上很容易过拟合，轮次不宜多 |
| warmup | 10% 步数 | 前几步慢慢升温，避免一开始就大步破坏权重 |
| batch size | 16~32 | 受显存限制 |
| weight decay | 0.01 | 轻微正则 |

> 🔥 **面试必答点**：微调的学习率要**比从头训练小 1~2 个数量级**（从头训练常 1e-3，微调 2e-5）——因为你不是在"教它语言"，而是在"调整它的任务倾向"。

## 四、初识：微调 vs 其他方案（这一步的收益）

| 方案 | 相对基线（RF/TF-IDF）的提升来源 |
|---|---|
| fasttext | 词向量带来一点语义泛化 |
| **BERT 微调** | **上下文语义理解**——否定、同义、长依赖都能处理 |

提升通常体现在**难样本**上：

| 样本 | 基线怎么错 | BERT 怎么对 |
|---|---|---|
| "这个政策**不利于**小企业" | 词袋只看到"政策""小企业" | 理解"不利于"的否定语义 |
| "手机**不像**广告说的那么好" | 情感极性判断错 | 理解转折结构 |

> 📌 但要注意：**BERT 效果好，成本也高**——推理比 fasttext 慢 10~100 倍，显存占用大。这就是为什么项目里还要做"模型压缩"（tmf-04）。

## 五、运用：微调的四个常见坑

| 坑 | 现象 | 解决 |
|---|---|---|
| 学习率太大 | loss 震荡、效果不如基线 | 降到 2e-5，加 warmup |
| 训练太久 | 训练集好、测试集降 | 减 epoch、early stopping |
| 截断太多 | 长文本信息丢失 | 增大 max_length 或分段 |
| 类别不均衡 | 少数类 F1 很低 | 类别权重 / 重采样 / focal loss |

## 六、总结

### 6.1 要点回顾

1. BERT 的核心优势：**上下文相关表示**（同词不同句不同向量）
2. 分类做法：`[CLS]` 向量 + 线性分类头（`BertForSequenceClassification` 内置）
3. 微调关键超参：**学习率 2e-5、epoch 3~5、warmup、梯度裁剪**
4. 学习率要比从头训练**小 1~2 个数量级**（防灾难性遗忘）
5. 效果提升主要体现在**难样本**（否定、转折、同义）；代价是推理慢
6. 四个坑：学习率、过拟合、截断、类别不均衡

### 6.2 自测清单

<details>
<summary>Q1：BERT 分类为什么用 [CLS] 向量？</summary>

[CLS] 是特殊 token，没有对应原词，经多层注意力后其向量聚合了整句语义，作为句子级表示接分类头最自然。
</details>

<details>
<summary>Q2：微调学习率为什么这么小？</summary>

预训练权重已接近好的解，大学习率会破坏已学知识（灾难性遗忘）；2e-5 量级只做"微调"。
</details>

<details>
<summary>Q3：微调容易过拟合，怎么防？</summary>

少 epoch + early stopping + weight decay + 数据增强；小数据场景还可以冻结底层只训顶层。
</details>

<details>
<summary>Q4：BERT 微调和从头训练的区别？</summary>

预训练已学到通用语言表示，微调只需在少量标注数据上调整任务倾向；从头训练需要大量数据与算力。
</details>

### 6.3 面试视角（🔥）

| 面试问法 | 答题要点 |
|---|---|
| BERT 微调怎么做？ | tokenizer → BertForSequenceClassification → 小学习率训练 → 评估 |
| 为什么学习率这么小？ | 防灾难性遗忘，预训练权重已接近最优 |
| 微调要多少数据？ | 每类几百条起步；数据越少越要注意过拟合与冻结策略 |
| 效果不如预期怎么排查？ | 先查数据/标签/划分，再看学习率与轮次，最后看 max_length 截断 |
| 推理太慢怎么办？ | 蒸馏小模型、量化、ONNX、批处理（引出模型压缩） |

### 6.4 下一步

BERT 效果最好但太"重"——**模型压缩**让它能在线上跑得动。

---

*本文对应素材：`tmf/01课件/07-markdown/day03_预训练BERT微调.md`*
