#!/usr/bin/env python3
import json
import os
import re
import urllib.error
import urllib.request
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
    "email": "reese@example.com",
    "phone": "138-0000-0000",
    "summary": [
        "5 年前端与增长产品经验，擅长把复杂 B2B 流程转化为清晰的用户路径。",
        "主导过简历解析、智能推荐、数据看板等 AI 工作流模块从 0 到 1 落地。",
    ],
    "experience": [
        "重构简历生成链路，将用户从上传到首版预览的等待体验拆解为可感知步骤。",
        "设计母版与实例的松耦合更新策略，降低用户在多岗位投递时的维护成本。",
        "搭建行为追踪面板，帮助候选人识别 HR 对项目、技能与教育模块的关注度。",
    ],
    "projects": [
        "AI Resume Parser：定义解析 JSON Schema，使前端编辑器能够稳定处理缺失字段。",
        "JD Rewrite Engine：完成 JD 关键词抽取、Gap 分析和 STAR 重写流程。",
    ],
    "education": [],
    "skills": ["Next.js", "TypeScript", "Tailwind CSS", "AI Workflow", "Growth Analytics"],
    "tags": ["Next.js", "TypeScript", "Tailwind", "前端", "增长"],
    "experiences": [],
    "projects_structured": [],
    "educations": [],
    "targetNotes": [
        "围绕 AI 产品化、数据闭环、协作效率重排项目优先级。",
        "将泛化项目描述重写为 STAR 结构，突出业务指标与岗位关键词。",
    ],
}


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
    projects_structured = parse_structured_entries(projects, kind="project", limit=4) if projects else []
    educations = parse_structured_entries(education, kind="education", limit=3) if education else []
    skills = split_list(",".join(skills_raw)) if skills_raw else []
    tags = extract_skill_tags(skills_raw if skills_raw else skills)

    if not experiences:
        generic_lines = [
            line
            for line in body
            if line not in summary and line not in projects and line not in education and not is_contact_line(line) and not is_heading(line)
        ]
        experiences = parse_structured_entries(generic_lines, kind="experience", limit=4)

    if not projects_structured and experiences:
        projects_structured = []

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

    return {
        "name": name,
        "headline": headline,
        "email": email if email else "",
        "phone": phone if phone else "",
        "summary": summary[:4] if summary else body[:2],
        "experience": [f"{entry['title']} {'；'.join(entry['descriptions'])}" for entry in experiences],
        "projects": [f"{entry['title']} {'；'.join(entry['descriptions'])}" for entry in projects_structured],
        "education": [f"{entry['title']} {'；'.join(entry['descriptions'])}" for entry in educations],
        "skills": skills if skills else DEFAULT_PROFILE["skills"],
        "tags": tags,
        "experiences": experiences,
        "projects_structured": projects_structured,
        "educations": educations,
        "targetNotes": DEFAULT_PROFILE["targetNotes"],
    }


def normalize_profile(profile, fallback=None):
    fallback = fallback or DEFAULT_PROFILE
    result = dict(fallback)
    if isinstance(profile, dict):
        result.update(profile)

    for key in ["summary", "experience", "projects", "education", "skills", "targetNotes", "tags"]:
        value = result.get(key)
        result[key] = [str(item).strip() for item in value if str(item).strip()] if isinstance(value, list) else []

    for key in ["experiences", "projects_structured", "educations"]:
        value = result.get(key)
        result[key] = value if isinstance(value, list) else []

    result["name"] = str(result.get("name") or fallback["name"]).strip()
    result["headline"] = str(result.get("headline") or fallback["headline"]).strip()
    result["email"] = str(result.get("email") or "").strip()
    result["phone"] = str(result.get("phone") or "").strip()
    if re.search(r"(毕业生个人简历|个人简历|基本信息|姓名)", result["headline"]):
        result["headline"] = fallback["headline"]
    return result


def deepseek_json(messages):
    api_key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not api_key or "把你的" in api_key:
        return None

    base_url = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
    model = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
    payload = {
        "model": model,
        "messages": messages,
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }
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
{{"profile": {{"name": "string", "headline": "string", "email": "string", "phone": "string", "summary": ["string"], "skills": ["string"], "tags": ["string"], "experiences": [{{"date": "string", "title": "string", "descriptions": ["string"]}}], "projects_structured": [{{"date": "string", "title": "string", "descriptions": ["string"]}}], "educations": [{{"date": "string", "title": "string", "descriptions": ["string"]}}]}}}}

Rules:
- If a field is missing, use an empty array for list fields.
- If email or phone is missing, use an empty string.
- Do not fabricate company names, dates, metrics, or skills.
- Keep bullets concise and readable.
- Preserve all original years and months exactly, including formats like 2023年3月, 2022.06, 2024-09.
- For experiences, title must be only 公司名称/组织名称 - 职位. Do not include date, brackets, or descriptions in title.
- For projects_structured, title must be only 活动/项目名称. Do not include date, brackets, or descriptions in title.
- For educations, title must be only 学校名称 - 专业.
- date must contain only the original time range, such as 2024年7月-2024年9月.
- descriptions must be an array of complete sentences. Split by original logic and punctuation. Never merge all duties into one long string.
- tags must contain only pure skill nouns, such as Excel, 数据统计, PPT制作, 公文写作, 考勤管理.
- Never output meaningless placeholders such as 内容1, 内容2, 内容3, 的, 其他.

Resume text:
{raw_text}""",
                },
            ]
        )
        profile = normalize_profile(result.get("profile"), local_profile)
        for key in ["summary", "experience", "skills", "targetNotes", "email", "phone"]:
            if not profile[key]:
                profile[key] = local_profile[key]
        return profile, True
    except Exception:
        return local_profile, False
