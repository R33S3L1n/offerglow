        function renderBullets(items, className = "") {
            if (!items || !items.length) return "";
            return `<ul class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
        }

        function buildGeneratedPageHtml(profile) {
            const projectCards = profile.projectEntries.map((project, index) => `
                <article class="rounded-[1.75rem] border border-gray-100 bg-white p-6 shadow-sm flex flex-col justify-between min-h-[320px]">
                    <div>
                        <div class="aspect-[16/10] rounded-[1.25rem] overflow-hidden bg-gray-100 mb-5">
                            <img src="${[
                                "https://images.unsplash.com/photo-1587614382346-4ec70e388b28?auto=format&fit=crop&q=80&w=800",
                                "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=800",
                                "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&q=80&w=800",
                                "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800"
                            ][index % 4]}" class="w-full h-full object-cover" alt="项目配图">
                        </div>
                        <div class="text-xs text-blue-500 font-semibold tracking-[0.18em] uppercase mb-3">${escapeHtml(project.date || `Project ${String(index + 1).padStart(2, "0")}`)}</div>
                        <h3 class="text-2xl font-serif font-bold mb-4" contenteditable="true">${escapeHtml(project.title || `项目 ${index + 1}`)}</h3>
                        ${renderBullets(project.bullets, "space-y-3 text-sm text-gray-600 leading-7 list-disc pl-5")}
                    </div>
                </article>
            `).join("");

            const experienceBlocks = profile.experienceEntries.map((entry, index) => `
                <article class="relative rounded-[1.5rem] border border-gray-100 bg-white p-6 shadow-sm">
                    <div class="text-xs ${index === 0 ? "text-blue-500" : "text-gray-400"} font-semibold tracking-[0.18em] uppercase mb-3">${escapeHtml(entry.date || (index === 0 ? "最近经历" : index === 1 ? "核心能力" : "补充经历"))}</div>
                    <h3 class="text-xl font-bold mb-4" contenteditable="true">${escapeHtml(entry.title || `经历 ${index + 1}`)}</h3>
                    ${renderBullets(entry.bullets, "space-y-3 text-sm text-gray-600 leading-7 list-disc pl-5")}
                </article>
            `).join("");

            const educationSection = profile.educationEntries.length ? `
                <section class="max-w-6xl mx-auto px-6 py-12 border-t border-gray-100">
                    <p class="text-xs text-gray-400 font-semibold tracking-[0.18em] uppercase mb-4">教育背景</p>
                    <div class="grid gap-4">
                        ${profile.educationEntries.map((entry) => `
                            <article class="rounded-[1.5rem] border border-gray-100 bg-white px-5 py-5 shadow-sm">
                                <div class="text-xs text-gray-400 font-semibold tracking-[0.18em] uppercase mb-2">${escapeHtml(entry.date || "教育背景")}</div>
                                <h3 class="font-semibold text-gray-900 mb-3" contenteditable="true">${escapeHtml(entry.title)}</h3>
                                ${renderBullets(entry.bullets, "space-y-2 text-sm text-gray-600 leading-7 list-disc pl-5")}
                            </article>
                        `).join("")}
                    </div>
                </section>
            ` : "";

            const projectsSection = profile.projectEntries.length ? `
                <section class="max-w-6xl mx-auto px-6 py-16 border-t border-gray-100" id="generatedPortfolio">
                    <p class="text-xs text-gray-400 font-semibold tracking-[0.18em] uppercase mb-4">精选项目</p>
                    <h2 class="text-4xl md:text-5xl font-serif font-bold mb-12">我做过的事。</h2>
                    <div class="grid grid-cols-1 ${profile.projectEntries.length === 1 ? "" : "md:grid-cols-2"} gap-8">
                        ${projectCards}
                    </div>
                </section>
            ` : "";

            const highlightSection = profile.extraHighlights.length ? `
                <div class="rounded-[1.5rem] border border-gray-100 bg-white p-5 shadow-sm">
                    <div class="text-xs text-gray-400 font-semibold tracking-[0.18em] uppercase mb-3">补充亮点</div>
                    <div class="space-y-4">
                        ${profile.extraHighlights.map((entry) => `
                            <div>
                                <h4 class="font-semibold text-gray-900 mb-2" contenteditable="true">${escapeHtml(entry.title)}</h4>
                                ${renderBullets(entry.bullets, "space-y-2 text-sm text-gray-600 leading-7 list-disc pl-5")}
                            </div>
                        `).join("")}
                    </div>
                </div>
            ` : "";

            const skillTags = profile.skillTags.length
                ? profile.skillTags.map((skill, index) => `<span class="${index % 3 === 0 ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-700"} px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap">${escapeHtml(skill)}</span>`).join("")
                : "";

            return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(profile.name)} - OfferGlow 网页分身</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                        serif: ['Playfair Display', 'serif'],
                    }
                }
            }
        }
    <\/script>
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
            <div class="font-serif text-xl font-semibold">${escapeHtml(profile.name || "你的名字")}</div>
            <div class="hidden md:flex items-center gap-8 text-sm text-gray-500">
                <a href="#hero">首页</a>
                <a href="#experience">经历</a>
                ${profile.projectEntries.length ? '<a href="#generatedPortfolio">项目</a>' : ''}
                <a href="#contact">联系</a>
            </div>
        </div>
    </nav>

    <main>
        <section id="hero" class="max-w-6xl mx-auto px-6 pt-16 pb-20 grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
            <div>
                <div class="text-sm text-gray-400 tracking-[0.18em] uppercase mb-4">Personal Page</div>
                <h1 class="text-5xl md:text-7xl font-serif font-bold leading-[1.02] mb-6">
                    <span class="block text-xl font-sans font-normal text-gray-500 mb-2">你好，我是</span>
                    <span contenteditable="true">${escapeHtml(profile.name || "你的名字")}。</span>
                </h1>
                <p class="text-xl font-medium mb-5" contenteditable="true">${escapeHtml(profile.headline || "一句更有气质的个人定位会显示在这里。")}</p>
                <p class="text-gray-500 leading-8 max-w-xl" contenteditable="true">${escapeHtml((profile.summary || []).join(" "))}</p>
            </div>
            <div>
                <div class="aspect-[4/5] rounded-[2rem] overflow-hidden bg-gray-100 shadow-2xl">
                    <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=1000" alt="Profile" class="w-full h-full object-cover">
                </div>
            </div>
        </section>

        <section id="experience" class="border-t border-gray-100 bg-white py-16">
            <div class="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-[0.82fr_1.18fr] gap-10 items-start">
                <aside class="space-y-6">
                    <div>
                        <p class="text-xs text-gray-400 font-semibold tracking-[0.18em] uppercase mb-4">核心信息</p>
                        <h2 class="text-4xl font-serif font-bold mb-4">经历与能力</h2>
                    </div>
                    ${skillTags ? `<div class="flex flex-wrap gap-2">${skillTags}</div>` : ""}
                    ${highlightSection}
                </aside>
                <div class="space-y-6">
                    ${experienceBlocks}
                </div>
            </div>
        </section>

        ${projectsSection}
        ${educationSection}

        <section id="contact" class="max-w-6xl mx-auto px-6 py-16 border-t border-gray-100">
            <div class="grid grid-cols-1 md:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
                <div class="space-y-5">
                    <p class="text-xs text-gray-400 font-semibold tracking-[0.18em] uppercase">联系</p>
                    <h2 class="text-4xl font-serif font-bold">继续聊聊。</h2>
                    <p class="text-gray-500 leading-7 max-w-md" contenteditable="true">如果你对我的经历、项目或合作机会感兴趣，欢迎继续联系。</p>
                    <div class="space-y-2 text-sm text-gray-700">
                        ${profile.email ? `<p class="flex items-center gap-2"><span class="text-gray-400">✉</span><span>邮箱：${escapeHtml(profile.email)}</span></p>` : ""}
                        ${profile.phone ? `<p class="flex items-center gap-2"><span class="text-gray-400">☎</span><span>电话：${escapeHtml(profile.phone)}</span></p>` : ""}
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

        function openGeneratedPage(profile, previewWindow = null) {
            previewWindow = previewWindow || window.open("", "_blank");
            if (!previewWindow) {
                showToast("浏览器拦截了新页面", "请允许打开新窗口后，再生成网页分身。");
                return false;
            }

            previewWindow.document.open();
            previewWindow.document.write(buildGeneratedPageHtml(profile));
            previewWindow.document.close();
            return true;
        }

        async function generatePage() {
            const text = resumeText.value.trim();
            if (!text) {
                showToast("请先粘贴简历", "把完整简历文字粘贴进输入框后，再生成网页分身。");
                return;
            }

            const previewWindow = window.open("", "_blank");
            if (!previewWindow) {
                showToast("浏览器拦截了新页面", "请允许打开新窗口后，再生成网页分身。");
                return;
            }

            setLoading(true);
            inputMeta.textContent = `已输入 ${text.length} 个字符，正在准备网页分身…`;

            try {
                const profile = await fetchStructuredProfile(text);
                const enriched = enrichProfile(profile, text);
                state.profile = enriched;
                if (openGeneratedPage(enriched, previewWindow)) {
                    showToast("网页分身已生成", "已为你打开新的网页分身页面，可以继续编辑。");
                }
            } catch (error) {
                const fallback = enrichProfile(parseResumeText(text), text);
                state.profile = fallback;
                if (openGeneratedPage(fallback, previewWindow)) {
                    showToast("网页分身已生成", "AI 解析暂时不可用，已先用本地规则打开新页面。");
                }
            } finally {
                setLoading(false);
            }
        }

        generateBtn.addEventListener("click", generatePage);
        ctaGenerateBtn.addEventListener("click", () => {
            document.querySelector("html, body");
            window.scrollTo({ top: 0, behavior: "smooth" });
            setTimeout(() => resumeText.focus(), 400);
        });

        document.querySelector("#backToTopBtn").addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });

        resumeText.addEventListener("input", () => {
            const count = resumeText.value.trim().length;
            inputMeta.textContent = count ? `已输入 ${count} 个字符` : "支持直接复制 PDF、Word 或招聘软件上的文字";
        });

        if (!resumeText.value.trim()) {
            resumeText.value = sampleResume;
            inputMeta.textContent = `已自动填入示例简历，你可以直接点击生成`;
        }
    </script>
