import type { MasterProfile } from "./types";

function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(html: string): string {
  return String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "");
}

function escapeWithBreaks(text: string): string {
  return escapeHtml(stripHtml(text)).replace(/\n/g, "<br/>");
}

function safeImageSrc(src: string | undefined, fallback: string): string {
  if (!src) return fallback;
  if (/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i.test(src)) {
    return src;
  }
  try {
    const url = new URL(src);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return escapeHtml(url.toString());
    }
  } catch {
    // fall through to fallback
  }
  return fallback;
}

function renderBullets(items: string[]): string {
  if (!items?.length) items = [""];
  return `<ul class="group/list space-y-1.5 list-disc pl-5">${items
    .map((item) => `<li>${escapeHtml(stripHtml(item))}</li>`)
    .join("")}</ul>`;
}

function renderTimeline(profile: MasterProfile): string {
  const milestones = [
    ...(profile.experiences || []).map((exp) => ({ ...exp, type: "work" })),
    ...(profile.educations || []).map((edu) => ({ ...edu, type: "edu" })),
  ];
  const parseYear = (dateStr: string) => {
    const match = dateStr.match(/(?:19|20)\d{2}/);
    return match ? parseInt(match[0], 10) : 0;
  };
  const sorted = [...milestones].sort((a, b) => parseYear(b.date) - parseYear(a.date));

  return sorted
    .map((m, idx) => {
      const indexStr = String(idx + 1).padStart(2, "0");
      return `
        <div class="relative pl-8 pb-8 group/timeline-item">
          <!-- Circle marker -->
          <div class="absolute -left-[52px] top-0 flex items-center justify-center w-10 h-10 rounded-full border border-theme-divider text-xs font-serif font-bold text-theme-accent bg-theme-sheet shadow-sm select-none z-10">
            ${indexStr}
          </div>
          <div class="text-xs text-theme-accent font-semibold tracking-[0.18em] uppercase mb-2">${escapeHtml(m.date)}</div>
          <h3 class="font-bold text-theme-main text-lg mb-2">${escapeHtml(stripHtml(m.title))}</h3>
        </div>`;
    })
    .join("");
}

function renderCustomSections(profile: MasterProfile): string {
  if (!profile.customSections || profile.customSections.length === 0) return "";

  return profile.customSections
    .map((sec) => {
      const tag = escapeHtml(stripHtml(sec.tag || "自定义标签"));
      const title = escapeWithBreaks(sec.title || "自定义板块标题。");
      const blocksHtml = sec.blocks
        .map((block) => {
          if (block.type === "card") {
            const date = escapeHtml(stripHtml(block.date || ""));
            const bTitle = escapeHtml(stripHtml(block.title || ""));
            const descBullets = (block.descriptions || [])
              .map((desc) => `<li class="outline-none">${escapeHtml(stripHtml(desc))}</li>`)
              .join("");
            const bulletListHtml = descBullets ? `<ul class="space-y-3 text-sm text-theme-sub leading-7 list-disc pl-5">${descBullets}</ul>` : "";
            const imageSrc = safeImageSrc(block.imageData || block.image, "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800");
            
            return `
              <article class="rounded-[1.75rem] border border-theme-divider bg-theme-card p-6 shadow-sm flex flex-col justify-between min-h-[320px]">
                <div>
                  <div class="aspect-[16/10] rounded-[1.25rem] overflow-hidden bg-theme-sheet mb-5">
                    <img src="${imageSrc}" class="w-full h-full object-cover" alt="配图">
                  </div>
                  <div class="text-xs text-theme-accent font-semibold tracking-[0.18em] uppercase mb-3">${date}</div>
                  <h3 class="text-2xl font-serif font-bold mb-4 text-theme-main">${bTitle}</h3>
                  ${bulletListHtml}
                </div>
              </article>`;
          } else {
            const imageSrc = safeImageSrc(block.imageData || block.image, "https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&q=80&w=1200");
            return `
              <div class="md:col-span-2">
                <article class="rounded-[1.75rem] border border-theme-divider bg-theme-card p-2 shadow-sm">
                  <div class="rounded-[1.25rem] overflow-hidden bg-theme-sheet relative aspect-[16/6]">
                    <img src="${imageSrc}" class="w-full h-full object-cover" alt="自定义大图">
                  </div>
                </article>
              </div>`;
          }
        })
        .join("");

      return `
        <section class="max-w-6xl mx-auto px-6 py-16 border-t border-theme-divider bg-theme-sheet">
          <p class="text-xs text-theme-sub font-semibold tracking-[0.18em] uppercase mb-4">${tag}</p>
          <h2 class="text-4xl md:text-5xl font-serif font-bold mb-12 text-theme-main">${title}</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">${blocksHtml}</div>
        </section>`;
    })
    .join("");
}

