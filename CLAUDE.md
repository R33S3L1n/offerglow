# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project: OfferGlow Pro

简历 → 网页分身生成器。用户粘贴文本简历，系统用 DeepSeek AI 结构化解析，生成可编辑的个人求职网页，最终发布为专属链接。

**目标：做成可收费的 SaaS 产品。**

## Tech Stack

- Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS
- DeepSeek API（简历结构化解析 + JD 匹配重写）
- Vercel 部署
- Supabase（数据库 + Auth，待接入）
- Stripe（付费，待接入）

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # 根布局
│   ├── page.tsx                # 首页（营销 + 简历输入）
│   ├── globals.css             # Tailwind + 自定义样式
│   ├── editor/page.tsx         # /editor — 编辑器（占位，待实现）
│   ├── p/[id]/page.tsx         # /p/[id] — 公开页面（占位，需 Supabase）
│   └── api/
│       ├── parse-resume/route.ts      # POST — 简历解析（AI + 本地规则）
│       ├── generate-page/route.ts     # POST — 生成完整 HTML 页面
│       ├── publish/route.ts           # POST — 发布（待接入 Supabase）
│       └── rewrite-for-jd/route.ts    # POST — JD 匹配（当前仅本地规则）
├── components/
│   ├── Navbar.tsx
│   ├── HeroSection.tsx
│   ├── ResumeInput.tsx         # 简历文本输入框 + 生成按钮
│   ├── useResumeGenerator.ts   # 核心 hook：调 API → 生成页面
│   ├── WhySection.tsx
│   ├── FeaturesSection.tsx
│   ├── ProcessSection.tsx
│   ├── CtaSection.tsx
│   └── LoadingOverlay.tsx
└── lib/
    ├── types.ts                # MasterProfile, ParseResult 等类型
    ├── parser.ts               # 本地简历解析器（Python 迁移到 TS）
    ├── deepseek.ts             # DeepSeek 客户端 + localRewrite
    └── renderer.ts             # 页面 HTML 生成器（服务端渲染）
```

旧 Python 代码在 `archive/` 目录（仅作参考）。

## Key Architecture Decisions

- **单一解析出口**：前端不再做二次解析。所有简历解析统一在后端 `parser.ts` 完成。前端只负责渲染返回的 `MasterProfile`。
- **双重解析策略**：DeepSeek AI 主解析，本地规则 `localParseResume()` 做降级兜底。AI 失败时自动回退。
- **Schema 统一**：所有组件使用 `src/lib/types.ts` 中的 `MasterProfile` 类型。不再有老字段（`experience: string[]`）和新字段（`experiences: object[]`）的混乱。
- **API Routes 替代 Python**：不再用 Flask/http.server。全部 API 走 Next.js Route Handlers。
- **前后端已分离**：前端 `useResumeGenerator.ts` 只负责调 API 和展示。解析走 `POST /api/parse-resume`，页面 HTML 生成走 `POST /api/generate-page`，渲染逻辑集中在 `src/lib/renderer.ts`。
- **页面渲染当前为服务端 HTML 字符串**：`renderer.ts` 生成完整 HTML 页面字符串返回给前端。编辑器上线后逐步改为 React 组件渲染。

## Current Status (2026-05-17)

### 已完成
- 文本简历粘贴 → AI/本地结构化解析 → 生成网页分身（新窗口预览）
- DeepSeek AI 解析 + 本地规则兜底
- 首页组件化（8 个独立组件）
- 代码结构从 Python 单体 + 80KB HTML 重构为 Next.js 项目
- **前后端分离**：解析和页面生成均在后端 API 完成，前端只负责调接口和展示
- .gitignore / 安全配置完成

### 待实现（按优先级）
1. **Node.js 安装** — 用户电脑目前没有 Node。需要 `brew install node` 然后 `npm install && npm run dev`
2. **旋转 API Key** — 旧 Key 在 git 历史中泄露，需在 DeepSeek 控制台删除并替换
3. **Supabase 接入** — Auth（注册/登录）+ profiles 表 + published_pages 表
4. **`/p/[id]` 公开页** — 从 Supabase 读取并渲染
5. **Stripe 付费** — 免费 1 次 / 付费无限
6. **PDF/DOCX 上传解析** — pdf-parse + mammoth
7. **可视化编辑器** — `/editor` 路由
8. **JD 匹配 AI 重写** — DeepSeek 版 rewrite
9. **多模板切换**
10. **浏览追踪面板**

## Environment Variables

```
DEEPSEEK_API_KEY=   # 在 platform.deepseek.com 获取
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

## Commands

```bash
npm install           # 安装依赖
npm run dev           # 启动开发服务器 (localhost:3000)
npm run build         # 生产构建
```

## User Preferences

- 用户使用中文沟通
- 用户希望做成可收费的 SaaS 产品
- 优先考虑实际可上线的方案，不要过度工程化
- 改动前先问，不要擅自做大范围修改
