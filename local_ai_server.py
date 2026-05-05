#!/usr/bin/env python3
import json
import os
import re
import urllib.error
import urllib.request
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


ROOT = os.path.dirname(os.path.abspath(__file__))


def load_env():
    env_path = os.path.join(ROOT, ".env.local")
    if not os.path.exists(env_path):
        return

    with open(env_path, "r", encoding="utf-8") as env_file:
        for line in env_file:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key, value)


def current_deepseek_model():
    return os.environ.get("DEEPSEEK_MODEL", "deepseek-v4-pro").strip() or "deepseek-v4-pro"


def clean_line(line):
    return re.sub(r"^(?:[-*•]\s*|\d+[.)、]\s*)", "", line).strip()


SECTION_ALIASES = {
    "summary": ["个人概览", "个人简介", "简介", "概览", "自我评价", "自我介绍", "个人优势", "summary", "profile", "about"],
    "experience": ["工作经历", "工作经验", "职业经历", "实习经历", "实践经历", "experience", "work experience", "work"],
    "projects": ["项目经历", "项目经验", "项目", "代表项目", "校园实践", "志愿活动", "校园实践/志愿活动", "project", "projects"],
    "education": ["教育背景", "教育经历", "教育", "学历", "education", "academic"],
    "skills": ["技能", "能力", "专业技能", "核心技能", "skill", "skills"],
}

ALL_SECTION_NAMES = [alias for names in SECTION_ALIASES.values() for alias in names]
SECTION_HEADING_RE = re.compile(
    r"^(?:"
    + "|".join(re.escape(name) for name in sorted(ALL_SECTION_NAMES, key=len, reverse=True))
    + r")(?:\s*[:：])?$",
    re.I,
)


def normalize_heading(line):
    return re.sub(r"\s+", " ", line.strip().strip(":：")).lower()


def is_heading(line):
    return bool(SECTION_HEADING_RE.match(line.strip()))


def pick_section(lines, names):
    normalized = {normalize_heading(name) for name in names}
    start = -1

    for index, line in enumerate(lines):
        if normalize_heading(line) in normalized:
            start = index
            break

    if start == -1:
        return []

    end = len(lines)
    for index in range(start + 1, len(lines)):
        if is_heading(lines[index]):
            end = index
            break

    return [clean_line(line) for line in lines[start + 1 : end] if clean_line(line)]


def split_list(text):
    return [clean_line(item) for item in re.split(r"[\n,，、；;]", text) if clean_line(item)]


def extract_labeled_value(raw_text, labels):
    for label in labels:
        pattern = re.compile(rf"{re.escape(label)}\s*[：:]\s*(.+)")
        match = pattern.search(raw_text)
        if match:
            return match.group(1).strip()
    return ""


def is_contact_line(line):
    lowered = line.lower()
    return bool(
        re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", line, re.I)
        or re.search(r"(?:\+?\d{1,3}[-\s]?)?(?:1[3-9]\d{9}|\d{3,4}[-\s]?\d{7,8}|\d{3}[-\s]?\d{3,4}[-\s]?\d{4})", line)
        or "@" in lowered
        or "电话" in line
        or "手机" in line
        or "邮箱" in line
        or "email" in lowered
        or "tel" in lowered
        or "wechat" in lowered
        or "微信" in line
    )


def detect_name(lines):
    for line in lines[:6]:
        candidate = line.strip()
        if (
            1 < len(candidate) <= 24
            and not is_heading(candidate)
            and not is_contact_line(candidate)
            and not re.search(r"\d", candidate)
            and not re.search(r"(工程师|经理|负责人|设计师|开发|运营|产品|marketing|engineer|manager|designer)", candidate, re.I)
        ):
            return candidate
    return DEFAULT_PROFILE["name"]


