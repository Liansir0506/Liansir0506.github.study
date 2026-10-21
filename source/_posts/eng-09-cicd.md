---
title: CI/CD：自动化发布流水线
date: 2026-10-22 13:30:00
categories:
  - 工程篇
  - AI 工程化
tags:
  - CI/CD
description: 从"手工上线手抖"到"推送即发布"——流水线五要素、GitHub Actions 实战（这个博客就是活例子）
mathjax: true
---

> **一句话概括**：CI/CD 把"拉代码 → 装依赖 → 跑测试 → 构建 → 部署"这条手工流水线自动化——推一下代码，剩下的机器干。
> **这篇有多重要**：📌 —— 工程化的标志性能力；面试问"你们怎么发布"，答 CI/CD 比答"手动传服务器"高一个段位。
> **前置知识**：eng-08 的部署流程、eng-05 的测试
> **对应素材**：`vibecoding/01课件/docs/09-cicd.md`

## 一、初识：手工发布的四个痛点

| 痛点 | 表现 |
|---|---|
| **容易漏步骤** | 忘了跑测试、忘了更新配置 |
| **容易出错** | 传错环境、敲错命令 |
| **不可追溯** | 谁发的、发了什么版本、什么时候发的，全靠记忆 |
| **回滚困难** | 出问题只能手忙脚乱地"再改回去" |

**CI/CD** 就是把这套流程写成流水线脚本，由平台自动执行。

| 缩写 | 全称 | 干什么 |
|---|---|---|
| **CI** | Continuous Integration（持续集成） | 代码合并时自动跑测试、检查 |
| **CD** | Continuous Delivery/Deployment（持续交付/部署） | 自动构建并部署到环境 |

## 二、初识：流水线的五个要素

```text
① 触发（Trigger）：什么时候跑？—— push / PR / 打 tag / 定时
   ↓
② 构建（Build）：装依赖、编译、打镜像
   ↓
③ 测试（Test）：单元测试、代码检查
   ↓
④ 部署（Deploy）：发布到 test / prod
   ↓
⑤ 通知（Notify）：成功/失败通知到群
```

> 📌 任何 CI/CD 系统（GitHub Actions / GitLab CI / Jenkins）本质都是这五件事，只是配置写法不同。

## 三、运用：GitHub Actions 实战

**这个博客就是活例子**——前面几篇的自动部署，用的就是 GitHub Actions。

### 3.1 配置文件长什么样

仓库里 `.github/workflows/deploy.yml`：

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]          # ① 触发：推送到 main 就跑

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4        # 拉代码

      - uses: actions/setup-node@v4      # ② 构建：装环境
        with:
          node-version: 20
          cache: npm

      - run: npm ci                       # 装依赖
      - run: npm run build                # 构建

      # ③ 测试（本项目省略了，正规项目在这里跑 pytest/npm test）
      # - run: npm test

      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./public

  deploy:
    needs: build                          # ④ 部署：构建成功才部署
    runs-on: ubuntu-latest
    steps:
      - uses: actions/deploy-pages@v4
