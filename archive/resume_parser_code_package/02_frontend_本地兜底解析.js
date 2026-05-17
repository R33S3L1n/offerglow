        function cleanLine(line) {
            return line.replace(/^(?:[-*•]\s*|\d+[.)、]\s*)/, "").trim();
        }

        const sectionAliases = {
            summary: ["个人概览", "个人简介", "简介", "概览", "自我评价", "自我介绍", "个人优势", "summary", "profile", "about"],
            experience: ["工作经历", "工作经验", "职业经历", "实习经历", "实践经历", "experience", "work experience", "work"],
            projects: ["项目经历", "项目经验", "项目", "代表项目", "校园实践", "志愿活动", "校园实践/志愿活动", "project", "projects"],
            education: ["教育背景", "教育经历", "教育", "学历", "education", "academic"],
            skills: ["技能", "能力", "专业技能", "核心技能", "skill", "skills"]
        };

        const allSectionNames = Object.values(sectionAliases).flat();

        function normalizeHeading(line) {
            return line.trim().replace(/[:：]\s*$/, "").replace(/\s+/g, " ").toLowerCase();
        }

        function isHeading(line) {
            return allSectionNames.some((name) => normalizeHeading(line) === normalizeHeading(name));
        }

        function isContactLine(line) {
            const lowered = line.toLowerCase();
            return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(line)
                || /(?:\+?\d{1,3}[-\s]?)?(?:1[3-9]\d{9}|\d{3,4}[-\s]?\d{7,8}|\d{3}[-\s]?\d{3,4}[-\s]?\d{4})/.test(line)
                || lowered.includes("email")
                || lowered.includes("wechat")
                || lowered.includes("tel")
                || line.includes("电话")
                || line.includes("手机")
                || line.includes("邮箱")
                || line.includes("微信");
        }

        function splitList(text) {
            return text
                .split(/[\n,，、；;]/)
                .map((item) => cleanLine(item))
                .filter(Boolean);
        }

        function extractLabeledValue(rawText, labels) {
            for (const label of labels) {
                const pattern = new RegExp(`${label}\\s*[：:]\\s*(.+)`);
                const match = rawText.match(pattern);
                if (match) return match[1].trim();
            }
            return "";
        }

        function pickSection(lines, names) {
            const normalizedNames = names.map((name) => normalizeHeading(name));
            const start = lines.findIndex((line) => normalizedNames.includes(normalizeHeading(line)));
            if (start === -1) return [];
            const next = lines.findIndex(
                (line, index) =>
                    index > start &&
                    isHeading(line)
            );
            return lines.slice(start + 1, next === -1 ? lines.length : next).map(cleanLine).filter(Boolean);
        }

        function detectName(lines) {
            for (const line of lines.slice(0, 6)) {
                const candidate = line.trim();
                if (
                    candidate
                    && candidate.length <= 24
                    && !isHeading(candidate)
                    && !isContactLine(candidate)
                    && !/\d/.test(candidate)
                    && !/(工程师|经理|负责人|设计师|开发|运营|产品|marketing|engineer|manager|designer)/i.test(candidate)
                ) {
                    return candidate;
                }
            }
            return "你的名字";
        }

        function detectHeadline(lines, name) {
            for (const line of lines.slice(0, 10)) {
                const candidate = line.trim();
                if (
                    candidate
                    && candidate !== name
                    && !isHeading(candidate)
                    && !isContactLine(candidate)
                    && candidate.length <= 80
                    && !/(毕业生个人简历|个人简历|基本信息|姓名)/.test(candidate)
                    && /(工程师|经理|负责人|设计|开发|运营|产品|增长|marketing|engineer|manager|designer|lead|frontend|product)/i.test(candidate)
                ) {
                    return candidate;
                }
            }

            for (const line of lines.slice(0, 10)) {
                const candidate = line.trim();
                if (candidate && candidate !== name && !isHeading(candidate) && !isContactLine(candidate) && candidate.length <= 36 && !/(毕业生个人简历|个人简历|基本信息|姓名)/.test(candidate)) {
                    return candidate;
                }
            }

            return "一句更有气质的个人定位会显示在这里。";
        }

        function fallbackSummary(lines, name, headline) {
            const summary = [];
            for (const line of lines) {
                const candidate = cleanLine(line);
                if (
                    candidate
                    && candidate !== name
                    && candidate !== headline
                    && !isHeading(candidate)
                    && !isContactLine(candidate)
                    && candidate.length >= 12
                ) {
                    summary.push(candidate);
                }
                if (summary.length >= 2) break;
            }
            return summary;
        }

        function compressSection(lines, limit = 6) {
            const items = [];
            let buffer = [];
            const entryStartRe = /(\d{4}[./年-]\d{1,2}|\d{4}[./年-](?:至今|现在)|\d{4}\s*[-~—至]+\s*(?:\d{4}|\d{1,2}|至今|现在)|\b20\d{2}\b)/i;

            for (const raw of lines) {
                const line = cleanLine(raw);
                if (!line) continue;

                if (entryStartRe.test(line) && buffer.length) {
                    items.push(buffer.join(" ").trim());
                    buffer = [line];
                } else if (/^(负责|主导|参与|推动|完成|搭建|设计|优化)/.test(line) && buffer.length) {
                    buffer.push(line);
                } else if (line.length <= 38 && buffer.length && buffer[buffer.length - 1].length > 45) {
                    items.push(buffer.join(" ").trim());
                    buffer = [line];
                } else {
                    buffer.push(line);
                }
            }

            if (buffer.length) items.push(buffer.join(" ").trim());

            return items.filter((item, index) => item && items.indexOf(item) === index).slice(0, limit);
        }

        function parseResumeText(rawText) {
            const lines = rawText
                .replace(/\r/g, "")
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean);

            const name = extractLabeledValue(rawText, ["姓名"]) || detectName(lines);
            const headline = extractLabeledValue(rawText, ["求职意向"]) || detectHeadline(lines, name);
            const fallbackBody = lines.map(cleanLine).filter(Boolean);
            const summarySection = pickSection(lines, sectionAliases.summary);
            const experienceSection = pickSection(lines, sectionAliases.experience);
            const projectsSection = pickSection(lines, sectionAliases.projects);
            const educationSection = pickSection(lines, sectionAliases.education);
            const skillsRaw = pickSection(lines, sectionAliases.skills);

            const email = extractLabeledValue(rawText, ["电子邮箱", "邮箱"]) || rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
            const phone = extractLabeledValue(rawText, ["联系电话", "电话", "手机"]) || rawText.match(/(?:\+?\d{1,3}[-\s]?)?(?:1[3-9]\d{9}|\d{3,4}[-\s]?\d{7,8}|\d{3}[-\s]?\d{3,4}[-\s]?\d{4})/)?.[0] || "";

            const summary = summarySection.length ? compressSection(summarySection, 3) : fallbackSummary(lines, name, headline);
            let experience = experienceSection.length ? compressSection(experienceSection, 4) : [];
            let projects = projectsSection.length ? compressSection(projectsSection, 4) : [];
            const education = educationSection.length ? compressSection(educationSection, 2) : [];
            let skills = skillsRaw.length ? splitList(skillsRaw.join(",")) : [];

            if (!experience.length) {
                const generic = fallbackBody.filter((line) => !summary.includes(line) && !projects.includes(line) && !education.includes(line) && !isHeading(line) && !isContactLine(line));
                experience = compressSection(generic, 4);
            }

            if (!projects.length && experience.length) {
                projects = experience.slice(0, 2);
            }

            if (!skills.length) {
                const englishTokens = [...new Set((rawText.match(/\b[A-Za-z][A-Za-z0-9.+#/ -]{1,20}\b/g) || []).map((item) => item.trim()))]
                    .filter((item) => !["work", "experience", "project", "education", "summary"].includes(item.toLowerCase()));
                skills = englishTokens.slice(0, 6);
            }

            return {
                name,
                headline,
                email,
                phone,
                summary: summary.length ? summary.slice(0, 3) : fallbackBody.slice(0, 2),
                experience: experience.length ? experience : fallbackBody.slice(2, 6),
                projects,
                education,
                skills: skills.length ? skills : ["沟通", "产品", "执行", "表达"],
            };
        }

        async function fetchStructuredProfile(text) {
            const response = await fetch("/api/parse-resume", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text })
            });
            const result = await response.json();
            if (!response.ok || !result.profile) {
                throw new Error(result.error || "解析失败");
            }
            return result.profile;
        }

        function splitIntoBullets(text) {
            return text
                .replace(/\r/g, "")
                .split(/\n+|[；;。]+|(?=\d+[.)、]\s*)|(?=[-*•]\s*)/)
                .map((item) => cleanLine(item))
                .filter(Boolean)
                .slice(0, 6);
        }

        function escapeHtml(text) {
            return String(text || "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        }

        function detectIndependentProject(title) {
            return !/(班长|学生会|社团|团支书|学习委员|宣传委员|部长|副部长|志愿者|辩论队|协会)/.test(title);
        }

        function removeBrackets(text) {
            return cleanLine(String(text || "").replace(/[【】[\]]/g, ""));
        }

        function splitDescriptionText(text) {
            return String(text || "")
                .replace(/\r/g, "")
                .split(/\n+|[；;。]+|(?=\d+[.)、]\s*)|(?=[-*•]\s*)/)
                .map((item) => cleanLine(item))
                .filter(Boolean);
        }

        function inferExperienceTitle(line, bullets) {
            const text = `${line} ${bullets.join(" ")}`.trim();
            const match = text.match(/((?:19|20)\d{2}(?:[./年-]\d{1,2}月?)?(?:\s*[-~—至]+\s*(?:(?:19|20)\d{2}(?:[./年-]\d{1,2}月?)?|至今|现在))?)?\s*([^\s/｜|]+(?:公司|集团|科技|信息|中心|学校|学院|银行|医院|协会|大学|政府|事务所|传媒|酒店|超市|工作室|委员会|办公室|局|院)?)[/｜| -]+([^\n]{2,24})/);
            if (match) {
                const company = removeBrackets(match[2]).replace(/^[—-]+|[—-]+$/g, "");
                const role = removeBrackets(match[3]).replace(/^[—-]+|[—-]+$/g, "");
                if (company && role) return `${company} - ${role}`;
            }

            const compact = removeBrackets(line).replace(/^((?:19|20)\d{2}[^\u4e00-\u9fa5A-Za-z]*)/, "").trim();
            const descIndex = compact.search(/负责|协助|参与|主导|处理|完成|统筹|制定|撰写|组织|开展|跟进|协同/);
            const titleOnly = descIndex > 0 ? compact.slice(0, descIndex).trim() : compact;
            if (titleOnly && titleOnly.length > 2 && titleOnly !== "的") return titleOnly;

            const fallback = bullets.find((item) => item.length >= 4) || "";
            return removeBrackets(fallback) || "经历概览";
        }

        function extractDateText(text) {
            const match = text.match(/(?:19|20)\d{2}(?:[./-]\d{1,2}|年\d{1,2}月?)?(?:\s*[-~—至]+\s*(?:(?:19|20)\d{2}(?:[./-]\d{1,2}|年\d{1,2}月?)?|至今|现在))?/);
            return match ? match[0].replace(/\s+/g, "") : "";
        }

        function inferProjectTitle(line, bullets) {
            const compact = removeBrackets(line).replace(/^((?:19|20)\d{2}[^\u4e00-\u9fa5A-Za-z]*)/, "").trim();
            const descIndex = compact.search(/负责|协助|参与|主导|处理|完成|统筹|制定|撰写|组织|开展|跟进|协同/);
            const titleOnly = descIndex > 0 ? compact.slice(0, descIndex).trim() : compact;
            if (titleOnly && titleOnly.length > 1 && titleOnly !== "的") {
                return titleOnly;
            }
            const fallback = bullets.find((item) => item.length >= 4) || "";
            return removeBrackets(fallback) || "项目概览";
        }

        function inferEducationTitle(line, bullets) {
            const compact = removeBrackets(line).replace(/^((?:19|20)\d{2}[^\u4e00-\u9fa5A-Za-z]*)/, "").trim();
            const descIndex = compact.search(/核心课程|主修课程|荣誉奖项|证书资质|奖学金|获奖情况/);
            const titleOnly = descIndex > 0 ? compact.slice(0, descIndex).trim() : compact;
            if (titleOnly && titleOnly.length > 1 && titleOnly !== "的") return titleOnly;
            const fallback = bullets.find((item) => item.length >= 4) || "";
            return removeBrackets(fallback) || "教育背景";
        }

        function normalizeDetailEntry(entry, type = "experience") {
            if (entry && typeof entry === "object" && !Array.isArray(entry)) {
                const descriptions = Array.isArray(entry.descriptions)
                    ? entry.descriptions.flatMap((item) => splitDescriptionText(item))
                    : splitDescriptionText(entry.descriptions || "");
                const baseTitle = removeBrackets(entry.title || "");
                const title =
                    type === "experience" ? inferExperienceTitle(baseTitle, descriptions) :
                    type === "project" ? inferProjectTitle(baseTitle, descriptions) :
                    inferEducationTitle(baseTitle, descriptions);
                return {
                    date: extractDateText(entry.date || "") || extractDateText(baseTitle),
                    title,
                    bullets: descriptions.filter((item) => item !== title)
                };
            }

            const text = String(entry || "");
            const date = extractDateText(text);
            const withoutBracketTitle = text.match(/【([^】]+)】/);
            let remainder = withoutBracketTitle ? text.replace(/【[^】]+】/, "").trim() : text;
            if (date) remainder = remainder.replace(date, "").trim();

            const title =
                type === "experience"
                    ? inferExperienceTitle(withoutBracketTitle ? withoutBracketTitle[1] : remainder, splitDescriptionText(remainder))
                    : type === "project"
                        ? inferProjectTitle(withoutBracketTitle ? withoutBracketTitle[1] : remainder, splitDescriptionText(remainder))
                        : inferEducationTitle(withoutBracketTitle ? withoutBracketTitle[1] : remainder, splitDescriptionText(remainder));

            const descSource = remainder.replace(title, "").trim() || text;
            return {
                date,
                title,
                bullets: splitDescriptionText(descSource).filter((item) => item && item !== title && item !== date)
            };
        }

        function buildEntriesFromSection(sectionLines, fallbackItems, type = "generic") {
            const entries = [];
            let current = null;

            const pushCurrent = () => {
                if (!current) return;
                if (!current.bullets.length) current.bullets = splitIntoBullets(current.title);
                const normalized = normalizeDetailEntry({ title: current.title, date: extractDateText(current.title), descriptions: current.bullets }, type);
                if (normalized.title || normalized.bullets.length) entries.push(normalized);
                current = null;
            };

            for (const rawLine of sectionLines) {
                const line = cleanLine(rawLine);
                if (!line) continue;

                const isBullet = /^[-*•]|\d+[.)、]/.test(rawLine.trim());
                const looksLikeHeader = !isBullet && (/\d{4}[./年-]|\b20\d{2}\b/.test(line) || line.length <= 32);

                if (isBullet) {
                    if (!current) current = { title: "内容概览", bullets: [] };
                    current.bullets.push(line);
                } else if (!current || looksLikeHeader) {
                    pushCurrent();
                    current = { title: line, bullets: [] };
                } else {
                    current.bullets.push(line);
                }
            }
            pushCurrent();

            if (entries.length) return entries.slice(0, 6);

            return fallbackItems
                .map((item) => normalizeDetailEntry(item, type))
                .filter((entry) => entry.title && entry.title !== "的" && entry.title !== "内容概览" && entry.bullets.length);
        }

        function extractShortSkills(skills, rawText) {
            const lines = rawText.replace(/\r/g, "").split("\n").map((line) => line.trim()).filter(Boolean);
            const skillSection = pickSection(lines, sectionAliases.skills);
            const rawPool = [
                ...skills,
                ...skillSection
            ];
            const normalized = [];
            const blacklist = /姓名|基本信息|简历|毕业生|个人简历|会议传达|等工作|工作经历|项目经历|教育背景|自我评价|联系方式/;

            for (const item of rawPool) {
                const tokens = item
                    .split(/[，,、/｜|；;：:]/)
                    .map((token) => token.trim())
                    .filter(Boolean);

                for (const token of tokens) {
                    if (
                        token.length <= 8
                        && /^[A-Za-z0-9+#./&\u4e00-\u9fa5（）()]+$/.test(token)
                        && !/[，,。；;:：]/.test(token)
                        && !/负责|完成|熟练|使用|办公技能|专业技能|自我评价|工作经历|项目经历|独立|撰写|筛选|协调|处理|标准|读写|沟通|能力|经验|证书|课程|基本信息|简历|毕业生|等工作|会议传达/.test(token)
                        && !/[)）]$/.test(token)
                        && !blacklist.test(token)
                        && !normalized.includes(token)
                    ) {
                        normalized.push(token);
                    }
                }
            }

            return normalized.slice(0, 10);
        }

        function sanitizeTags(tags) {
            const blacklist = /姓名|基本信息|简历|毕业生|个人简历|会议传达|等工作|工作经历|项目经历|教育背景|自我评价|联系方式|PowerPoint|筛选/;
            const clean = [];
            for (const tag of (tags || [])) {
                const token = String(tag || "").trim();
                if (
                    token
                    && token.length <= 6
                    && !blacklist.test(token)
                    && /^[A-Za-z0-9+#./&\u4e00-\u9fa5]+$/.test(token)
                    && !clean.includes(token)
                ) {
                    clean.push(token);
                }
            }
            return clean.slice(0, 8);
        }

        function enrichProfile(profile, rawText) {
            const local = parseResumeText(rawText);
            const lines = rawText.replace(/\r/g, "").split("\n").map((line) => line.trim()).filter(Boolean);
            const experienceSection = pickSection(lines, sectionAliases.experience);
            const projectsSection = pickSection(lines, sectionAliases.projects);
            const educationSection = pickSection(lines, sectionAliases.education);

            const merged = {
                ...local,
                ...profile,
                summary: Array.isArray(profile.summary) && profile.summary.length ? profile.summary : local.summary,
                skills: Array.isArray(profile.skills) && profile.skills.length ? profile.skills : local.skills,
            };

            const experienceEntries = Array.isArray(profile.experiences) && profile.experiences.length
                ? profile.experiences.map((entry) => normalizeDetailEntry(entry, "experience"))
                : buildEntriesFromSection(experienceSection, local.experience || [], "experience");
            const projectEntriesRaw = Array.isArray(profile.projects_structured) && profile.projects_structured.length
                ? profile.projects_structured.map((entry) => normalizeDetailEntry(entry, "project"))
                : buildEntriesFromSection(projectsSection, local.projects || [], "project");
            const educationEntries = Array.isArray(profile.educations) && profile.educations.length
                ? profile.educations.map((entry) => normalizeDetailEntry(entry, "education"))
                : buildEntriesFromSection(educationSection, local.education || [], "education");
            const projectEntries = [];
            const extraHighlights = [];

            for (const entry of projectEntriesRaw) {
                if (detectIndependentProject(entry.title)) {
                    projectEntries.push(entry);
                } else {
                    extraHighlights.push(entry);
                }
            }

            return {
                ...merged,
                summary: merged.summary.filter(Boolean).slice(0, 3),
                skillTags: sanitizeTags(Array.isArray(profile.tags) && profile.tags.length ? profile.tags : extractShortSkills(merged.skills, rawText)),
                experienceEntries: experienceEntries.slice(0, 5),
                projectEntries: projectEntries.slice(0, 4),
                educationEntries: educationEntries.slice(0, 3),
                extraHighlights: extraHighlights.slice(0, 3)
            };
        }
