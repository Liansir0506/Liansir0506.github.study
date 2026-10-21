---
title: 部署上线：从本地到生产服务器
date: 2026-10-22 13:00:00
categories:
  - 工程篇
  - AI 工程化
tags:
  - 部署
  - 服务器
  - SSH
  - Nginx
description: 买服务器、配安全组、装 Docker、跑起服务——把项目真正变成"别人能访问"的网站
mathjax: true
---

> **一句话概括**：部署就是"把本地跑通的服务，搬到公网服务器上，让它 7×24 小时稳定运行"。
> **这篇有多重要**：📌 —— 面试必问"你这个项目部署在哪、怎么部署的"；没部署过的项目等于没上线。
> **前置知识**：eng-06 的 Docker、eng-03 的 FastAPI
> **对应素材**：`vibecoding/01课件/docs/08-deploy.md`

## 一、初识：一次完整的上线链路

```text
用户浏览器
   ↓ 域名解析（DNS）
Nginx（反向代理 + HTTPS + 静态资源）
   ↓
FastAPI 服务（容器）
   ↓
向量库 / 数据库 / 模型服务
```

| 组件 | 作用 |
|---|---|
| **服务器** | 云主机（阿里云/腾讯云，2C4G 起步） |
| **安全组/防火墙** | 开放 22（SSH）、80（HTTP）、443（HTTPS），其余关闭 |
| **Nginx** | 反向代理、HTTPS、静态文件 |
| **Docker** | 跑服务容器 |
| **域名 + 证书** | 让用户记得住、访问安全 |

## 二、运用：服务器准备四步

### 2.1 第一步：买服务器与安全组

- 云厂商选一台（学习阶段 2C4G 够用）
- 系统选 Ubuntu 22.04
- **安全组只开必要端口**：22 / 80 / 443

> ⚠️ 不要把数据库端口（3306/5432）直接暴露公网——这是最常见的被黑原因。

### 2.2 第二步：SSH 登录

```bash
ssh root@<服务器IP>
# 首次登录后建议：
# 1. 创建普通用户（别一直用 root）
# 2. 配置 SSH 密钥登录，禁用密码登录
```

### 2.3 第三步：安装 Docker

```bash
# 国内服务器先配镜像加速器（云厂商一般提供）
curl -fsSL https://get.docker.com | sh
docker --version
```

### 2.4 第四步：上传代码

| 方式 | 说明 |
|---|---|
| **git clone**（推荐） | 服务器直接拉仓库，更新方便 |
| scp/rsync | 传本地目录 |
| CI/CD 自动部署 | 推送即部署（第 9 章） |

## 三、运用：用 Compose 起服务

服务器上的 `compose.yaml`（prod 版）：

```yaml
services:
  api:
    image: registry.cn-hangzhou.aliyuncs.com/you/app:v1   # 或 build: .
    ports:
      - "127.0.0.1:8000:8000"      # 只监听本地，由 Nginx 转发
    env_file: .env.prod             # 生产配置
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs            # 日志持久化

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./certs:/etc/nginx/certs
    depends_on:
      - api
```

```bash
docker compose up -d
docker compose ps
docker compose logs -f api
```

> 📌 关键设计：**API 只监听 127.0.0.1**，外部只能通过 Nginx 进来——这样 HTTPS、限流、鉴权都能在网关统一做。

### 3.1 Nginx 反向代理配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://api:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

> 配好 HTTPS（Let's Encrypt 免费证书）后，浏览器地址栏变锁头——**这是"上线"和"自己玩玩"的分界线**。

## 四、初识：上线后的四件事

| 事项 | 做法 |
|---|---|
| **进程守护** | Docker `restart: unless-stopped`，崩了自动拉起 |
| **日志** | 容器日志 + 文件日志，出问题能查 |
| **监控告警** | 至少监控：接口存活（健康检查）、错误率、响应时间 |
| **数据备份** | 数据库/向量库定期备份（定时任务 + 异地存一份） |

> 🔥 真实上线最容易被忽略的是**日志和监控**：没日志，出问题只能猜；没监控，用户都跑光了你才知道。

## 五、初识：上线检查清单

上线前过一遍这张表：

- [ ] 生产配置正确（数据库地址、Key、模型地址都是 prod 的）
- [ ] `.env` 不在代码仓库里，由服务器/CI 注入
- [ ] 测试全部通过
- [ ] 健康检查接口 `/health` 可用
- [ ] 日志能看到、能定位
- [ ] 有回滚方案（镜像打 tag，出问题切回上一版）
- [ ] 安全组只开必要端口
- [ ] 依赖的服务（数据库/向量库/模型）都通

## 六、总结

### 6.1 要点回顾

1. 上线链路：**域名 → Nginx → 容器服务 → 数据库/模型**
2. 服务器准备：买机器、安全组只开 22/80/443、SSH 密钥登录、装 Docker
3. Compose 部署：API 只监听 127.0.0.1，由 Nginx 统一入口
4. 上线后四件事：**守护、日志、监控、备份**
5. 上线前走检查清单：配置、密钥、测试、健康检查、回滚方案

### 6.2 自测清单

<details>
<summary>Q1：为什么数据库端口不能暴露公网？</summary>

公网扫描器会持续尝试爆破数据库账号密码，一旦暴露极易被入侵、拖库。数据库只应内网访问。
</details>

<details>
<summary>Q2：为什么让 API 只监听 127.0.0.1？</summary>

只允许同机 Nginx 访问，外部流量统一从网关进——便于做 HTTPS、鉴权、限流和日志。
</details>

<details>
<summary>Q3：上线后最容易被忽略的两件事？</summary>

日志和监控。没有日志无法定位问题，没有监控无法及时发现问题。
</details>

### 6.3 面试视角（📌）

| 面试问法 | 答题要点 |
|---|---|
| 你的项目怎么部署的？ | 云服务器 + Docker Compose + Nginx 反向代理 + HTTPS；CI/CD 自动发布 |
| 部署遇到过什么问题？ | 环境依赖、端口/安全组、配置错误、显存不足、跨域——具体讲一个排查过程最好 |
| 怎么保证服务稳定？ | 健康检查、进程守护、日志监控告警、限流、回滚方案、数据备份 |
| 怎么做零停机发布？ | 多副本滚动更新（蓝绿/金丝雀）、健康检查后切流量 |

### 6.4 下一步

最后一篇：让"部署"这件事也从手工变成自动——**CI/CD**。

---

*本文对应素材：`vibecoding/01课件/docs/08-deploy.md`*
