import type { MasterProfile, StructuredEntry, Metric } from "./types";

// ---- Constants ----

const SECTION_ALIASES: Record<string, string[]> = {
  summary: [
    "个人概览", "个人简介", "简介", "概览", "自我评价", "自我介绍", "个人优势",
    "summary", "profile", "about",
  ],
  experience: [
    "工作经历", "工作经验", "职业经历", "实习经历", "实践经历",
    "experience", "work experience", "work",
  ],
  projects: [
    "项目经历", "项目经验", "项目", "代表项目", "校园实践", "志愿活动",
    "校园实践/志愿活动", "project", "projects",
  ],
  education: [
    "教育背景", "教育经历", "教育", "学历", "education", "academic",
  ],
  skills: [
    "技能", "能力", "专业技能", "核心技能", "skill", "skills",
  ],
};

const ALL_SECTION_NAMES = Object.values(SECTION_ALIASES).flat();

const HEADING_RE = new RegExp(
  `^(?:${ALL_SECTION_NAMES
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})(?:\\s*[:：])?$`,
  "i"
);

const DATE_RE =
  /(?:19|20)\d{2}(?:[./-]\d{1,2}|年\d{1,2}月?)?(?:\s*[-~—至]+\s*(?:(?:19|20)\d{2}(?:[./-]\d{1,2}|年\d{1,2}月?)?|至今|现在))?/i;

const DEFAULT_PROFILE: MasterProfile = {
  name: "你的名字",
  headline: "",
  tagline: "",
  email: "",
  phone: "",
  summary: [],
  tags: [],
  top_metrics: [],
  experiences: [],
  projects: [],
  educations: [],
};

// ---- Text utilities ----

function cleanLine(line: string): string {
  return line.replace(/^(?:[-*•]\s*|\d+[.)、]\s*)/, "").trim();
}

function normalizeHeading(line: string): string {
  return line.trim().replace(/\s+/g, " ").replace(/[:：]\s*$/, "").toLowerCase();
}

function isHeading(line: string): boolean {
  return HEADING_RE.test(line.trim());
}

function pickSection(lines: string[], names: string[]): string[] {
  const normalized = new Set(names.map(normalizeHeading));
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (normalized.has(normalizeHeading(lines[i]))) {
      start = i;
      break;
    }
  }
  if (start === -1) return [];

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (isHeading(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).map(cleanLine).filter(Boolean);
}

function extractLabeledValue(text: string, labels: string[]): string {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(`${escaped}\\s*[：:]\\s*(.+)`).exec(text);
    if (m) return m[1].trim();
  }
  return "";
}

function isContactLine(line: string): boolean {
  const lower = line.toLowerCase();
  return !!(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(line) ||
    /(?:\+?\d{1,3}[-\s]?)?(?:1[3-9]\d{9}|\d{3,4}[-\s]?\d{7,8}|\d{3}[-\s]?\d{3,4}[-\s]?\d{4})/.test(line) ||
    lower.includes("@") ||
    ["电话", "手机", "邮箱", "email", "tel", "wechat", "微信"].some((k) =>
      lower.includes(k)
    )
  );
}

// ---- Name & headline detection ----

function detectName(lines: string[]): string {
  for (const line of lines.slice(0, 6)) {
    const candidate = line.trim();
    if (
      candidate.length > 1 &&
      candidate.length <= 24 &&
      !isHeading(candidate) &&
      !isContactLine(candidate) &&
      !/\d/.test(candidate) &&
      !/(工程师|经理|负责人|设计师|开发|运营|产品|marketing|engineer|manager|designer)/i.test(
        candidate
      )
    ) {
      return candidate;
    }
  }
  return DEFAULT_PROFILE.name;
}

