---
title: vLLM：私有化部署大模型
date: 2026-10-22 12:30:00
categories:
  - 工程篇
  - AI 工程化
tags:
  - vLLM
  - 部署
description: 为什么要自己部署模型、推理和训练的区别、vLLM 凭什么快、Docker 起一个 OpenAI 兼容服务
mathjax: true
---

> **一句话概括**：vLLM 是高性能推理引擎，把开源模型部署成"OpenAI 兼容"的 API 服务——数据不出门、成本可控、延迟可控。
> **这篇有多重要**：🔥 —— 大模型岗位的高频考点："vLLM 为什么快""推理和训练的区别""显存怎么估算"。
> **前置知识**：dl-04 的推理概念、eng-06 的 Docker
> **对应素材**：`vibecoding/01课件/docs/07-vllm.md`

## 一、初识：为什么要私有化部署

| 动机 | 说明 |
|---|---|
| **数据安全** | 金融/医疗/政务数据不能出内网 |
| **成本** | 高频调用时，自己部署比按 token 付费便宜 |
| **可控性** | 延迟、版本、并发自己说了算；不依赖外部服务稳定性 |

> 一句话：**能调 API 就先调 API，数据敏感或规模大了再私有化。**

## 二、初识：推理 vs 训练（面试常问）

| 维度 | 训练（Training） | 推理（Inference） |
|---|---|---|
| 目标 | 更新模型参数 | 用固定参数生成结果 |
| 计算特点 | 前向 + 反向 + 优化器 | **只有前向** |
| 显存占用 | 参数 + 梯度 + 优化器状态（约 4~8 倍参数） | 参数 + KV Cache（约 1~2 倍） |
| 优化重点 | 吞吐、多卡并行 | **延迟、并发吞吐、显存利用** |
| 典型工具 | PyTorch + DeepSpeed/FSDP | **vLLM** / TensorRT-LLM / SGLang |

> 📌 关键认知：**推理优化是独立的一门工程**——不是"把训练代码拿来跑一下"就行。

## 三、初识：vLLM 凭什么快（两个核心机制）

### 3.1 PagedAttention（分页注意力）

问题：生成每个 token 都要缓存历史 token 的 Key/Value（**KV Cache**）。传统做法给每个请求**预分配连续大块显存**——请求长短不一，浪费严重（内部碎片），并发上不去。

vLLM 的做法学操作系统：**把 KV Cache 切成固定大小的"页"，按需分配、不连续存放**（虚拟内存翻页的思想）。

| 效果 | 提升 |
|---|---|
| 显存浪费 | 大幅减少（碎片率从 60~80% 降到 4% 以内） |
| 并发数 | 可提升数倍 |

### 3.2 连续批处理（Continuous Batching）

传统批处理：一批请求全部生成完才处理下一批——短请求等长请求，GPU 空转。

**连续批处理**：谁生成完了谁走，新请求随时插进来——GPU 一直有活干。

> 🔥 面试答法："vLLM 快在两件事：**PagedAttention 把 KV Cache 分页管理，显存利用率高、并发多**；**连续批处理让 GPU 始终满载**。相比 HuggingFace 原生推理，吞吐能提升 10 倍以上。"

## 四、运用：Docker 启动 vLLM

### 4.1 下载模型（国内网络）

```bash
# 用 ModelScope（魔搭）下载，国内速度快
pip install modelscope
modelscope download --model Qwen/Qwen2.5-1.5B-Instruct --local_dir ./models/qwen1.5b
```

> 也可以 `huggingface-cli download`，国内需配置镜像。模型越小越容易跑起来——**先用 0.5B/1.5B 的小模型验证流程**，别一上来就 7B/72B。

### 4.2 启动服务

```bash
docker run --gpus all -d \
  -v $(pwd)/models:/models \
  -p 8001:8000 \
  vllm/vllm-openai:latest \
  --model /models/qwen1.5b \
  --served-model-name qwen-local \
  --max-model-len 4096
```

参数说明：