def detect_headline(lines, name):
    for line in lines[:10]:
        candidate = line.strip()
        if (
            candidate
            and candidate != name
            and not is_heading(candidate)
            and not is_contact_line(candidate)
            and len(candidate) <= 80
            and not re.search(r"(毕业生个人简历|个人简历|基本信息|姓名)", candidate)
            and re.search(r"(工程师|经理|负责人|设计|开发|运营|产品|增长|marketing|engineer|manager|designer|lead|frontend|product)", candidate, re.I)
        ):
            return candidate

    for line in lines[:10]:
        candidate = line.strip()
        if candidate and candidate != name and not is_heading(candidate) and not is_contact_line(candidate) and len(candidate) <= 36 and not re.search(r"(毕业生个人简历|个人简历|基本信息|姓名)", candidate):
            return candidate

    return DEFAULT_PROFILE["headline"]


def fallback_summary(lines, name, headline):
    summary = []
    for line in lines:
        candidate = clean_line(line)
        if (
            candidate
            and candidate != name
            and candidate != headline
            and not is_heading(candidate)
            and not is_contact_line(candidate)
            and len(candidate) >= 12
        ):
            summary.append(candidate)
        if len(summary) >= 2:
            break
    return summary


def compress_section(lines, limit=6):
    items = []
    buffer = []
    entry_start_re = re.compile(
        r"(\d{4}[./年\-]\d{1,2}|\d{4}[./年\-](?:至今|现在)|\d{4}\s*[-~—至]+\s*(?:\d{4}|\d{1,2}|至今|现在)|\b20\d{2}\b)",
        re.I,
    )

    for raw in lines:
        line = clean_line(raw)
        if not line:
            continue

        if entry_start_re.search(line) and buffer:
            items.append(" ".join(buffer).strip())
            buffer = [line]
        elif line.startswith(("负责", "主导", "参与", "推动", "完成", "搭建", "设计", "优化")) and buffer:
            buffer.append(line)
        elif len(line) <= 38 and buffer and len(buffer[-1]) > 45:
            items.append(" ".join(buffer).strip())
            buffer = [line]
        else:
            buffer.append(line)

    if buffer:
        items.append(" ".join(buffer).strip())

    cleaned = []
    for item in items:
        short = re.sub(r"\s+", " ", item).strip()
        if short and short not in cleaned:
            cleaned.append(short)
    return cleaned[:limit]


DATE_RE = re.compile(
    r"(?:19|20)\d{2}(?:[./-]\d{1,2}|年\d{1,2}月?)?(?:\s*[-~—至]+\s*(?:(?:19|20)\d{2}(?:[./-]\d{1,2}|年\d{1,2}月?)?|至今|现在))?",
    re.I,
)


def extract_date_text(text):
    match = DATE_RE.search(text or "")
    return re.sub(r"\s+", "", match.group(0)) if match else ""


def strip_brackets(text):
    return clean_line(re.sub(r"[【】\[\]]", "", text or ""))


def split_descriptions(text):
    parts = re.split(r"\n+|(?=\d+[.)、]\s*)|(?=[-*•]\s*)|[；;。]+", text or "")
    return [clean_line(part) for part in parts if clean_line(part)]


def infer_structured_title(text, kind="experience"):
    base = strip_brackets(re.sub(DATE_RE, "", text or "")).strip(" -/|：:")
    if not base:
        return ""

    if kind == "experience":
        match = re.search(
            r"([^\s/|]+?(?:公司|集团|科技|信息|中心|学校|学院|银行|医院|协会|大学|政府|事务所|传媒|酒店|超市|工作室|委员会|办公室|局|院))[/| -]+(.+)",
            base,
        )
        if match:
            return f"{clean_line(match.group(1))} - {clean_line(match.group(2))}"
    if kind == "education":
        match = re.search(r"([^\s/|]+?(?:大学|学院|学校))[\s/| -]+(.+)", base)
        if match:
            major = clean_line(match.group(2)).replace(" 本科", "").replace(" 专科", "")
            return f"{clean_line(match.group(1))} - {major}"

    for marker in ["负责", "协助", "参与", "主导", "处理", "完成", "统筹", "制定", "撰写", "组织", "开展", "跟进", "协同", "核心课程", "荣誉奖项", "证书资质"]:
        idx = base.find(marker)
        if idx > 0:
            return base[:idx].strip(" -/|：:")
    return base.rstrip("，,；;：:")