function detectHeadline(lines: string[], name: string): string {
  for (const line of lines.slice(0, 10)) {
    const candidate = line.trim();
    if (
      candidate &&
      candidate !== name &&
      !isHeading(candidate) &&
      !isContactLine(candidate) &&
      candidate.length <= 80 &&
      !/(毕业生个人简历|个人简历|基本信息|姓名)/.test(candidate) &&
      /(工程师|经理|负责人|设计|开发|运营|产品|增长|marketing|engineer|manager|designer|lead|frontend|product)/i.test(
        candidate
      )
    ) {
      return candidate;
    }
  }
  // Fallback to first non-name, non-heading line
  for (const line of lines.slice(0, 10)) {
    const candidate = line.trim();
    if (
      candidate &&
      candidate !== name &&
      !isHeading(candidate) &&
      !isContactLine(candidate) &&
      candidate.length <= 36 &&
      !/(毕业生个人简历|个人简历|基本信息|姓名)/.test(candidate)
    ) {
      return candidate;
    }
  }
  return DEFAULT_PROFILE.headline;
}

// ---- Section compression ----

function compressSection(lines: string[], limit = 6): string[] {
  const items: string[] = [];
  const buffer: string[] = [];

  for (const raw of lines) {
    const line = cleanLine(raw);
    if (!line) continue;

    if (DATE_RE.test(line) && buffer.length > 0) {
      items.push(buffer.join(" ").trim());
      buffer.length = 0;
      buffer.push(line);
    } else if (
      ["负责", "主导", "参与", "推动", "完成", "搭建", "设计", "优化"].some((p) =>
        line.startsWith(p)
      ) &&
      buffer.length > 0
    ) {
      buffer.push(line);
    } else if (line.length <= 38 && buffer.length > 0 && buffer[buffer.length - 1].length > 45) {
      items.push(buffer.join(" ").trim());
      buffer.length = 0;
      buffer.push(line);
    } else {
      buffer.push(line);
    }
  }
  if (buffer.length > 0) {
    items.push(buffer.join(" ").trim());
  }

  const cleaned = items
    .map((i) => i.replace(/\s+/g, " ").trim())
    .filter((i, idx, arr) => i && arr.indexOf(i) === idx);

  return cleaned.slice(0, limit);
}

// ---- Structured entry parsing ----

function extractDateText(text: string): string {
  const m = DATE_RE.exec(text || "");
  return m ? m[0].replace(/\s+/g, "") : "";
}

function stripBrackets(text: string): string {
  return cleanLine((text || "").replace(/[【】\[\]]/g, ""));
}

function splitDescriptions(text: string): string[] {
  return text
    .split(/\n+|(?=\d+[.)、]\s*)|(?=[-*•]\s*)|[；;。]+/)
    .map(cleanLine)
    .filter(Boolean);
}

function inferStructuredTitle(text: string, kind = "experience"): string {
  let base = stripBrackets(text.replace(DATE_RE, "")).replace(/^\s*[-/|：:\s]+/, "").replace(/\s*[-/|：:\s]+$/, "");

  if (!base) return "";

  if (kind === "experience") {
    const m = /([^\s/|]+?(?:公司|集团|科技|信息|中心|学校|学院|银行|医院|协会|大学|政府|事务所|传媒|酒店|超市|工作室|委员会|办公室|局|院))[/| -]+(.+)/.exec(base);
    if (m) return `${cleanLine(m[1])} - ${cleanLine(m[2])}`;
  }
  if (kind === "education") {
    const m = /([^\s/|]+?(?:大学|学院|学校))[\s/| -]+(.+)/.exec(base);
    if (m) return `${cleanLine(m[1])} - ${cleanLine(m[2]).replace(/\s*(本科|专科)/g, "")}`;
  }

  for (const marker of ["负责", "协助", "参与", "主导", "处理", "完成", "统筹", "制定", "撰写", "组织", "开展", "跟进", "协同", "核心课程", "荣誉奖项", "证书资质"]) {
    const idx = base.indexOf(marker);
    if (idx > 0) return base.slice(0, idx).replace(/\s*[-/|：:\s]+$/, "");
  }
  return base.replace(/[，,；;：:]+$/, "");
}

