# OfferGlow Pro

将简历文字一键转化为极具质感的求职网页。支持图文混排、模块化编辑、专属链接分享。

## 技术栈

- **前端**: Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS
- **AI**: DeepSeek API（结构化简历解析 + JD 匹配重写）
- **部署**: Vercel
- **数据库**: Supabase（待接入）

## 项目结构

```
├── src/
│   ├── app/
│   │   ├── layout.tsx              # 根布局
│   │   ├── page.tsx                # 首页（不含编辑器）
│   │   ├── globals.css             # 全局样式 + Tailwind
│   │   ├── editor/
│   │   │   └── page.tsx            # /editor 路由（待实现）
│   │   ├── p/[id]/
│   │   │   └── page.tsx            # /p/[id] 公开页面（待接入Supabase）
│   │   └── api/
│   │       ├── parse-resume/route.ts   # POST 简历解析
│   │       ├── publish/route.ts        # POST 发布页面
│   │       └── rewrite-for-jd/route.ts # POST JD匹配重写
│   ├── components/                 # React 组件
│   │   ├── Navbar.tsx
│   │   ├── HeroSection.tsx
│   │   ├── ResumeInput.tsx
│   │   ├── useResumeGenerator.ts   # 简历生成 hook
│   │   ├── WhySection.tsx
│   │   ├── FeaturesSection.tsx
│   │   ├── ProcessSection.tsx
│   │   ├── CtaSection.tsx
│   │   └── LoadingOverlay.tsx
│   └── lib/
│       ├── types.ts                # 共享类型定义
│       ├── parser.ts               # 本地简历解析器（从Python迁移）
│       └── deepseek.ts             # DeepSeek API 客户端
├── archive/                        # 旧版代码（仅作参考）
├── .gitignore
├── .env.example
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── postcss.config.mjs
└── vercel.json
```

## 已实现

- 文本简历粘贴 → AI/本地结构化解析
- 生成网页分身（新窗口预览）
- DeepSeek AI 解析 + 本地规则兜底降级
- 首页组件化（Navbar / Hero / Why / Features / Process / CTA）

## 待实现

- 用户注册/登录（Supabase Auth）
- 付费系统（Stripe）
- 公开发布 `/p/[id]` 页面（Supabase 持久化）
- PDF/DOCX 文件上传解析
- JD 匹配 AI 重写
- 浏览追踪面板
- 多模板切换

## 本地开发

```bash
npm install
npm run dev
```

访问 http://localhost:3000

## 环境变量

创建 `.env.local`（不提交到 git）：

```bash
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

## Vercel 部署

在 Vercel 控制台设置对应环境变量，Framework 选择 Next.js，直接导入仓库即可。