def parse_structured_entries(section_lines, kind="experience", limit=6):
    entries = []
    current = None

    def push_current():
        nonlocal current
        if not current:
            return
        raw_title = current["header"]
        date = extract_date_text(raw_title) or extract_date_text(" ".join(current["body"]))
        title = infer_structured_title(raw_title, kind)
        descriptions = []
        for item in current["body"]:
            descriptions.extend(split_descriptions(item))
        if not descriptions:
            desc_source = re.sub(DATE_RE, "", raw_title or "")
            desc_source = desc_source.replace(title, "").strip()
            descriptions = split_descriptions(desc_source)
        descriptions = [item for item in descriptions if item and item != title and item != date]
        if title and descriptions:
            entries.append({"date": date, "title": title, "descriptions": descriptions[:6]})
        current = None

    for raw in section_lines:
        line = clean_line(raw)
        if not line:
            continue
        is_bullet = bool(re.match(r"^(?:[-*•]|\d+[.)、])", raw.strip()))
        starts_entry = bool(re.match(r"^(?:19|20)\d{2}", line)) or (not is_bullet and len(line) <= 36 and current and current["body"])

        if is_bullet:
            if not current:
                current = {"header": "", "body": []}
            current["body"].append(line)
        elif current is None:
            current = {"header": line, "body": []}
        elif starts_entry:
            push_current()
            current = {"header": line, "body": []}
        else:
            current["body"].append(line)

    push_current()
    return entries[:limit]


def extract_skill_tags(skill_lines):
    tokens = []
    joined = "\n".join(skill_lines)
    explicit_map = [
        ("Excel", r"Excel"),
        ("Word", r"Word"),
        ("PPT制作", r"PowerPoint|PPT"),
        ("数据统计", r"数据统计"),
        ("公文写作", r"公文写作"),
        ("报表制作", r"报表制作"),
        ("考勤管理", r"考勤"),
        ("VLOOKUP", r"VLOOKUP"),
        ("英语读写", r"英语.*读写"),
        ("普通话", r"普通话"),
        ("PS", r"\bPS\b|图片编辑"),
        ("组织协调", r"组织协调"),
        ("活动策划", r"活动策划"),
    ]
    for label, pattern in explicit_map:
        if re.search(pattern, joined, re.I) and label not in tokens:
            tokens.append(label)

    blacklist = re.compile(r"姓名|基本信息|简历|毕业生|个人简历|会议传达|等工作|工作经历|项目经历|教育背景|自我评价|联系方式|熟练使用|负责|完成|处理|协调|办公技能|语言能力|专业能力|其他技能|文档|求和|筛选")
    for line in skill_lines:
        line = re.sub(r"^[^：:]{1,8}[：:]\s*", "", line)
        for token in re.split(r"[，,、/|｜；;：:\s（）()]+", line):
            token = clean_line(token)
            if (
                token
                and len(token) <= 6
                and re.fullmatch(r"[A-Za-z0-9+#./&\u4e00-\u9fa5]+", token)
                and not blacklist.search(token)
                and token not in tokens
            ):
                tokens.append(token)
    return tokens[:10]


DEFAULT_PROFILE = {
    "name": "林一然",
    "headline": "AI Product Frontend Engineer · Growth Systems",
    "tagline": "",
    "email": "reese@example.com",
    "phone": "138-0000-0000",
    "summary": [
        "5 年前端与增长产品经验，擅长把复杂 B2B 流程转化为清晰的用户路径。",
        "主导过简历解析、智能推荐、数据看板等 AI 工作流模块从 0 到 1 落地。",
    ],
    "top_metrics": [
        {"value": "130+", "label": "种子用户"},
        {"value": "2000+", "label": "全平台粉丝"}
    ],
    "tags": ["Next.js", "TypeScript", "Tailwind", "前端", "增长"],
    "experiences": [],
    "projects": [],
    "educations": [],
}


