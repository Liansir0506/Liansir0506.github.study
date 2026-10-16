# 连少的学习笔记 · 博客源码

个人学习博客 —— 记录 AI 应用开发的学习之路。
基于 [Hexo](https://hexo.io/) + [Butterfly](https://butterfly.js.org/) 主题，托管于 GitHub Pages。

- 线上地址：https://liansir0506.github.io/Liansir0506.github.study/
- 内容方向：机器学习 / 深度学习 / NLP / 提示词工程 / RAG / Agent / 工程化实践

## 本地使用

```bash
# 安装依赖
npm install

# 本地预览（默认 http://localhost:4000）
npm run server

# 构建静态文件（输出到 public/）
npm run build

# 新建文章
npx hexo new post "文章标题"
```

## 目录说明

| 路径 | 说明 |
|------|------|
| `source/_posts/` | 文章源码（Markdown） |
| `_config.yml` | Hexo 主配置 |
| `_config.butterfly.yml` | Butterfly 主题配置 |
| `scaffolds/` | 新文章模板 |
| `.github/workflows/pages.yml` | GitHub Actions 自动部署流程 |

## 发布方式

推送到 `main` 分支后，GitHub Actions 自动构建并部署到 GitHub Pages，无需手动操作。
