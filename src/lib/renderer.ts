import type { MasterProfile } from "./types";

function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderBullets(items: string[]): string {
  if (!items?.length) items = [""];
  return `<ul class="group/list">${items
    .map(
      (item) =>
        `<li contenteditable="true" style="outline:none" onblur="if(!this.textContent.trim()&&this.parentNode.children.length>2)this.remove()">${escapeHtml(item)}</li>`
    )
    .join(
      ""
    )}<div class="opacity-0 group-hover/list:opacity-100 transition mt-2 cursor-pointer text-blue-500 text-xs font-medium inline-flex items-center gap-1 select-none" onclick="var li=document.createElement('li');li.contentEditable='true';li.style.outline='none';li.setAttribute('onblur','if(!this.textContent.trim()&&this.parentNode.children.length>2)this.remove()');this.parentNode.insertBefore(li,this);li.focus();"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg> 添加一行</div></ul>`;
}

const UNSPLASH_PHOTOS = [
  "1587614382346-4ec70e388b28",
  "1511578314322-379afb476865",
  "1520607162513-77705c0f0d4a",
  "1516321318423-f06f85e504b3",
];

export function renderPageHtml(profile: MasterProfile): string {
  const name = escapeHtml(profile.name || "你的名字");
  const headline = escapeHtml(profile.headline || "");
  const tagline = escapeHtml(profile.tagline || "");
  const email = escapeHtml(profile.email || "");
  const phone = escapeHtml(profile.phone || "");
  const summary = escapeHtml((profile.summary || []).join(" "));

  const skillTags =
    (profile.tags || [])
      .map(
        (tag, i) =>
          `<span class="inline-block px-4 py-2 rounded-full text-xs font-medium shadow-sm ${
            [
              "bg-blue-600 text-white",
              "bg-blue-500 text-white",
              "bg-blue-400 text-white",
              "bg-blue-300 text-blue-900",
              "bg-blue-200 text-blue-900",
              "bg-blue-100 text-blue-900",
              "bg-gray-100 text-gray-700",
            ][i % 7]
          }">${escapeHtml(tag)}</span>`
      )
      .join("") || "";

  const experienceCards =
    (profile.experiences || [])
      .map(
        (exp) => `
      <article class="rounded-[1.5rem] border border-gray-100 bg-white p-6 shadow-sm">
        <div class="text-xs text-gray-400 font-semibold tracking-[0.18em] uppercase mb-3">${escapeHtml(exp.date)}</div>
        <h3 class="text-xl font-bold mb-4">${escapeHtml(exp.title)}</h3>
        ${renderBullets(exp.descriptions)}
      </article>`
      )
      .join("") || "";

  const projectCards =
    (profile.projects || [])
      .map(
        (proj, i) => `
      <article class="rounded-[1.75rem] border border-gray-100 bg-white p-6 shadow-sm">
        <div class="aspect-[16/10] rounded-[1.25rem] overflow-hidden bg-gray-100 mb-5">
          <img src="https://images.unsplash.com/photo-${UNSPLASH_PHOTOS[i % 4]}?auto=format&fit=crop&q=80&w=800" class="w-full h-full object-cover" alt="项目配图">
        </div>
        <div class="text-xs text-blue-500 font-semibold tracking-[0.18em] uppercase mb-3">${escapeHtml(proj.date)}</div>
        <h3 class="text-2xl font-serif font-bold mb-4">${escapeHtml(proj.title)}</h3>
        ${renderBullets(proj.descriptions)}
      </article>`
      )
      .join("") || "";

  const educationCards =
    (profile.educations || [])
      .map(
        (edu) => `
      <article class="rounded-[1.5rem] border border-gray-100 bg-white px-5 py-5 shadow-sm">
        <div class="text-xs text-gray-400 font-semibold tracking-[0.18em] uppercase mb-2">${escapeHtml(edu.date)}</div>
        <h3 class="font-semibold text-gray-900 mb-3">${escapeHtml(edu.title)}</h3>
        ${renderBullets(edu.descriptions)}
      </article>`
      )
      .join("") || "";

  const topMetrics =
    (profile.top_metrics || [])
      .map(
        (m) => `
      <div class="bg-[#faf7f2] border border-[#f0eadd] rounded-2xl px-6 py-4 min-w-[140px]">
        <div class="text-3xl font-serif font-bold text-[#b48e58] mb-1">${escapeHtml(m.value)}</div>
        <div class="text-[11px] text-[#8c7355] font-medium tracking-wide">${escapeHtml(m.label)}</div>
      </div>`
      )
      .join("") || "";

  const educationSection = profile.educations?.length
    ? `<section class="max-w-6xl mx-auto px-6 py-12 border-t border-gray-100">
        <p class="text-xs text-gray-400 font-semibold tracking-[0.18em] uppercase mb-4">教育背景</p>
        <div class="grid gap-4">${educationCards}</div>
      </section>`
    : "";

  const projectsSection = profile.projects?.length
    ? `<section class="max-w-6xl mx-auto px-6 py-16 border-t border-gray-100">
        <p class="text-xs text-gray-400 font-semibold tracking-[0.18em] uppercase mb-4">精选项目</p>
        <h2 class="text-4xl md:text-5xl font-serif font-bold mb-12">高光项目。</h2>
        <div class="grid grid-cols-1 ${profile.projects.length > 1 ? "md:grid-cols-2" : ""} gap-8">${projectCards}</div>
      </section>`
    : "";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name} - OfferGlow 网页分身</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet">
    <script>tailwind.config={theme:{extend:{fontFamily:{sans:['Inter','sans-serif'],serif:['Playfair Display','serif']}}}}<\/script>
    <style>
        body { font-family: 'Inter', sans-serif; background: #fafafa; color: #111111; }
        .font-serif { font-family: 'Playfair Display', serif; }
        [contenteditable="true"] { outline: 2px solid transparent; outline-offset: 3px; transition: outline-color .16s ease, background-color .16s ease; }
        [contenteditable="true"]:focus { outline-color: rgba(59,130,246,.24); background: rgba(59,130,246,.05); }
        li::marker { color: #9ca3af; }
    </style>
</head>
<body class="antialiased">
    <nav class="w-full border-b border-gray-100 bg-white/90 backdrop-blur-md sticky top-0 z-40">
        <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div class="font-serif text-xl font-semibold">${name}</div>
            <div class="hidden md:flex items-center gap-8 text-sm text-gray-500">
                <a href="#hero">首页</a>
                ${profile.educations?.length ? '<a href="#education">教育</a>' : ""}
                <a href="#experience">经历</a>
                ${profile.projects?.length ? '<a href="#projects">项目</a>' : ""}
                <a href="#contact">联系</a>
            </div>
        </div>
    </nav>

    <main>
        <section id="hero" class="max-w-6xl mx-auto px-6 pt-16 pb-20 grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
            <div>
                <div class="text-sm text-gray-400 tracking-[0.18em] uppercase mb-4">Personal Page</div>
                <h1 class="text-5xl md:text-7xl font-serif font-bold leading-[1.02] mb-4">
                    <span class="block text-xl font-sans font-normal text-gray-500 mb-2">你好，我是</span>
                    <span contenteditable="true">${name}。</span>
                </h1>
                ${tagline ? `<p class="text-xl font-medium mb-3 text-gray-800 leading-snug" contenteditable="true">${tagline}</p>` : ""}
                <p class="text-sm text-gray-400 mb-6 tracking-wide" contenteditable="true">${headline}</p>
                <p class="text-gray-500 leading-8 max-w-xl" contenteditable="true">${summary}</p>
                ${topMetrics ? `<div class="flex flex-wrap gap-4 mt-8">${topMetrics}</div>` : ""}
            </div>
            <div>
                <div class="aspect-[4/5] rounded-[2rem] overflow-hidden bg-gray-100 shadow-2xl">
                    <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=1000" alt="Profile" class="w-full h-full object-cover">
                </div>
            </div>
        </section>

        ${educationSection}

        <section id="experience" class="border-t border-gray-100 bg-white py-16">
            <div class="max-w-6xl mx-auto px-6 flex flex-col gap-10">
                <div class="space-y-4">
                    <p class="text-xs text-gray-400 font-semibold tracking-[0.18em] uppercase mb-4">核心信息</p>
                    <h2 class="text-4xl md:text-5xl font-serif font-bold">里程碑。</h2>
                    ${skillTags ? `<div class="flex flex-wrap gap-2 pt-4">${skillTags}</div>` : ""}
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">${experienceCards}</div>
            </div>
        </section>

        ${projectsSection}

        <section id="contact" class="max-w-6xl mx-auto px-6 py-16 border-t border-gray-100">
            <div class="grid grid-cols-1 md:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
                <div class="space-y-5">
                    <p class="text-xs text-gray-400 font-semibold tracking-[0.18em] uppercase">联系</p>
                    <h2 class="text-4xl font-serif font-bold">一起创造点什么。</h2>
                    <p class="text-gray-500 leading-7 max-w-md">如果你对我的经历、项目或合作机会感兴趣，欢迎随时与我联系。</p>
                    <div class="space-y-2 text-sm text-gray-700">
                        ${email ? `<p>邮箱：${email}</p>` : ""}
                        ${phone ? `<p>电话：${phone}</p>` : ""}
                    </div>
                </div>
                <div class="rounded-[1.75rem] border border-gray-100 bg-white p-6 shadow-sm">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <input class="border border-gray-200 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-gray-400" placeholder="你的名字">
                        <input class="border border-gray-200 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-gray-400" placeholder="你的邮箱">
                    </div>
                    <textarea class="w-full min-h-[120px] border border-gray-200 rounded-2xl px-4 py-3.5 resize-none focus:outline-none focus:border-gray-400" placeholder="想说点什么？"></textarea>
                    <button class="mt-4 w-full bg-black text-white px-8 py-3.5 rounded-full text-sm font-medium hover:bg-gray-800 transition">发送消息</button>
                </div>
            </div>
        </section>
    </main>
</body>
</html>`;
}