def generate_local_tagline(experiences, educations, summary, headline):
    """Generate a fallback tagline from parsed resume data."""
    # Try to find a short, metric-rich description from experiences
    for exp in experiences[:3]:
        for desc in exp.get("descriptions", [])[:4]:
            if re.search(r"\d+", desc) and 8 <= len(desc) <= 35:
                return desc
    # Try first summary sentence
    if summary:
        first = summary[0]
        if len(first) <= 35:
            return first
        # Truncate sensibly
        return first[:30] + "…"
    # Fallback to headline
    if headline and len(headline) <= 25:
        return headline
    return ""


def local_parse_resume(raw_text):
    lines = [line.strip() for line in raw_text.replace("\r", "").split("\n") if line.strip()]
    name = extract_labeled_value(raw_text, ["姓名"]) or detect_name(lines)
    headline = extract_labeled_value(raw_text, ["求职意向"]) or detect_headline(lines, name)
    body = [clean_line(line) for line in lines if clean_line(line)]
    summary = pick_section(lines, SECTION_ALIASES["summary"])
    experience = pick_section(lines, SECTION_ALIASES["experience"])
    projects = pick_section(lines, SECTION_ALIASES["projects"])
    education = pick_section(lines, SECTION_ALIASES["education"])
    skills_raw = pick_section(lines, SECTION_ALIASES["skills"])
    email_match = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", raw_text, re.I)
    email = extract_labeled_value(raw_text, ["电子邮箱", "邮箱"]) or (email_match.group(0) if email_match else "")
    phone = extract_labeled_value(raw_text, ["联系电话", "电话", "手机"])

    summary = compress_section(summary, limit=3) if summary else fallback_summary(lines, name, headline)
    experiences = parse_structured_entries(experience, kind="experience", limit=4) if experience else []
    project_entries = parse_structured_entries(projects, kind="project", limit=4) if projects else []
    educations = parse_structured_entries(education, kind="education", limit=3) if education else []
    skills = split_list(",".join(skills_raw)) if skills_raw else []
    tags = extract_skill_tags(skills_raw if skills_raw else skills)
    tagline = generate_local_tagline(experiences, educations, summary, headline)

    if not experiences:
        generic_lines = [
            line
            for line in body
            if line not in summary and line not in projects and line not in education and not is_contact_line(line) and not is_heading(line)
        ]
        experiences = parse_structured_entries(generic_lines, kind="experience", limit=4)

    if not project_entries and experiences:
        project_entries = []

    if not skills:
        skill_candidates = re.findall(r"\b[A-Za-z][A-Za-z0-9.+#/ -]{1,20}\b", raw_text)
        common = []
        for item in skill_candidates:
            candidate = item.strip()
            if candidate.lower() in {"work", "experience", "project", "education", "summary"}:
                continue
            if 2 <= len(candidate) <= 24 and candidate not in common:
                common.append(candidate)
        skills = common[:6]
    if not tags:
        tags = [item for item in skills if len(item) <= 6][:5]

    # Simple local metric extraction for fallback
    top_metrics = []
    all_text = raw_text.replace('\n', ' ')
    # Look for numbers followed by units or common metric words
    matches = re.findall(r'(\d+%|\d+\+?|[\d.]+[Mk万])\s*([^\s,，。]{2,6})', all_text)
    for val, lab in matches[:4]:
        if len(lab) <= 6:
            top_metrics.append({"value": val, "label": lab})

    # Ensure projects have metrics key
    for p in project_entries:
        if "metrics" not in p:
            p["metrics"] = []

    return {
        "name": name,
        "headline": headline,
        "tagline": tagline,
        "email": email if email else "",
        "phone": phone if phone else "",
        "summary": summary[:4] if summary else body[:2],
        "tags": tags,
        "top_metrics": top_metrics,
        "experiences": experiences,
        "projects": project_entries,
        "educations": educations,
    }


