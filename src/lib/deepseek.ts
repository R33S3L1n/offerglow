import type { MasterProfile } from "./types";
import { localParseResume, normalizeProfile } from "./parser";

interface DeepSeekMessage {
  role: "system" | "user";
  content: string;
}

export function getDeepSeekConfig() {
  return {
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.deepseek || "",
    baseUrl: (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, ""),
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  };
}

export function isDeepSeekConfigured(): boolean {
  const { apiKey } = getDeepSeekConfig();
  return !!apiKey && apiKey.length > 10;
}

async function deepseekJson(
  messages: DeepSeekMessage[],
  temperature = 0.2
): Promise<Record<string, unknown> | { error: string }> {
  const { apiKey, baseUrl, model } = getDeepSeekConfig();

  if (!apiKey || apiKey.length < 10) {
    return { error: "DEEPSEEK_API_KEY not configured" };
  }

  const payload: Record<string, unknown> = {
    model,
    messages,
    response_format: { type: "json_object" },
    temperature,
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { error: `DeepSeek API error ${res.status}: ${errText.slice(0, 200)}` };
  }

  const data = await res.json();
  let content: string = data.choices?.[0]?.message?.content || "";

  // Strip markdown code fences if present
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) content = fenced[1].trim();

  return JSON.parse(content);
}

export async function aiStructureResume(rawText: string): Promise<{
  profile: MasterProfile;
  aiStructured: boolean;
  error?: string;
}> {
  const localProfile = localParseResume(rawText);

  if (!isDeepSeekConfigured()) {
    return { profile: localProfile, aiStructured: false };
  }

  try {
    const result = await deepseekJson([
      {
        role: "system",
        content:
          "You are a resume parsing engine. Return only valid JSON. Do not invent facts.",
      },
      {
        role: "user",
        content: `Convert this resume text into JSON with this exact shape:
{"profile": {"name": "string", "headline": "string", "tagline": "string", "aboutTitle": "string", "top_metrics": [{"value": "string", "label": "string"}], "email": "string", "phone": "string", "summary": ["string"], "tags": ["string"], "experiences": [{"date": "string", "title": "string", "descriptions": ["string"]}], "projects": [{"date": "string", "title": "string", "metrics": [{"value": "string", "label": "string"}], "descriptions": ["string"]}], "educations": [{"date": "string", "title": "string", "descriptions": ["string"]}]}}

Rules:
- If a field is missing, use an empty array for list fields.
- If email or phone is missing, use an empty string.
- Do not fabricate company names, dates, metrics, or skills.
- date must contain only the original time range.
- descriptions must be an array of complete sentences.
- top_metrics: extract 1 to 4 of the most impressive quantitative numbers from the entire resume.
- metrics: extract 1 to 3 key numbers specific to each project.
- Never output meaningless placeholders.
- tagline: You MUST return a non-empty string. Write ONE short, engaging, and highly competitive personal positioning sentence (max 25 Chinese characters) about this person's most distinctive competitive quality. Be concrete, specific, and personal. Avoid generic statements like "资深前端工程师".
- aboutTitle: Write exactly two short, punchy attitude phrases reflecting their industry focus or global perspective, separated by a newline character (\n). Each phrase should be 4 to 6 Chinese characters and end with a period. Example: "全球视野。\nAI最前线。"

Resume text:
${rawText}`,
      },
    ]);

    if ("error" in result) {
      return { profile: localProfile, aiStructured: false, error: (result as { error: string }).error };
    }

    const aiProfile = "profile" in result ? result.profile : result;
    const profile = normalizeProfile(aiProfile as Partial<MasterProfile>, localProfile);

    if (!profile.tagline) {
      profile.tagline = localProfile.tagline;
    }
    if (!profile.aboutTitle) {
      profile.aboutTitle = localProfile.aboutTitle;
    }

    return { profile, aiStructured: true };
  } catch (err) {
    return {
      profile: localProfile,
      aiStructured: false,
      error: err instanceof Error ? err.message : "Unknown AI error",
    };
  }
}

export async function aiRewriteForJd(
  profile: MasterProfile,
  jd: string,
  companyName = ""
): Promise<{
  instanceProfile: MasterProfile;
  matchScore: number;
  highlights: string[];
  aiRewritten: boolean;
  error?: string;
}> {
  if (!isDeepSeekConfigured()) {
    return {
      instanceProfile: profile,
      matchScore: 0,
      highlights: [],
      aiRewritten: false,
      error: "DeepSeek API 未配置",
    };
  }

  const profileSnapshot = JSON.stringify({
    name: profile.name,
    headline: profile.headline,
    tagline: profile.tagline,
    summary: profile.summary,
    tags: profile.tags,
    experiences: profile.experiences,
    projects: profile.projects,
    educations: profile.educations,
    top_metrics: profile.top_metrics,
  }, null, 2);

  const systemPrompt = `你是一位顶级求职顾问，专门帮助求职者将简历内容精准匹配目标岗位的招聘要求。
你必须：
1. 在不捏造虚假信息的前提下，用目标岗位的关键词重新表述已有经历
2. 调整 summary（自我介绍）使其直接切入 JD 中的核心需求
3. 优化 tagline（个人定位句，不超过25字）使其更契合该岗位
4. 微调 experiences 和 projects 的描述，突出与 JD 相关的技能和成就
5. 更新 tags（专业技能）优先展示 JD 要求的技能
6. 给出 matchScore（0-100 整数）和 highlights（3条字符串，说明哪些经历最匹配）
严禁：编造未发生的经历、数据、技能`;

  const userPrompt = `目标公司：${companyName || "未知"}
目标 JD：
${jd}

当前简历 JSON：
${profileSnapshot}

请返回严格符合以下 JSON schema 的结果（只返回 JSON，不要任何解释）：
{
  "instanceProfile": {与输入 profile 相同的结构，但内容已针对 JD 优化},
  "matchScore": 整数0-100,
  "highlights": ["匹配亮点1", "匹配亮点2", "匹配亮点3"]
}`;

  try {
    const result = await deepseekJson([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], 0.4);

    if ("error" in result) {
      return { instanceProfile: profile, matchScore: 0, highlights: [], aiRewritten: false, error: result.error as string };
    }

    const raw = result as Record<string, unknown>;
    const rewritten = raw.instanceProfile as Partial<MasterProfile>;
    const merged = normalizeProfile(rewritten, profile);

    // Preserve fields not touched by AI
    merged.email = profile.email;
    merged.phone = profile.phone;
    merged.heroImage = profile.heroImage;
    merged.customSections = profile.customSections;
    merged.aboutTitle = profile.aboutTitle;
    merged.contactTitle = profile.contactTitle;

    return {
      instanceProfile: merged,
      matchScore: typeof raw.matchScore === "number" ? raw.matchScore : 70,
      highlights: Array.isArray(raw.highlights) ? (raw.highlights as string[]).slice(0, 3) : [],
      aiRewritten: true,
    };
  } catch (err) {
    return {
      instanceProfile: profile,
      matchScore: 0,
      highlights: [],
      aiRewritten: false,
      error: err instanceof Error ? err.message : "AI 改写失败",
    };
  }
}
