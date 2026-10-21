---
title: Git 基础：版本控制与日常命令
date: 2026-10-22 09:00:00
categories:
  - 工程篇
  - AI 工程化
tags:
  - Git
  - 版本控制
  - commit规范
description: 工作区、暂存区、本地库三大区一次讲清，日常六个命令 + 提交规范——工程化的第一步
mathjax: true
---

> **一句话概括**：Git 是给代码装"存档 + 时间机器"——每次提交是一个存档点，随时能回到任何一个版本。
> **这篇有多重要**：📌 —— 基本功。面试不会专门考 Git 命令，但"代码怎么管、怎么协作"问起来不能露怯。
> **前置知识**：无
> **对应素材**：`vibecoding/01课件/docs/01-git.md`

## 一、初识：为什么需要版本控制

没有版本控制的痛点，你一定经历过：

```text
项目_v1.zip
项目_v2_最终版.zip
项目_v2_最终版_真的最终.zip
项目_v2_最终版_修改后_20261020.zip
```

问题：不知道每个版本改了什么、不知道为什么改、改坏了回不去、多人改同一份文件直接覆盖。

**Git 解决的就是这三件事**：

1. **记录历史**：每次提交都有说明、有作者、有时间
2. **随时回退**：回到任何一个历史版本
3. **支持协作**：多人在不同分支开发，最后合并

## 二、初识：三大区（理解这张图，Git 就懂一半）

```text
工作区（Working Directory）      你正在编辑的文件
    ↓ git add
暂存区（Staging Area）           "准备提交"的清单
    ↓ git commit
本地仓库（Repository）           永久存档点
    ↓ git push
远程仓库（Remote）               云端备份 / 团队共享
```

| 区域 | 类比 | 作用 |
|---|---|---|
| 工作区 | 桌面上的草稿 | 你正在改的代码 |
| 暂存区 | "待寄出的文件篮" | 挑出这次要提交的改动 |
| 本地仓库 | 文件柜存档 | 每一次 commit 都是一个快照 |
| 远程仓库 | 云盘备份 | 团队共享、异地备份 |

> 🔥 **为什么要暂存区？**——让你能"只提交一部分改动"。比如你改了 3 个文件，但只有 2 个属于这次功能，就只 add 那 2 个。

## 三、运用：日常六个命令（覆盖 90% 场景）

### 3.1 初始化与查看

```bash
git init                        # 在当前目录创建仓库
git status                      # 看当前状态（哪些文件改了、在哪个区）
git log --oneline               # 看提交历史（一行一个）
git diff                        # 看工作区改了什么
```

### 3.2 提交

```bash
git add file1.py file2.py       # 加入暂存区
git add .                       # 全部加入（注意别把垃圾文件加进去）
git commit -m "feat: 添加登录接口"   # 提交
```

### 3.3 远程

```bash
git remote add origin <仓库地址>    # 关联远程仓库
git push -u origin main            # 首次推送并建立跟踪
git push                            # 之后直接推
git pull                            # 拉取远程更新（fetch + merge）
```

### 3.4 .gitignore：别把垃圾交上去

```text
# .gitignore 示例
__pycache__/
*.pyc
.env              # 密钥！绝不能提交
venv/
node_modules/
data/             # 大数据集通常也不提交
```

> ⚠️ **密钥泄露是工程事故**：API Key、数据库密码只能写在 `.env` 里，并且 `.env` 必须在 `.gitignore` 中。

## 四、运用：提交规范（团队协作的通行证）

好的提交信息长这样：

```text
<type>: <简短说明>

feat: 添加用户注册接口
fix: 修复登录时空密码的校验
docs: 更新 README 部署说明
refactor: 重构检索模块，拆分 chunk 逻辑
test: 补充 RAG 检索的单元测试
```

| 前缀 | 含义 |
|---|---|
| `feat` | 新功能 |
| `fix` | 修 bug |
| `docs` | 文档 |
| `refactor` | 重构（不改功能） |
| `test` | 测试 |
| `chore` | 杂活（构建、依赖） |

> 📌 为什么规范重要：**面试官会看你的 GitHub 提交记录**。一串 "update"、"fix bug"、"1" 的提交，和规范的 feat/fix 记录，专业度完全不同。
>
> 而且规范的提交信息能直接生成变更日志（CHANGELOG），也是团队协作的基本礼貌。

## 五、总结

### 5.1 要点回顾

1. Git 解决三件事：**记录历史、随时回退、支持协作**
2. 三大区：**工作区 →（add）→ 暂存区 →（commit）→ 本地库 →（push）→ 远程**
3. 日常六命令：`status / add / commit / log / push / pull`
4. `.gitignore` 必须忽略：`__pycache__`、`venv`、`node_modules`、**`.env`（密钥）**
5. 提交规范：`feat / fix / docs / refactor / test / chore` + 简短说明

### 5.2 自测清单

<details>
<summary>Q1：暂存区的作用是什么？</summary>

让你能选择性地提交：把这次功能相关的改动 add 进去，不相关的（调试代码、临时文件）先不提交。
</details>

<details>
<summary>Q2：.gitignore 里最不能漏的是什么？</summary>

.env（含密钥、密码的文件）——一旦提交并推到公开仓库，密钥就泄露了，必须立即吊销更换。
</details>

<details>
<summary>Q3：commit message 的常见前缀？</summary>

feat（新功能）、fix（修复）、docs（文档）、refactor（重构）、test（测试）、chore（杂项）。
</details>

### 5.3 面试视角（📌）

| 面试问法 | 答题要点 |
|---|---|
| Git 的工作流程？ | 工作区修改 → add 到暂存区 → commit 到本地库 → push 到远程 |
| 怎么保证代码质量从提交开始？ | 提交规范（feat/fix）、小步提交、提交前自测、CI 检查 |
| 密钥怎么管理？ | .env + .gitignore；CI/CD 用环境变量/secret 注入 |
| Git 和 SVN 的区别？ | 分布式 vs 集中式；Git 本地有完整历史，可离线提交 |

### 5.4 下一步

一个人用 Git 只是"存档"，多人才是它的主战场——下一篇：**分支、PR 与回滚**。

---

*本文对应素材：`vibecoding/01课件/docs/01-git.md`*
