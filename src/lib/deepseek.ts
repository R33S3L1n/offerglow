import type { MasterProfile } from "./types";
import { localParseResume, normalizeProfile } from "./parser";

interface DeepSeekMessage {
  role: "system" | "user";
  content: string;
}

export function getDeepSeekConfig() {
  return {
    apiKey: process.env.DEEPSEEK_API_KEY || "",
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
{"profile": {"name": "string", "headline": "string", "tagline": "string", "top_metrics": [{"value": "string", "label": "string"}], "email": "string", "phone": "string", "summary": ["string"], "tags": ["string"], "experiences": [{"date": "string", "title": "string", "descriptions": ["string"]}], "projects": [{"date": "string", "title": "string", "metrics": [{"value": "string", "label": "string"}], "descriptions": ["string"]}], "educations": [{"date": "string", "title": "string", "descriptions": ["string"]}]}}

Rules:
- If a field is missing, use an empty array for list fields.
- If email or phone is missing, use an empty string.
- Do not fabricate company names, dates, metrics, or skills.
- date must contain only the original time range.
- descriptions must be an array of complete sentences.
- top_metrics: extract 1 to 4 of the most impressive quantitative numbers from the entire resume.
- metrics: extract 1 to 3 key numbers specific to each project.
- Never output meaningless placeholders.
- tagline: You MUST return a non-empty string. Write ONE short, engaging sentence (max 30 Chinese characters) about this person's most distinctive competitive quality. Be concrete, specific, and personal.

Resume text:
${rawText}`,
      },
    ]);

    if ("error" in result) {
      return { profile: localProfile, aiStructured: false, error: result.error };
    }

    const aiProfile = "profile" in result ? result.profile : result;
    const profile = normalizeProfile(aiProfile as Partial<MasterProfile>, localProfile);

    if (!profile.tagline) {
      profile.tagline = localProfile.tagline;
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

const JD_REQUIRED_SKILLS = [
  "Next.js", "TypeScript", "AI", "数据分析", "增长实验", "埋点",
  "React", "A/B Test", "SQL",
];

export function localRewrite(
  profile: MasterProfile,
  jd: string,
  companyName = ""
) {
  const source = JSON.stringify(profile).toLowerCase();
  const targetJd = jd.toLowerCase();

  const missing = JD_REQUIRED_SKILLS.filter(
    (word) => targetJd.includes(word.toLowerCase()) && !source.includes(word.toLowerCase())
  );
  const labels = missing.length > 0
    ? missing.slice(0, 3)
    : ["业务指标", "岗位关键词", "项目证据"];

  const gaps = labels.map((label, i) => ({
    label: `Gap ${i + 1}`,
    detail: `建议补充「${label}」相关证据，并确认是否真实发生过。`,
  }));

  const focus = jd
    ? jd.slice(0, 72) + (jd.length > 72 ? "..." : "")
    : "AI 产品化、数据闭环、增长实验";

  const hints = JD_REQUIRED_SKILLS.filter((word) =>
    targetJd.includes(word.toLowerCase())
  );

  const instance = { ...profile } as MasterProfile & { targetNotes: string[] };
  instance.targetNotes = [
    `围绕「${focus}」重排经历优先级。`,
    `优先强化 ${hints.length > 0 ? hints.join("、") : "岗位关键词"} 相关证据，减少泛化描述。`,
    "将工作描述改写为 STAR 结构；AI 增加的关键词需由用户确认属实后发布。",
  ];

  return {
    companyName: companyName || null,
    instanceProfile: instance,
    advantages: [
      "已有经历能支撑岗位相关项目表达。",
      "可通过 STAR 结构强化业务问题、行动和结果。",
      companyName
        ? `可以围绕「${companyName}」的岗位语境重排内容。`
        : "可以围绕目标公司语境重排内容。",
    ],
    gaps,
    anchorQuestions: gaps.map(
      (g) => `你是否有过和「${g.detail.replace(/「(.+?)」/, "$1")}」相关的真实经历？请补充背景、动作和结果。`
    ),
    matchScore: Math.min(96, 62 + hints.length * 5 + Math.floor(source.length / 320)),
    qaNotice: "当前为规则版重构。所有新增关键词都必须由用户确认属实。",
    aiRewritten: false,
  };
}
