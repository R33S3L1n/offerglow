# Codex Handoff Notes

最后更新：2026-05-25

## 项目背景

OfferGlow Pro 是一个“简历文本 -> AI 结构化解析 -> 可编辑个人求职网页 -> 发布公开链接”的 SaaS 原型。

当前项目路径：

```bash
/Users/bing/Documents/New project
```

用户目标：

- 做成可收费 SaaS 产品。
- Vercel 只用于临时给朋友看效果，正式发布后不依赖 Vercel。
- 浏览量只做“打开次数”，不统计具体访客，避免隐私/法律风险。
- 保持纯文本简历输入，不做 PDF/DOCX 上传。
- 暂不做 OG 图、移动端深度适配。
- 正式发布后考虑小程序形态，更方便传播和使用。
- 开发节奏：每做完一步先停下来给用户确认，再继续下一步。

## 本轮对话里做过的检查

最初检查项目后确认：

- 项目是 Next.js 14 App Router + React 18 + TypeScript + Tailwind。
- DeepSeek 用于简历结构化解析和 JD 匹配改写。
- 草稿目前存在 localStorage。
- 图片存在 IndexedDB。
- 发布页目前通过 Vercel KV 或本地内存兜底。
- `/dashboard`、`/editor`、`/p/[id]`、`/api/visits/[id]` 等功能代码已经存在。
- README/CLAUDE.md 的状态有些过时，源码进度比文档更靠前。

发现当时项目无法构建：

```bash
npm run build
```

最初失败点是 `src/components/editor/EditablePage.tsx` 里一段坏掉的 TSX：SVG path 被截断，技能标签区域重复/残缺。

## 已完成修复

### 1. 修复构建失败

文件：

- `src/components/editor/EditablePage.tsx`

修复内容：

- 清理第 704 附近坏掉的 TSX。
- 恢复“工作经历/教育背景”添加按钮结构。
- 恢复“专业技能”标签区域结构。
- 把 React 里的 `class` 改成 `className`。

验证：

```bash
npm run build
```

结果：通过。

### 2. 删除临时/敏感文件

删除：

- `.env.local.save`
- `fix.js`
- `fix-rich-text.js`

原因：

- `.env.local.save` 可能包含旧 API Key，有安全风险。
- `fix.js` 和 `fix-rich-text.js` 是临时修复脚本，不应留在项目根目录。

验证：

```bash
npm run build
```

结果：通过。

### 3. 跑通 MVP 冒烟链路

检查过：

- `/`
- `/dashboard`
- `/editor`
- `/api/parse-resume`
- `/api/generate-page`
- `/api/publish`
- `/p/[id]`
- `/api/visits/[id]`

发现并修复：

- 本地发布后 `/p/[id]` 一开始 404。
- 原因：本地开发时 API route 和 page route 的内存 Map 不稳定共享。
- 修复：`src/lib/kv.ts` 把本地 fallback 存储挂到 `globalThis`。

结果：

- 本地发布后可以打开 `/p/[id]`。
- 打开发布页后浏览次数从 `0` 变成 `1`。

### 4. 修复模板颜色切换无效

文件：

- `src/components/editor/EditablePage.tsx`
- `tailwind.config.ts`

问题：

- 编辑器预览容器使用 `theme-${profile.theme}` 动态 class。
- Tailwind 对动态 class 不稳定，导致点颜色按钮状态变了但主题样式没有切换。

修复：

- 在 `EditablePage.tsx` 中建立显式主题映射：
  - `theme-warm`
  - `theme-minimal`
  - `theme-dark`
  - `theme-lilac`
  - `theme-ocean`
- 在 `tailwind.config.ts` safelist 这 5 个主题类。

验证：

```bash
npm run build
```

结果：通过。

### 5. 修复发布页 XSS 风险

文件：

- `src/app/api/publish/route.ts`
- `src/components/editor/PublishButton.tsx`
- `src/components/editor/EditablePage.tsx`
- `src/lib/renderer.ts`

问题：

- 旧发布链路允许前端直接提交整段 HTML。
- 编辑器使用 `contentEditable` 和 `dangerouslySetInnerHTML`。
- 发布页 `/p/[id]` 再用 `dangerouslySetInnerHTML` 渲染。
- 这会导致用户输入 `<script>`、`onerror`、`onclick` 等内容时存在 XSS 风险。

修复：

- 发布 API 不再接收任意 `html`。
- 发布按钮改为提交结构化 `profile`。
- 服务端 `publish/route.ts` 调用 `normalizeProfile()` 和 `renderPageHtml()` 统一生成发布 HTML。
- `renderer.ts` 对用户内容做：
  - 去除 `<script>`/`<style>` 块。
  - 去除 HTML 标签。
  - HTML 转义。
- 公开页去掉编辑器残留的 `contenteditable`、`onclick` 等。

验证：

- 用包含 `<script>`、`onerror`、`onclick` 的恶意 profile 进行发布测试。
- 公开页没有保留可执行脚本/事件属性。
- `npm run build` 通过。

代价：

- 为了安全，发布页暂时会把富文本 HTML 样式压成纯文本。
- 如果以后要保留加粗/颜色，需要做白名单 sanitizer。

### 6. 修复头像图片上传

文件：

- `src/components/editor/EditablePage.tsx`
- `src/lib/imageStorage.ts`

修复：

- 点击 hero 头像图可以选择图片。
- 图片通过 `FileReader` 读取为 data URL。
- 图片数据存 IndexedDB。
- 草稿里保存 `heroImage` key。
- 当前编辑器即时显示 `heroImageData`。

验证：

```bash
npm run build
```

结果：通过。

### 7. 修复所有图片模块可替换

用户指出问题：