def normalize_profile(profile, fallback=None):
    fallback = fallback or DEFAULT_PROFILE
    result = dict(fallback)
    
    if isinstance(profile, dict):
        # Update name, headline, tagline etc.
        for key in ["name", "headline", "tagline", "email", "phone"]:
            if profile.get(key):
                result[key] = str(profile[key]).strip()
        
        # Update lists only if not empty
        for key in ["summary", "tags", "experiences", "projects", "educations", "top_metrics"]:
            if profile.get(key) and isinstance(profile[key], list) and len(profile[key]) > 0:
                result[key] = profile[key]

    # Ensure projects have metrics
    for project in result.get("projects", []):
        if not isinstance(project.get("metrics"), list):
            project["metrics"] = []
            
    # Final cleanup of summary and tags
    for key in ["summary", "tags"]:
        value = result.get(key)
        result[key] = [str(item).strip() for item in value if str(item).strip()] if isinstance(value, list) else []

    return result


def deepseek_json(messages):
    api_key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not api_key or "把你的" in api_key:
        return None

    base_url = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
    model = current_deepseek_model()
    thinking_type = os.environ.get("DEEPSEEK_THINKING_TYPE", "enabled").strip().lower() or "enabled"
    reasoning_effort = os.environ.get("DEEPSEEK_REASONING_EFFORT", "high").strip().lower() or "high"
    payload = {
        "model": model,
        "messages": messages,
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }
    if model in {"deepseek-v4-pro", "deepseek-v4-flash", "deepseek-chat", "deepseek-reasoner"}:
        payload["thinking"] = {"type": "enabled" if thinking_type not in {"enabled", "disabled"} else thinking_type}
        payload["reasoning_effort"] = "max" if reasoning_effort == "max" else "high"
    request = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=60) as response:
        data = json.loads(response.read().decode("utf-8"))
        content = data["choices"][0]["message"]["content"].strip()
        fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", content, re.I)
        return json.loads(fenced.group(1) if fenced else content)


def ai_structure_resume(raw_text):
    local_profile = local_parse_resume(raw_text)
    try:
        result = deepseek_json(
            [
                {
                    "role": "system",
                    "content": "You are a resume parsing engine. Return only valid JSON. Do not invent facts.",
                },
                {
                    "role": "user",
                    "content": f"""Convert this resume text into JSON with this exact shape:
{{"profile": {{"name": "string", "headline": "string", "tagline": "string", "top_metrics": [{{"value": "string", "label": "string"}}], "email": "string", "phone": "string", "summary": ["string"], "tags": ["string"], "experiences": [{{"date": "string", "title": "string", "descriptions": ["string"]}}], "projects": [{{"date": "string", "title": "string", "metrics": [{{"value": "string", "label": "string"}}], "descriptions": ["string"]}}], "educations": [{{"date": "string", "title": "string", "descriptions": ["string"]}}]}}}}

Rules:
- If a field is missing, use an empty array for list fields.
- If email or phone is missing, use an empty string.
- Do not fabricate company names, dates, metrics, or skills.
- date must contain only the original time range.
- descriptions must be an array of complete sentences.
- top_metrics: extract 1 to 4 of the most impressive quantitative numbers (e.g. "300k", "2000+", "15%") from the entire resume. "value" is the number/metric, "label" is a very short context (e.g., "种子用户").
- metrics: extract 1 to 3 key numbers specific to each project. "value" is the number, "label" is the context.
- Never output meaningless placeholders such as 内容1, 内容2.
- tagline: You MUST return a non-empty string. Write ONE short, interesting, specific sentence (max 30 Chinese characters) about this person's most distinctive competitive quality. Be concrete and personal — mention actual numbers, roles, or achievements from the resume. Do NOT use generic phrases like "责任心强", "踏实勤奋", or "认真负责". Good examples: "组织过12场活动、纪要准确率100%的应届生", "降低了8%办公成本的实习行政新人".

Resume text:
{raw_text}""",
                },
            ]
        )
        profile = normalize_profile(result.get("profile"), local_profile)
        # If AI didn't return tagline, fall back to local one
        if not profile.get("tagline"):
            profile["tagline"] = local_profile.get("tagline", "")
        return profile, True
    except Exception:
        return local_profile, False