function parseStructuredEntries(
  sectionLines: string[],
  kind = "experience",
  limit = 6
): StructuredEntry[] {
  const entries: StructuredEntry[] = [];
  let current: { header: string; body: string[] } | null = null;

  function pushCurrent() {
    if (!current) return;
    const rawTitle = current.header;
    const date =
      extractDateText(rawTitle) || extractDateText(current.body.join(" "));
    const title = inferStructuredTitle(rawTitle, kind);
    let descriptions: string[] = [];
    for (const item of current.body) {
      descriptions.push(...splitDescriptions(item));
    }
    if (descriptions.length === 0) {
      let descSource = rawTitle.replace(DATE_RE, "");
      descSource = descSource.replace(title, "").trim();
      descriptions = splitDescriptions(descSource);
    }
    descriptions = descriptions.filter(
      (d) => d && d !== title && d !== date
    );
    if (title && descriptions.length > 0) {
      entries.push({ date, title, descriptions: descriptions.slice(0, 6) });
    }
    current = null;
  }

  for (const raw of sectionLines) {
    const line = cleanLine(raw);
    if (!line) continue;

    const isBullet = /^(?:[-*•]|\d+[.)、])/.test(raw.trim());
    const startsEntry =
      /^(?:19|20)\d{2}/.test(line) ||
      (!isBullet && line.length <= 36 && !!current && current.body.length > 0);

    if (isBullet) {
      if (!current) current = { header: "", body: [] };
      current.body.push(line);
    } else if (!current) {
      current = { header: line, body: [] };
    } else if (startsEntry) {
      pushCurrent();
      current = { header: line, body: [] };
    } else {
      current.body.push(line);
    }
  }
  pushCurrent();
  return entries.slice(0, limit);
}

// ---- Skills & tags ----