```

### 3.2 核心概念

| 概念 | 含义 |
|---|---|
| **workflow** | 一个流水线（一个 yml 文件） |
| **on** | 触发器（push / PR / 手动 workflow_dispatch） |
| **job** | 一组步骤，默认并行；`needs` 声明依赖 |
| **step** | 单个动作（`uses` 用现成 action，`run` 跑命令） |
| **secrets** | 加密的密钥（在仓库 Settings 配置，yml 里用 `${{ secrets.XXX }}`） |

> 🔥 **密钥管理是重点**：数据库密码、API Key 都放在 `secrets` 里，yml 文件只引用——**绝不能把密钥写进配置文件**（仓库是公开的）。

### 3.3 三种典型用法

| 用法 | 触发条件 | 做什么 |
|---|---|---|
| **PR 检查** | `pull_request` | 跑测试、lint，不通过不让合并 |
| **自动部署** | push 到 main | 构建 + 部署（本站用法） |
| **打版本发布** | push tag `v*` | 构建镜像推送仓库 + 发 release |

## 四、初识：开发者的四条配合职责

CI/CD 不是运维一个岗位的事，开发者要配合：

| 职责 | 说明 |
|---|---|
| **保证本地能过** | 提交前本地跑通测试，别把流水线当第一个测试环境 |
| **写清变更** | 规范 commit message（eng-00）——发布记录直接由它生成 |
| **管好配置** | 配置走环境变量/secrets，不硬编码 |
| **对失败负责** | 流水线红了要立刻看、立刻修，不能"红着继续开发" |

## 五、初识：平台怎么选

| 平台 | 特点 | 适合 |
|---|---|---|
| **GitHub Actions** | 与 GitHub 深度集成、免费额度够用、生态丰富 | 开源项目、GitHub 托管 |
| GitLab CI | 内置 .gitlab-ci.yml、自建友好 | GitLab 用户、企业内网 |
| Jenkins | 老牌、插件多、可深度定制 | 大型企业、复杂流水线 |
| 云厂商流水线 | 与云资源集成（阿里云效/腾讯 CODING） | 用该云的全家桶 |

> 学习阶段强烈建议用 **GitHub Actions**——它就在你天天用的 GitHub 里，配一次就会了。

## 六、总结

### 6.1 要点回顾

1. 手工发布四痛点：漏步骤、易出错、不可追溯、难回滚
2. **CI = 自动集成+测试；CD = 自动交付/部署**
3. 流水线五要素：**触发 → 构建 → 测试 → 部署 → 通知**
4. GitHub Actions 核心：workflow / on / job / step / **secrets**
5. 开发者职责：本地先过、规范提交、配置分离、对红流水线负责

### 6.2 自测清单

<details>
<summary>Q1：CI 和 CD 分别是什么？</summary>

CI（持续集成）：代码合并时自动构建和测试，尽早发现集成问题；CD（持续交付/部署）：自动把通过测试的版本发布到环境。
</details>

<details>
<summary>Q2：流水线五要素？</summary>

触发、构建、测试、部署、通知。
</details>

<details>
<summary>Q3：密钥为什么要放 secrets？</summary>

secrets 加密存储、运行时注入；写进 yml 会随仓库泄露（尤其公开仓库），造成安全事故。
</details>

<details>
<summary>Q4：流水线红了怎么办？</summary>

立即查看失败日志修复；红着的流水线不能再往上合并新代码（否则问题叠加、无法定位）。
</details>

### 6.3 面试视角（📌）

| 面试问法 | 答题要点 |
|---|---|
| 你们怎么发布？ | CI/CD 流水线：push 触发 → 构建测试 → 部署；含回滚与通知 |
| CI/CD 带来什么价值？ | 减少人为错误、缩短发布周期、质量前置、发布可追溯 |
| 怎么做多环境发布？ | 分支/tag 对应环境，secrets 分环境管理，先 test 后 prod |
| 流水线失败率怎么降？ | 本地先验、缓存依赖、失败快速反馈、限制流水线复杂度 |
| 灰度发布怎么实现？ | 多副本 + 流量权重（Nginx/K8s）+ 健康指标观测后再全量 |

### 6.4 模块小结：AI 工程化 10 篇完结

| 篇目 | 一句话 |
|---|---|
| eng-00 Git 基础 | 三大区 + 六命令 + 提交规范 |
| eng-01 Git 协作 | 分支 / PR / 冲突 / revert |
| eng-02 VibeCoding 🔥 | 五步循环 + CLAUDE.md |
| eng-03 FastAPI 🔥 | 接口 + Pydantic + 异步 |
| eng-04 RAG 工程 🔥 | 索引管线 + 查询管线 |
| eng-05 测试 | 金字塔 + mock + 三环境 |
| eng-06 Docker 🔥 | 镜像容器 + 多阶段构建 + Compose |
| eng-07 vLLM 🔥 | PagedAttention + OpenAI 兼容部署 |
| eng-08 部署 | Nginx + Compose + 日志监控 |
| eng-09 CI/CD | 五要素 + GitHub Actions |

下一个模块：**项目篇**——把前面所有能力拼成三个完整项目（RAG 问答系统 / 投满分 / 智慧旅游 Agent）。

---

*本文对应素材：`vibecoding/01课件/docs/09-cicd.md`*