def local_gaps(profile, jd):
    source = json.dumps(profile, ensure_ascii=False).lower()
    required = ["Next.js", "TypeScript", "AI", "数据分析", "增长实验", "埋点", "React", "A/B Test", "SQL"]
    missing = [word for word in required if word.lower() in jd.lower() and word.lower() not in source]
    labels = (missing or ["业务指标", "岗位关键词", "项目证据"])[:3]
    return [{"label": f"Gap {index + 1}", "detail": f"建议补充「{label}」相关证据，并确认是否真实发生过。"} for index, label in enumerate(labels)]


def score_match(profile, jd):
    source = json.dumps(profile, ensure_ascii=False).lower()
    target = jd.lower()
    words = ["ai", "next", "type", "数据", "增长", "产品", "前端", "追踪", "react", "埋点", "sql"]
    hits = len([word for word in words if word in source and word in target])
    return min(96, 62 + hits * 5 + len(source) // 320)


def local_rewrite(profile, jd, company_name=""):
    focus = jd[:72] + ("..." if len(jd) > 72 else "") if jd else "AI 产品化、数据闭环、增长实验"
    hints = [word for word in ["AI", "数据", "增长", "Next.js", "TypeScript", "SQL"] if word.lower() in jd.lower()]
    instance = dict(profile)
    instance["targetNotes"] = [
        f"围绕「{focus}」重排经历优先级。",
        f"优先强化 {'、'.join(hints) if hints else '岗位关键词'} 相关证据，减少泛化描述。",
        "将工作描述改写为 STAR 结构；AI 增加的关键词需由用户确认属实后发布。",
    ]
    instance["experience"] = [f"{item} 对齐目标 JD 后，补充了业务问题、前端动作和可验证结果。" for item in profile.get("experience", [])]
    gaps = local_gaps(profile, jd)
    return {
        "companyName": company_name or None,
        "instanceProfile": instance,
        "advantages": [
            "已有经历能支撑岗位相关项目表达。",
            "可通过 STAR 结构强化业务问题、行动和结果。",
            f"可以围绕「{company_name}」的岗位语境重排内容。" if company_name else "可以围绕目标公司语境重排内容。",
        ],
        "gaps": gaps,
        "anchorQuestions": [f"你是否有过和「{re.search('「(.+?)」', gap['detail']).group(1)}」相关的真实经历？请补充背景、动作和结果。" for gap in gaps],
        "matchScore": score_match(instance, jd),
        "qaNotice": "当前为规则版重构。所有新增关键词都必须由用户确认属实。",
        "aiRewritten": False,
    }


def ai_rewrite(profile, jd, company_name):
    fallback = local_rewrite(profile, jd, company_name)
    try:
        result = deepseek_json(
            [
                {
                    "role": "system",
                    "content": "You are a truthful career positioning assistant. Return only valid JSON. Never fabricate experience.",
                },
                {
                    "role": "user",
                    "content": f"""Create a targeted resume instance for this job.
Return this exact JSON shape:
{{"instanceProfile": {{"name": "string", "headline": "string", "email": "string", "phone": "string", "summary": ["string"], "experience": ["string"], "projects": ["string"], "education": ["string"], "skills": ["string"], "targetNotes": ["string"]}}, "advantages": ["string"], "gaps": [{{"label": "Gap 1", "detail": "string"}}], "anchorQuestions": ["string"], "matchScore": 0, "qaNotice": "string"}}

Rules:
- Use only facts already present in masterProfile.
- Do not invent employers, metrics, dates, tools, or achievements.
- If the JD asks for something not present, put it in gaps and anchorQuestions.
- qaNotice must remind the user to confirm AI-added wording before publishing.

Company:
{company_name or "Unknown"}

JD:
{jd}

masterProfile:
{json.dumps(profile, ensure_ascii=False, indent=2)}""",
                },
            ]
        )
        instance = normalize_profile(result.get("instanceProfile"), profile)
        return {
            "companyName": company_name or None,
            "instanceProfile": instance,
            "advantages": result.get("advantages") or fallback["advantages"],
            "gaps": result.get("gaps") or fallback["gaps"],
            "anchorQuestions": result.get("anchorQuestions") or fallback["anchorQuestions"],
            "matchScore": result.get("matchScore") or score_match(instance, jd),
            "qaNotice": result.get("qaNotice") or "请确认 AI 增加的表述属实后再发布。",
            "aiRewritten": True,
        }
    except Exception:
        return fallback


class OfferGlowHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def read_json_body(self):
        length = int(self.headers.get("content-length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        return json.loads(raw or "{}")

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        try:
            if self.path == "/api/parse-resume":
                body = self.read_json_body()
                text = str(body.get("text") or "").strip()
                if not text:
                    self.send_json({"error": "Missing resume text. Please paste resume text first."}, 400)
                    return
                profile, ai_structured = ai_structure_resume(text)
                self.send_json(
                    {
                        "rawText": text,
                        "profile": profile,
                        "aiStructured": ai_structured,
                        "source": {
                            "fileType": "text",
                            "parser": "deepseek" if ai_structured else "local-rules",
                            "modelUsed": current_deepseek_model() if ai_structured else "local-rules",
                        },
                    }
                )
                return

            if self.path == "/api/publish":
                # Ensure published_pages directory exists
                publish_dir = os.path.join(ROOT, "published_pages")
                os.makedirs(publish_dir, exist_ok=True)
                
                body = self.read_json_body()
                html_content = body.get("html")
                if not html_content:
                    self.send_json({"error": "Missing html content."}, 400)
                    return
                
                # Generate a short unique ID (6 chars)
                page_id = uuid.uuid4().hex[:6]
                file_path = os.path.join(publish_dir, f"{page_id}.html")
                
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(html_content)
                
                self.send_json({"url": f"/p/{page_id}"})
                return

            if self.path == "/api/rewrite-for-jd":
                body = self.read_json_body()
                profile = body.get("masterProfile")
                jd = str(body.get("jobDescription") or "").strip()
                company_name = str(body.get("companyName") or "").strip()
                if not isinstance(profile, dict):
                    self.send_json({"error": "Missing masterProfile."}, 400)
                    return
                if not jd:
                    self.send_json({"error": "Missing jobDescription."}, 400)
                    return
                self.send_json(ai_rewrite(normalize_profile(profile), jd, company_name))
                return

            self.send_json({"error": "Not found."}, 404)
        except urllib.error.HTTPError as error:
            self.send_json({"error": error.read().decode("utf-8") or str(error)}, 502)
        except Exception as error:
            self.send_json({"error": str(error)}, 500)

    def do_GET(self):
        if self.path.startswith("/p/"):
            page_id = self.path.split("/")[-1]
            if not page_id.isalnum():
                self.send_error(400, "Invalid page ID")
                return
            
            publish_dir = os.path.join(ROOT, "published_pages")
            file_path = os.path.join(publish_dir, f"{page_id}.html")
            
            if not os.path.exists(file_path):
                self.send_error(404, "Page not found")
                return
            
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                
            body = content.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
            
        super().do_GET()


def main():
    load_env()
    os.chdir(ROOT)
    port = 3000
    server = ThreadingHTTPServer(("127.0.0.1", port), OfferGlowHandler)
    print(f"OfferGlow local AI server: http://127.0.0.1:{port}/index.html")
    server.serve_forever()


if __name__ == "__main__":
    main()
