---
title: Docker：镜像、容器与 Compose
date: 2026-10-22 12:00:00
categories:
  - 工程篇
  - AI 工程化
tags:
  - Docker
description: 镜像和容器的关系、Dockerfile 多阶段构建、Compose 一键起多个服务——解决"在我电脑上能跑"
mathjax: true
---

> **一句话概括**：Docker 把"代码 + 运行环境"打包成一个镜像，在哪跑都一样——彻底解决"在我电脑上明明能跑"。
> **这篇有多重要**：🔥 —— 部署的必备技能；AI 应用依赖多（模型、向量库），不用 Docker 环境根本对不齐。
> **前置知识**：eng-03/04 的 FastAPI 与 RAG 服务
> **对应素材**：`vibecoding/01课件/docs/06-docker.md`

## 一、初识：镜像 vs 容器

| 概念 | 是什么 | 类比 |
|---|---|---|
| **镜像（Image）** | 只读模板：代码 + 依赖 + 系统环境 | 装机用的 ISO 光盘 |
| **容器（Container）** | 镜像运行起来的实例 | 装好的电脑 |
| **Dockerfile** | 构建镜像的"配方文件" | 装机的步骤说明书 |
| **仓库（Registry）** | 存镜像的地方（Docker Hub） | 应用商店 |

> 一句话：**镜像是"类"，容器是"对象"**（用编程的话说）。一个镜像可以跑出多个容器。

### 1.1 为什么 AI 项目特别需要 Docker

| 痛点 | Docker 解决 |
|---|---|
| 依赖地狱（torch/cuda/版本冲突） | 环境固化在镜像里 |
| 我电脑能跑，服务器不行 | 同一镜像处处一致 |
| 部署步骤全靠文档、容易漏 | `docker compose up -d` 一键起 |
| 换机器要重装一遍 | 拉镜像就行 |

## 二、运用：基本命令（八个够用）

```bash
docker pull python:3.11-slim        # 拉镜像
docker images                        # 看本地镜像
docker run -d -p 8000:8000 myapp     # 跑容器（-d 后台，-p 端口映射）
docker ps                            # 看运行中的容器
docker logs -f <容器ID>              # 看日志
docker exec -it <容器ID> bash        # 进容器内部
docker stop <容器ID>                 # 停
docker rm / docker rmi               # 删容器 / 删镜像
```

### 2.1 端口映射（最容易绕晕的点）

```bash
docker run -p 8000:8000 myapp
#          ↑宿主机端口 : ↑容器内端口
```

容器是隔离的——**容器里的 8000 端口外面访问不到**，必须映射出来。浏览器访问 `localhost:8000` → 转发到容器内 8000。

## 三、运用：Dockerfile（用多阶段构建）

一个 FastAPI 应用的 Dockerfile：

```dockerfile
# ---------- 阶段一：builder（装依赖） ----------
FROM python:3.11-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---------- 阶段二：runtime（只拿装好的依赖） ----------
FROM python:3.11-slim

WORKDIR /app
COPY --from=builder /install /usr/local      # 只复制安装结果
COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 3.1 多阶段构建好在哪

| 单阶段 | 多阶段 |
|---|---|
| 镜像里带着编译工具、缓存 | 只保留运行需要的 |
| 体积可能 2GB+ | 可以缩到 500MB 以内 |
| 攻击面大 | 更小更安全 |

> 🔥 **`--host 0.0.0.0` 必须写**：容器里 uvicorn 默认只监听 127.0.0.1（容器内部），外部访问不到。0.0.0.0 才对外。

### 3.2 构建与运行

```bash
docker build -t myapp:v1 .          # 构建镜像（. 是上下文目录）
docker run -d -p 8000:8000 \
  -e LLM_API_KEY=sk-xxx \           # 环境变量注入（不要写进 Dockerfile！）
  myapp:v1
```

## 四、运用：Docker Compose（一键起多个服务）

AI 应用往往不止一个服务：**FastAPI + 向量库 + Redis + Nginx**。一个个 `docker run` 太麻烦。

`compose.yaml`：

```yaml
services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - LLM_API_KEY=${LLM_API_KEY}     # 从 .env 读取，不写死
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data               # 数据持久化

volumes:
  redis_data:
```

```bash
docker compose up -d          # 一键启动全部
docker compose ps             # 看状态
docker compose logs -f api    # 看某个服务日志
docker compose down           # 全部停止（加 -v 会删数据卷，慎用）
```

> 📌 `restart: unless-stopped` 很重要——服务器重启后容器自动起来，不用人工干预。

## 五、初识：镜像怎么瘦身（AI 项目尤其重要）

| 手段 | 效果 |
|---|---|
| 基础镜像用 `slim`/`alpine` | 省几百 MB |
| 多阶段构建 | 不带编译工具 |
| `.dockerignore` 排除测试/数据/`.git` | 减小构建上下文 |
| 合并 RUN 指令、清理缓存 | 减少层数 |

`.dockerignore` 示例：

```text
.git
__pycache__
tests/
data/
*.md
.env
```

> ⚠️ **`.env` 绝对不能进镜像**——镜像可以推送到仓库，密钥就泄露了。

## 六、总结

### 6.1 要点回顾

1. **镜像是模板、容器是实例**；一次构建，处处运行
2. 八个常用命令：`pull / images / run / ps / logs / exec / stop / rm`
3. **端口映射 `-p 宿主机:容器`**；容器内要监听 `0.0.0.0`
4. Dockerfile：**多阶段构建**（builder 装依赖 → runtime 只拿结果）
5. **Compose**：一个 yaml 编排多个服务，`docker compose up -d` 一键起
6. 安全：密钥用环境变量注入，`.env` 进 `.dockerignore`

### 6.2 自测清单

<details>
<summary>Q1：镜像和容器的关系？</summary>

镜像是只读模板（代码+依赖+环境），容器是镜像运行起来的实例；一个镜像可以启动多个容器。
</details>

<details>
<summary>Q2：为什么要多阶段构建？</summary>

只在最终镜像里保留运行所需内容，去掉编译工具和缓存，镜像更小、更安全、拉取更快。
</details>

<details>
<summary>Q3：docker run -p 8000:8000 是什么意思？</summary>

把宿主机的 8000 端口映射到容器的 8000 端口；容器内服务还要监听 0.0.0.0 才能被外部访问。
</details>

<details>
<summary>Q4：Compose 解决什么问题？</summary>

多服务编排：用一个 yaml 定义所有服务、依赖关系、网络与数据卷，一条命令启动/停止整套环境。
</details>

### 6.3 面试视角（🔥）

| 面试问法 | 答题要点 |
|---|---|
| Docker 和虚拟机的区别？ | 容器共享宿主机内核、更轻量、秒级启动；VM 有完整操作系统、更重 |
| 镜像怎么减小体积？ | slim 基础镜像、多阶段构建、清理缓存、.dockerignore |
| 多服务怎么部署？ | Docker Compose 编排（api/向量库/redis），depends_on + restart 策略 |
| 容器里数据会丢吗？ | 容器可删，数据要用 volume 持久化 |
| 怎么做端口/密钥管理？ | -p 映射 + 环境变量注入（.env / compose environment），不写进镜像 |

### 6.4 下一步

应用打包好了。如果要用**自己的模型**（而不是调云端 API）——下一篇：**vLLM 私有化部署**。

---

*本文对应素材：`vibecoding/01课件/docs/06-docker.md`*