| 参数 | 作用 |
|---|---|
| `--gpus all` | 使用 GPU（没有 GPU 可用 CPU 镜像 + 小模型，慢但能跑通） |
| `--model` | 模型路径 |
| `--max-model-len` | 最大上下文长度（越大越吃显存） |
| `--gpu-memory-utilization` | 显存占用比例（默认 0.9） |

### 4.3 验证：它就是个 OpenAI 接口

```bash
curl http://localhost:8001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-local",
    "messages": [{"role": "user", "content": "用一句话介绍你自己"}]
  }'
```

Python 里也一样——**把 base_url 指过去就行**：

```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:8001/v1", api_key="dummy")

res = client.chat.completions.create(
    model="qwen-local",
    messages=[{"role": "user", "content": "你好"}]
)
print(res.choices[0].message.content)
```

> 🔥 **这就是 vLLM 的杀手级设计**：实现了 OpenAI 兼容协议——**代码一行不用改，只换 base_url**，从"调云端"切换到"调本地"。

## 五、初识：显存怎么估（面试常问）

公式：

```text
显存 ≈ 模型参数 × 精度字节数 + KV Cache + 框架开销
```

| 模型规模 | FP16 参数量 | 大致显存（含 KV） |
|---|---|---|
| 1.5B | 3 GB | 4~6 GB |
| 7B | 14 GB | 16~20 GB |
| 13B | 26 GB | 30~36 GB |
| 70B | 140 GB | 需多卡 / 量化 |

> 📌 所以 7B 模型至少要 16GB 显存的卡（如 4090 24G 可以跑，且能留出并发空间）。**显存不够的三个解法：小模型、量化（INT8/INT4）、多卡张量并行。**

## 六、总结

### 6.1 要点回顾

1. 私有化三动机：**数据安全、成本、可控性**
2. **推理 vs 训练**：推理只有前向、无梯度、显存约为参数的 1~2 倍
3. vLLM 两大机制：**PagedAttention（KV Cache 分页，省显存提并发）+ 连续批处理（GPU 不空转）**
4. 部署关键：Docker 起服务 + **OpenAI 兼容接口**（只改 base_url）
5. 显存估算：参数 × 精度 + KV Cache + 开销；7B ≈ 16~20GB

### 6.2 自测清单

<details>
<summary>Q1：推理和训练的核心区别？</summary>

训练有前向+反向+参数更新，显存需存梯度/优化器状态；推理只有前向，显存主要给参数和 KV Cache，优化目标是延迟和并发。
</details>

<details>
<summary>Q2：PagedAttention 解决了什么问题？</summary>

KV Cache 按固定大小分页存储、可不连续，消除预分配造成的显存碎片，显存利用率大幅提升，从而支持更高并发。
</details>

<details>
<summary>Q3：vLLM 部署后怎么调用？</summary>

它提供 OpenAI 兼容接口，把 SDK 的 base_url 指向部署地址即可，业务代码无需修改。
</details>

<details>
<summary>Q4：7B 模型需要多少显存？</summary>

FP16 参数约 14GB，加 KV Cache 和开销约 16~20GB；显存不够可用量化（INT8/INT4）或多卡。
</details>

### 6.3 面试视角（🔥）

| 面试问法 | 答题要点 |
|---|---|
| vLLM 为什么快？ | PagedAttention 分页管理 KV Cache + 连续批处理，吞吐比 HF 原生高一个数量级 |
| 推理怎么优化延迟/吞吐？ | 批处理、量化、KV Cache 优化、投机解码、多卡并行 |
| 什么时候私有化部署？ | 数据敏感、调用量大、需要可控延迟/版本；否则先用 API |
| KV Cache 是什么？ | 缓存历史 token 的 Key/Value，避免重复计算注意力；占显存随上下文长度增长 |
| 显存不够怎么办？ | 换小模型、量化、减少 max-model-len、张量并行 |

### 6.4 下一步

模型能跑了、服务打包了。最后两步：**把它部署到服务器**，再让 **CI/CD 自动发布**。

---

*本文对应素材：`vibecoding/01课件/docs/07-vllm.md`*