const UNSPLASH_PHOTOS = [
  "1587614382346-4ec70e388b28",
  "1511578314322-379afb476865",
  "1520607162513-77705c0f0d4a",
  "1516321318423-f06f85e504b3",
];

export function renderPageHtml(profile: MasterProfile): string {
  const name = profile.name || "你的名字";
  const headline = profile.headline || "";
  const tagline = profile.tagline || "";
  const aboutTitle = profile.aboutTitle || "全球视野。\nAI最前线。";
  const contactTitle = profile.contactTitle || "一起创造点什么。";
  const email = profile.email || "";
  const phone = profile.phone || "";
  const summary = (profile.summary || []).join(" ");
  const safeName = escapeHtml(stripHtml(name));
  const safeHeadline = escapeHtml(stripHtml(headline));
  const safeTagline = escapeHtml(stripHtml(tagline));
  const safeAboutTitle = escapeWithBreaks(aboutTitle);
  const safeContactTitle = escapeHtml(stripHtml(contactTitle));
  const safeSummary = escapeHtml(stripHtml(summary));
  const safeEmail = escapeHtml(stripHtml(email));
  const safePhone = escapeHtml(stripHtml(phone));
  const heroImageSrc = safeImageSrc(
    profile.heroImageData,
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=1000"
  );

  const skillTags =
    (profile.tags || [])
      .map(
        (tag) =>
          `<span class="inline-block px-4 py-2 rounded-full text-xs font-medium shadow-sm bg-theme-tag">${escapeHtml(stripHtml(tag))}</span>`
      )
      .join("") || "";

  const experienceCards =
    (profile.experiences || [])
      .map(
        (exp) => `
      <article class="rounded-[1.5rem] border border-theme-divider bg-theme-card p-6 shadow-sm">
        <div class="text-xs text-theme-accent font-semibold tracking-[0.18em] uppercase mb-3">${escapeHtml(exp.date)}</div>
        <h3 class="text-xl font-bold mb-4 text-theme-main">${escapeHtml(exp.title)}</h3>
        <div class="text-theme-sub">${renderBullets(exp.descriptions)}</div>
      </article>`
      )
      .join("") || "";

  const projectCards =
    (profile.projects || [])
      .map(
        (proj, i) => `
      <article class="rounded-[1.75rem] border border-theme-divider bg-theme-card p-6 shadow-sm">
        <div class="aspect-[16/10] rounded-[1.25rem] overflow-hidden bg-theme-sheet mb-5">
          <img src="${safeImageSrc(profile.projectImageData?.[i] || proj.imageData || proj.image, `https://images.unsplash.com/photo-${UNSPLASH_PHOTOS[i % 4]}?auto=format&fit=crop&q=80&w=800`)}" class="w-full h-full object-cover" alt="项目配图">
        </div>
        <div class="text-xs text-theme-accent font-semibold tracking-[0.18em] uppercase mb-3">${escapeHtml(proj.date)}</div>
        <h3 class="text-2xl font-serif font-bold mb-4 text-theme-main">${escapeHtml(stripHtml(proj.title))}</h3>
        <div class="text-theme-sub">${renderBullets(proj.descriptions)}</div>
      </article>`
      )
      .join("") || "";

  const educationCards =
    (profile.educations || [])
      .map(
        (edu) => `
      <article class="rounded-[1.5rem] border border-theme-divider bg-theme-card px-5 py-5 shadow-sm">
        <div class="text-xs text-theme-accent font-semibold tracking-[0.18em] uppercase mb-2">${escapeHtml(edu.date)}</div>
        <h3 class="font-semibold text-theme-main mb-3">${escapeHtml(stripHtml(edu.title))}</h3>
        <div class="text-theme-sub">${renderBullets(edu.descriptions)}</div>
      </article>`
      )
      .join("") || "";

  const topMetrics =
    (profile.top_metrics || [])
      .map(
        (m) => `
      <div class="bg-theme-metric rounded-2xl px-6 py-4 min-w-[140px] border border-theme-divider">
        <div class="text-3xl font-serif font-bold mb-1">${escapeHtml(stripHtml(m.value))}</div>
        <div class="text-[11px] font-medium tracking-wide opacity-90">${escapeHtml(stripHtml(m.label))}</div>
      </div>`
      )
      .join("") || "";

  const educationSection = profile.educations?.length
    ? `<section class="max-w-6xl mx-auto px-6 py-12 border-t border-theme-divider">
        <p class="text-xs text-theme-sub font-semibold tracking-[0.18em] uppercase mb-4">教育背景</p>
        <div class="grid gap-4">${educationCards}</div>
      </section>`
    : "";

  const projectsSection = profile.projects?.length
    ? `<section id="projects" class="max-w-6xl mx-auto px-6 py-16 border-t border-theme-divider">
        <p class="text-xs text-theme-sub font-semibold tracking-[0.18em] uppercase mb-4">精选项目</p>
        <h2 class="text-4xl md:text-5xl font-serif font-bold mb-12 text-theme-main">高光项目。</h2>
        <div class="grid grid-cols-1 ${profile.projects.length > 1 ? "md:grid-cols-2" : ""} gap-8">${projectCards}</div>
      </section>`
    : "";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeName} - OfferGlow 网页分身</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet">
    <script>tailwind.config={theme:{extend:{fontFamily:{sans:['Inter','sans-serif'],serif:['Playfair Display','serif']}}}}<\/script>
    <style>
        /* 默认：暖沙金 */
        :root, .theme-warm {
          --theme-bg-app: #FAF7F2;
          --theme-bg-sheet: #FCFAF7;
          --theme-text-main: #2C251E;
          --theme-text-sub: #5C534B;
          --theme-border-divider: rgba(44, 37, 30, 0.08);
          --theme-accent: #B48E58;
          --theme-accent-hover: #9E7A45;
          --theme-card-bg: #FCFAF7;
          --theme-card-border: #EADBCC;
          --theme-metric-bg: #FAF3E3;
          --theme-metric-text: #8C7355;
          --theme-tag-bg: #FAF3E3;
          --theme-tag-text: #8C7355;
        }

        /* 极简白 */
        .theme-minimal {
          --theme-bg-app: #FAFAFA;
          --theme-bg-sheet: #FFFFFF;
          --theme-text-main: #111827;
          --theme-text-sub: #4B5563;
          --theme-border-divider: rgba(17, 24, 39, 0.08);
          --theme-accent: #2563EB;
          --theme-accent-hover: #1D4ED8;
          --theme-card-bg: #F9FAFB;
          --theme-card-border: #F3F4F6;
          --theme-metric-bg: #EFF6FF;
          --theme-metric-text: #1E40AF;
          --theme-tag-bg: #F3F4F6;
          --theme-tag-text: #374151;
        }

        /* 极客黑 */
        .theme-dark {
          --theme-bg-app: #07090E;
          --theme-bg-sheet: #0B0F19;
          --theme-text-main: #F3F4F6;
          --theme-text-sub: #9CA3AF;
          --theme-border-divider: rgba(243, 244, 246, 0.08);
          --theme-accent: #A78BFA;
          --theme-accent-hover: #8B5CF6;
          --theme-card-bg: #161B22;
          --theme-card-border: #21262D;
          --theme-metric-bg: #2C1A4D;
          --theme-metric-text: #D8B4FE;
          --theme-tag-bg: #21262D;
          --theme-tag-text: #C9D1D9;
        }

        /* 丁香紫 */
        .theme-lilac {
          --theme-bg-app: #F5F3FF;
          --theme-bg-sheet: #FFFFFF;
          --theme-text-main: #1E1B4B;
          --theme-text-sub: #4F46E5;
          --theme-border-divider: rgba(30, 27, 75, 0.08);
          --theme-accent: #8B5CF6;
          --theme-accent-hover: #7C3AED;
          --theme-card-bg: #FAF9FF;
          --theme-card-border: #EEF2F6;
          --theme-metric-bg: #F3E8FF;
          --theme-metric-text: #6B21A8;
          --theme-tag-bg: #EDE9FE;
          --theme-tag-text: #5B21B6;
        }

        /* 静谧蓝 */
        .theme-ocean {
          --theme-bg-app: #F0F4F8;
          --theme-bg-sheet: #FFFFFF;
          --theme-text-main: #0F172A;
          --theme-text-sub: #334155;
          --theme-border-divider: rgba(15, 23, 42, 0.08);
          --theme-accent: #1E3A8A;
          --theme-accent-hover: #172554;
          --theme-card-bg: #F8FAFC;
          --theme-card-border: #E2E8F0;
          --theme-metric-bg: #E0F2FE;
          --theme-metric-text: #0369A1;
          --theme-tag-bg: #E2E8F0;
          --theme-tag-text: #334155;
        }

        body {
          font-family: 'Inter', sans-serif;
          background-color: var(--theme-bg-app);
          color: var(--theme-text-main);
        }
        .font-serif { font-family: 'Playfair Display', serif; }
        
        .bg-theme-sheet { background-color: var(--theme-bg-sheet); }
        .text-theme-main { color: var(--theme-text-main); }
        .text-theme-sub { color: var(--theme-text-sub); }
        .border-theme-divider { border-color: var(--theme-border-divider); }
        .bg-theme-accent { background-color: var(--theme-accent); }
        .text-theme-accent { color: var(--theme-accent); }
        .border-theme-accent { border-color: var(--theme-accent); }
        
        .bg-theme-card {
          background-color: var(--theme-card-bg);
          border-color: var(--theme-card-border);
        }
        .bg-theme-metric {
          background-color: var(--theme-metric-bg);
          color: var(--theme-metric-text);
        }
        .bg-theme-tag {
          background-color: var(--theme-tag-bg);
          color: var(--theme-tag-text);
        }
        .bg-theme-accent-light {
          background-color: color-mix(in srgb, var(--theme-accent) 5%, transparent);
        }
        .hover-bg-theme-accent-light:hover {
          background-color: color-mix(in srgb, var(--theme-accent) 5%, transparent);
        }
        
        li::marker { color: var(--theme-accent); }
        summary::-webkit-details-marker { display: none; }
        summary { list-style: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    </style>
</head>
<body class="theme-${profile.theme || "warm"} antialiased">
    <nav class="w-full border-b border-theme-divider bg-theme-sheet/90 backdrop-blur-md sticky top-0 z-40">
        <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div class="font-serif text-xl font-semibold text-theme-main">${safeName}</div>
            <div class="hidden md:flex items-center gap-8 text-sm text-theme-sub">
                <a href="#hero" class="hover:text-theme-accent transition">首页</a>
                <a href="#about" class="hover:text-theme-accent transition">关于我</a>
                ${profile.projects?.length ? '<a href="#projects" class="hover:text-theme-accent transition">项目</a>' : ""}
                <a href="#contact" class="hover:text-theme-accent transition">联系</a>
            </div>
        </div>
    </nav>

    <main>
        <section id="hero" class="max-w-6xl mx-auto px-6 pt-16 pb-20 grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
            <div>
                <div class="text-sm text-theme-sub tracking-[0.18em] uppercase mb-4 opacity-70">Personal Page</div>
                <h1 class="text-5xl md:text-7xl font-serif font-bold leading-[1.02] mb-6">
                    <span class="block text-xl font-sans font-normal text-theme-sub mb-2 opacity-80">Hi，我是</span>
                    <span class="text-theme-main">${safeName}。</span>
                </h1>
                ${safeTagline ? `<div class="text-2xl font-serif font-bold text-theme-accent leading-snug mb-4">${safeTagline}</div>` : ""}
                <p class="text-sm text-theme-sub mb-8 tracking-wide">${safeHeadline}</p>
                <div class="flex gap-4">
                    <a href="#contact" class="bg-theme-accent text-white hover:opacity-90 rounded-full px-8 py-3.5 text-sm font-medium transition shadow-md inline-block">
                        联系我 →
                    </a>
                </div>
            </div>
            <div>
                <div class="aspect-[4/5] rounded-[2rem] overflow-hidden bg-theme-card shadow-2xl">
                    <img src="${heroImageSrc}" alt="Profile" class="w-full h-full object-cover">
                </div>
            </div>
        </section>

        <section id="about" class="border-t border-theme-divider bg-theme-sheet py-20">
            <div class="max-w-6xl mx-auto px-6 flex flex-col gap-12">
                <!-- Line divider with "关于我" in center -->
                <div class="relative flex items-center justify-center">
                    <div class="absolute inset-0 flex items-center" aria-hidden="true">
                        <div class="w-full border-t border-theme-divider"></div>
                    </div>
                    <div class="relative bg-theme-sheet px-4 text-xs font-semibold tracking-[0.2em] text-theme-sub uppercase">
                        关于我
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-5 gap-16">
                    <!-- Left Column: Narrative and Tags -->
                    <div class="md:col-span-3">
                        <h2 class="text-4xl md:text-5xl font-serif font-bold text-theme-main leading-[1.15] mb-8 whitespace-pre-line">
                            ${safeAboutTitle}
                        </h2>
                        <div class="space-y-6 text-theme-sub leading-8 text-base mb-10">
                            ${safeSummary}
                        </div>
                        
                        ${topMetrics ? `<div class="flex flex-wrap gap-4 mb-10 border-t border-theme-divider pt-8">${topMetrics}</div>` : ""}
                    </div>

                    <!-- Right Column: Timeline -->
                    <div class="md:col-span-2">
                        <div class="relative border-l border-theme-divider flex flex-col gap-2 ml-6 pl-8">
                            ${renderTimeline(profile)}
                        </div>
                    </div>
                </div>

                ${skillTags ? `
                    <div class="border-t border-theme-divider pt-10 mt-10 w-full">
                        <div class="text-xs text-theme-sub font-semibold tracking-[0.18em] uppercase mb-4">专业技能</div>
                        <div class="flex flex-row items-center overflow-x-auto flex-nowrap gap-2.5 pb-2 no-scrollbar">${skillTags}</div>
                    </div>
                ` : ""}
            </div>
        </section>

        ${projectsSection}

        ${renderCustomSections(profile)}

        <section id="contact" class="max-w-6xl mx-auto px-6 py-16 border-t border-theme-divider bg-theme-sheet">
            <div class="grid grid-cols-1 md:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
                <div class="space-y-5">
                    <p class="text-xs text-theme-sub font-semibold tracking-[0.18em] uppercase">联系</p>
                    <h2 class="text-4xl font-serif font-bold text-theme-main">${safeContactTitle}</h2>
                    <p class="text-theme-sub leading-7 max-w-md">如果你对我的经历、项目或合作机会感兴趣，欢迎随时与我联系。</p>
                    <div class="space-y-2 text-sm text-theme-sub">
                        ${safeEmail ? `<p>邮箱：<span class="text-theme-main">${safeEmail}</span></p>` : ""}
                        ${safePhone ? `<p>电话：<span class="text-theme-main">${safePhone}</span></p>` : ""}
                    </div>
                </div>
                <div class="rounded-[1.75rem] border border-theme-divider bg-theme-card p-6 shadow-sm">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <input class="border border-theme-divider rounded-2xl px-4 py-3.5 bg-theme-sheet text-theme-main focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent" placeholder="你的名字">
                        <input class="border border-theme-divider rounded-2xl px-4 py-3.5 bg-theme-sheet text-theme-main focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent" placeholder="你的邮箱">
                    </div>
                    <textarea class="w-full min-h-[120px] border border-theme-divider bg-theme-sheet text-theme-main rounded-2xl px-4 py-3.5 resize-none focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent" placeholder="想说点什么？"></textarea>
                    <button class="mt-4 w-full bg-theme-accent text-white px-8 py-3.5 rounded-full text-sm font-medium hover:opacity-90 transition">发送消息</button>
                </div>
            </div>
        </section>
    </main>
</body>
</html>`;
}