function extractSkillTags(skillLines: string[]): string[] {
  const tokens: string[] = [];
  const joined = skillLines.join("\n");

  const explicitMap: [string, string][] = [
    ["Excel", "Excel"], ["Word", "Word"], ["PPT制作", "PowerPoint|PPT"],
    ["数据统计", "数据统计"], ["公文写作", "公文写作"], ["报表制作", "报表制作"],
    ["考勤管理", "考勤"], ["VLOOKUP", "VLOOKUP"], ["英语读写", "英语.*读写"],
    ["普通话", "普通话"], ["PS", "\\bPS\\b|图片编辑"],
    ["组织协调", "组织协调"], ["活动策划", "活动策划"],
  ];
  for (const [label, pattern] of explicitMap) {
    if (new RegExp(pattern, "i").test(joined) && !tokens.includes(label)) {
      tokens.push(label);
    }
  }

  const blacklist =
    /姓名|基本信息|简历|毕业生|个人简历|会议传达|等工作|工作经历|项目经历|教育背景|自我评价|联系方式|熟练使用|负责|完成|处理|协调|办公技能|语言能力|专业能力|其他技能|文档|求和|筛选/;

  for (const line of skillLines) {
    const cleaned = line.replace(/^[^：:]{1,8}[：:]\s*/, "");
    for (const token of cleaned.split(/[，,、/|｜；;：:\s（）()]+/)) {
      const t = cleanLine(token);
      if (
        t &&
        t.length <= 6 &&
        /^[A-Za-z0-9+#./&一-龥]+$/.test(t) &&
        !blacklist.test(t) &&
        !tokens.includes(t)
      ) {
        tokens.push(t);
      }
    }
  }
  return tokens.slice(0, 10);
}

// ---- Tagline generation ----

function generateTagline(
  experiences: StructuredEntry[],
  summary: string[],
  headline: string
): string {
  for (const exp of experiences.slice(0, 3)) {
    for (const desc of exp.descriptions.slice(0, 4)) {
      if (/\d/.test(desc) && desc.length >= 8 && desc.length <= 35) {
        return desc;
      }
    }
  }
  if (summary.length > 0 && summary[0].length <= 35) return summary[0];
  return headline.length <= 25 ? headline : "";
}

// ---- Main parser ----

export function localParseResume(rawText: string): MasterProfile {
  const lines = rawText.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean);

  const name = extractLabeledValue(rawText, ["姓名"]) || detectName(lines);
  const headline =
    extractLabeledValue(rawText, ["求职意向"]) || detectHeadline(lines, name);

  const summary = pickSection(lines, SECTION_ALIASES.summary);
  const experience = pickSection(lines, SECTION_ALIASES.experience);
  const projects = pickSection(lines, SECTION_ALIASES.projects);
  const education = pickSection(lines, SECTION_ALIASES.education);
  const skillsRaw = pickSection(lines, SECTION_ALIASES.skills);

  const emailMatch = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(rawText);
  const email =
    extractLabeledValue(rawText, ["电子邮箱", "邮箱"]) ||
    (emailMatch ? emailMatch[0] : "");
  const phone = extractLabeledValue(rawText, ["联系电话", "电话", "手机"]);

  const body = lines.map(cleanLine).filter(Boolean);
  const summaryParsed = summary.length > 0
    ? compressSection(summary, 3)
    : body.filter(
        (l) =>
          l !== name &&
          l !== headline &&
          !isHeading(l) &&
          !isContactLine(l) &&
          l.length >= 12
      ).slice(0, 3);

  const experiences = experience.length > 0
    ? parseStructuredEntries(experience, "experience", 4)
    : parseStructuredEntries(
        body.filter(
          (l) =>
            !summary.includes(l) &&
            !projects.includes(l) &&
            !education.includes(l) &&
            !isContactLine(l) &&
            !isHeading(l)
        ),
        "experience",
        4
      );

  const projectEntries = projects.length > 0
    ? parseStructuredEntries(projects, "project", 4)
    : [];

  const educations = education.length > 0
    ? parseStructuredEntries(education, "education", 3)
    : [];

  let skills = skillsRaw.length > 0
    ? skillsRaw.join(",").split(/[，,、/|｜；;]/).map(cleanLine).filter(Boolean)
    : rawText.match(/\b[A-Za-z][A-Za-z0-9.+#/ -]{1,20}\b/g)?.filter(
        (s) => {
          const lower = s.toLowerCase();
          return (
            !["work", "experience", "project", "education", "summary"].includes(lower) &&
            s.length >= 2 &&
            s.length <= 24
          );
        }
      ).filter((s, i, arr) => arr.indexOf(s) === i).slice(0, 6) || [];

  const tags = extractSkillTags(skillsRaw.length > 0 ? skillsRaw : skills);

  const tagline = generateTagline(experiences, summaryParsed, headline);

  // Extract top metrics
  const topMetrics: Metric[] = [];
  const allText = rawText.replace(/\n/g, " ");
  const metricMatches = allText.matchAll(
    /(\d+%|\d+\+?|[\d.]+[MkK万])\s*([^\s,，。]{2,6})/g
  );
  for (const m of metricMatches) {
    if (m[2].length <= 6 && topMetrics.length < 4) {
      topMetrics.push({ value: m[1], label: m[2] });
    }
  }

  for (const p of projectEntries) {
    if (!p.metrics) p.metrics = [];
  }

  return {
    name,
    headline,
    tagline,
    email,
    phone,
    summary: summaryParsed,
    tags,
    top_metrics: topMetrics,
    experiences,
    projects: projectEntries,
    educations,
  };
}

// ---- Profile normalization ----

export function normalizeProfile(
  profile: Partial<MasterProfile> | null,
  fallback?: MasterProfile
): MasterProfile {
  const fb = fallback || DEFAULT_PROFILE;
  const result = { ...fb };

  if (profile && typeof profile === "object") {
    for (const key of ["name", "headline", "tagline", "email", "phone"] as const) {
      if (profile[key]) result[key] = String(profile[key]).trim();
    }
    for (const key of [
      "summary", "tags", "experiences", "projects", "educations", "top_metrics",
    ] as const) {
      if (profile[key] && Array.isArray(profile[key]) && profile[key].length > 0) {
        (result as Record<string, unknown>)[key] = profile[key];
      }
    }
  }

  for (const project of result.projects) {
    if (!Array.isArray(project.metrics)) project.metrics = [];
  }
  for (const k of ["summary", "tags"] as const) {
    result[k] = (result[k] || []).map((i) => String(i).trim()).filter(Boolean);
  }
  return result;
}
