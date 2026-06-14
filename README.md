# 美妆智能体

美妆文案合规审查工具。输入文案，AI自动检测错别字、违禁词、夸大宣传，并给出修改建议。

## 部署

```bash
npm install
vercel deploy
```

环境变量：`DASHSCOPE_API_KEY`（阿里云DashScope API密钥）

## 架构

- `api/analyze.js` — Vercel Serverless Function（AI分析）
- `index.html` — 单页UI
- `vercel.json` — 路由配置