- 只有 hero 可以换图。
- 项目卡片、自定义图文卡片、自定义大图都不能替换图片。
- 新增自定义板块中的图文卡片和大图也必须能自由替换。

修复文件：

- `src/components/editor/EditablePage.tsx`
- `src/lib/types.ts`
- `src/lib/renderer.ts`

修复内容：

- 增加统一图片上传机制 `uploadImage()`。
- 限制图片类型：
  - PNG
  - JPG/JPEG
  - WebP
  - GIF
- 支持以下模块点击替换图片：
  - Hero 头像图。
  - 项目卡片图片。
  - 自定义图文卡片图片。
  - 自定义大图展现图片。
  - 新增后的图文卡片/大图同样可替换。
- 图片数据存 IndexedDB。
- 草稿中只存图片 key，避免 localStorage 被塞爆。
- 编辑器加载草稿时从 IndexedDB 读回图片 data URL。
- 发布页支持安全图片 data URL 和 http/https 图片地址。

新增/扩展类型：

- `StructuredEntry.image`
- `StructuredEntry.imageData`
- `MasterProfile.projectImages`
- `MasterProfile.projectImageData`
- `CustomBlock.imageData`

验证：

```bash
npm run build
```

结果：通过。

### 8. 修复富文本工具条在下方模块不出现

文件：

- `src/components/editor/RichToolbar.tsx`

问题：

- 富文本工具条使用 `position: fixed`。
- 但坐标计算时错误加了 `window.scrollY`。
- 用户滚动到 hero 下面后，工具条会飞出视口，看起来像“只有 hero 有富文本，其他地方没有”。

修复：

- 工具条坐标改成视口坐标。
- 增加上下/左右边界保护。

结果：

- 任意模块里的 `contentEditable` 文本选中后，工具条都应该显示在选区附近。

验证：

```bash
npm run build
```

结果：通过。

## 当前本地服务

最近启动地址：

```text
http://localhost:3000
```

注意：

- 多次运行 `npm run build` 后，Next dev server 有时会出现 `.next` 缓存混乱。
- 每次 build 后建议重启 dev server。

## 目前已知未完成/仍需处理的问题

### P0/P1

1. **正式持久化还未接入**
   - 草稿仍在 localStorage。
   - 图片在 IndexedDB。
   - 发布页在 Vercel KV 或本地 globalThis 内存兜底。
   - 正式 SaaS 需要 Supabase。

2. **发布页富文本丢失**
   - 为了先修 XSS，发布页现在会把富文本压成纯文本。
   - 后续如果想保留加粗/颜色，需要白名单 sanitizer。

3. **编辑器主文件过大**
   - `EditablePage.tsx` 非常大，超过 1000 行。
   - 短期可以继续用，但中期要拆成：
     - `EditableHero`
     - `EditableTimeline`
     - `EditableProjects`
     - `EditableCustomSections`
     - `EditableContact`
     - 图片上传 hook

### P2

4. **首页 CTA 仍是假入口**
   - `Navbar.tsx` 里的“免费开始”目前还是 `href="#"`。
   - 应改为滚动/聚焦到简历输入框。

5. **访问次数不是精准访客数**
   - 当前是页面打开次数。
   - 刷新、机器人、预取都可能增加。
   - 用户已确认只要纯次数，不统计具体访客。
   - dashboard 文案最好写成“页面打开次数”。

6. **图片发布策略还只是临时适配**
   - 现在发布页可携带 data URL，适合临时展示。
   - 正式产品应把图片放到 Supabase Storage / 对象存储，发布页只存 URL。

7. **移动端暂不做**
   - 当前编辑器移动端体验未完善。

8. **PDF/DOCX 上传不做**
   - 用户明确决定只保留纯文本输入。

9. **OG 图不做**
   - 用户明确决定暂不做。

## 建议后续开发计划

### 第一步：继续补 MVP 体验漏洞

建议下一步优先修：

1. 首页“免费开始”按钮：
   - 不要 `href="#"`。
   - 改为滚动到简历输入框并 focus。

2. Dashboard 文案：
   - 把“浏览量”改成“页面打开次数”。

3. 再完整手测：
   - 输入简历。
   - 生成草稿。
   - 进入编辑器。
   - 切主题。
   - 改文字。
   - 富文本选区。
   - 换 hero 图。
   - 换项目图。
   - 新增自定义图文卡片并换图。
   - 新增自定义大图并换图。
   - 发布。
   - 打开 `/p/[id]`。
   - dashboard 看打开次数。

### 第二步：Supabase 接入

不要最后才接 Supabase。建议在 Stripe 和小程序之前接。

建议表：

- `profiles`
- `drafts`
- `published_pages`
- `page_visits`
- 后续 `subscriptions` / `payments`

接入策略：

- localStorage 继续作为游客草稿缓存。
- 登录后同步到 Supabase。
- 发布页从 Supabase 读取。
- 图片迁到 Supabase Storage 或正式对象存储。

### 第三步：JD 定制打磨

当前 DeepSeek 已接入。

后续重点：

- 改写质量。
- 失败兜底。
- 改动高亮。
- 撤销体验。
- 禁止编造经历。

### 第四步：商业化

Stripe 应放在 Supabase 之后。

初步方案：

- 免费：生成 1 个页面。
- Pro：无限页面、JD 定制、自定义域名。

### 第五步：小程序

小程序应放在 Supabase 数据层稳定之后。

原因：

- Web 和小程序需要共享同一套用户、草稿、发布页、图片数据。
- 如果先做小程序，后续会出现两套存储，返工很大。

## 当前开发原则

- 每做完一步，先汇报并等用户确认。
- 不要一次性大改。
- 优先实际可上线。
- 不过度工程化。
- 先保证 MVP 链路稳定，再重构。

