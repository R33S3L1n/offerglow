import json
import os
import re
import urllib.request
import urllib.error
from flask import Flask, request, jsonify
from flask_cors import CORS
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local'))
except ImportError:
    pass

app = Flask(__name__)
CORS(app)

# --- Logic Ported from local_ai_server.py ---

SECTION_ALIASES = {
    "summary": ["个人概览", "个人简介", "简介", "概览", "自我评价", "自我介绍", "个人优势", "summary", "profile", "about"],
    "experience": ["工作经历", "工作经验", "职业经历", "实习经历", "实践经历", "experience", "work experience", "work"],
    "projects": ["项目经历", "项目经验", "项目", "代表项目", "校园实践", "志愿活动", "校园实践/志愿活动", "project", "projects"],
    "education": ["教育背景", "教育经历", "教育", "学历", "education", "academic"],
    "skills": ["技能", "能力", "专业技能", "核心技能", "skill", "skills"],
}

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
    "tags": ["Next.js", "TypeScript", "Tailwind", "前端", "增长"],
    "experiences": [],
    "projects": [],
    "educations": [],
}

def clean_line(line):
    return re.sub(r"^(?:[-*•]\s*|\d+[.)、]\s*)", "", line).strip()

def normalize_heading(line):
    return re.sub(r"\s+", " ", line.strip().strip(":：")).lower()

def is_heading(line):
    all_names = [alias for names in SECTION_ALIASES.values() for alias in names]
    heading_re = re.compile(r"^(?:" + "|".join(re.escape(name) for name in sorted(all_names, key=len, reverse=True)) + r")(?:\s*[:：])?$", re.I)
    return bool(heading_re.match(line.strip()))

def pick_section(lines, names):
    normalized = {normalize_heading(name) for name in names}
    start = -1
    for index, line in enumerate(lines):
        if normalize_heading(line) in normalized:
            start = index
            break
    if start == -1: return []
    end = len(lines)
    for index in range(start + 1, len(lines)):
        if is_heading(lines[index]):
            end = index
            break
    return [clean_line(line) for line in lines[start + 1 : end] if clean_line(line)]

def extract_labeled_value(raw_text, labels):
    for label in labels:
        match = re.search(rf"{re.escape(label)}\s*[：:]\s*(.+)", raw_text)
        if match: return match.group(1).strip()
    return ""

def is_contact_line(line):
    lowered = line.lower()
    return bool(re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", line, re.I) or re.search(r"(?:\+?\d{1,3}[-\s]?)?(?:1[3-9]\d{9}|\d{3,4}[-\s]?\d{7,8})", line) or "@" in lowered or any(k in lowered for k in ["电话", "手机", "邮箱", "email", "tel", "wechat", "微信"]))

def detect_name(lines):
    for line in lines[:6]:
        candidate = line.strip()
        if 1 < len(candidate) <= 24 and not is_heading(candidate) and not is_contact_line(candidate) and not re.search(r"\d", candidate) and not re.search(r"(工程师|经理|负责人|设计师|开发|运营|产品|marketing|engineer|manager|designer)", candidate, re.I):
            return candidate
    return DEFAULT_PROFILE["name"]

def detect_headline(lines, name):
    for line in lines[:10]:
        candidate = line.strip()
        if candidate and candidate != name and not is_heading(candidate) and not is_contact_line(candidate) and len(candidate) <= 80 and not re.search(r"(毕业生个人简历|个人简历|基本信息|姓名)", candidate) and re.search(r"(工程师|经理|负责人|设计|开发|运营|产品|增长|marketing|engineer|manager|designer|lead|frontend|product)", candidate, re.I):
            return candidate
    return DEFAULT_PROFILE["headline"]

def compress_section(lines, limit=6):
    items = []
    buffer = []
    for raw in lines:
        line = clean_line(raw)
        if not line: continue
        if re.search(r"(\d{4}[./年\-]\d{1,2}|\b20\d{2}\b)", line) and buffer:
            items.append(" ".join(buffer).strip())
            buffer = [line]
        else:
            buffer.append(line)
    if buffer: items.append(" ".join(buffer).strip())
    return [re.sub(r"\s+", " ", item).strip() for item in items][:limit]

def parse_structured_entries(section_lines, kind="experience", limit=6):
    entries = []
    current = None
    date_re = re.compile(r"(?:19|20)\d{2}(?:[./-]\d{1,2}|年\d{1,2}月?)?(?:\s*[-~—至]+\s*(?:(?:19|20)\d{2}|至今|现在))?", re.I)
    
    for raw in section_lines:
        line = clean_line(raw)
        if not line: continue
        if date_re.search(line) or (not re.match(r"^(?:[-*•]|\d+[.)、])", raw.strip()) and len(line) <= 36 and current and current["body"]):
            if current:
                title = re.sub(date_re, "", current["header"]).strip(" -/|：:")
                entries.append({"date": (date_re.search(current["header"]) or re.search("", "")).group(0) if date_re.search(current["header"]) else "", "title": title or "Experience", "descriptions": current["body"][:6]})
            current = {"header": line, "body": []}
        elif current:
            current["body"].append(line)
        else:
            current = {"header": line, "body": []}
    if current:
        title = re.sub(date_re, "", current["header"]).strip(" -/|：:")
        entries.append({"date": (date_re.search(current["header"]) or re.search("", "")).group(0) if date_re.search(current["header"]) else "", "title": title or "Experience", "descriptions": current["body"][:6]})
    return entries[:limit]

def generate_local_tagline(experiences, summary, headline):
    for exp in experiences[:3]:
        for desc in exp.get("descriptions", [])[:4]:
            if re.search(r"\d+", desc) and 8 <= len(desc) <= 35: return desc
    if summary and len(summary[0]) <= 35: return summary[0]
    return headline[:25] if headline else ""

def normalize_profile(profile, fallback=None):
    fb = fallback or DEFAULT_PROFILE
    res = dict(fb)
    if isinstance(profile, dict):
        for key in ["name", "headline", "tagline", "email", "phone"]:
            if profile.get(key): res[key] = str(profile[key]).strip()
        for key in ["summary", "tags", "experiences", "projects", "educations", "top_metrics"]:
            if profile.get(key) and isinstance(profile[key], list) and len(profile[key]) > 0:
                res[key] = profile[key]
    for project in res.get("projects", []):
        if not isinstance(project.get("metrics"), list): project["metrics"] = []
    for k in ["summary", "tags"]:
        res[k] = [str(i).strip() for i in res.get(k, []) if str(i).strip()]
    return res

def local_parse_resume(raw_text):
    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
    name = extract_labeled_value(raw_text, ["姓名"]) or detect_name(lines)
    headline = extract_labeled_value(raw_text, ["求职意向"]) or detect_headline(lines, name)
    summary = compress_section(pick_section(lines, SECTION_ALIASES["summary"]), 3)
    exp_lines = pick_section(lines, SECTION_ALIASES["experience"])
    experiences = parse_structured_entries(exp_lines, "experience")
    tagline = generate_local_tagline(experiences, summary, headline)
    
    top_metrics = []
    all_txt = raw_text.replace('\n', ' ')
    matches = re.findall(r'(\d+%|\d+\+?|[\d.]+[Mk万])\s*([^\s,，。]{2,6})', all_txt)
    for val, lab in matches[:4]:
        if len(lab) <= 6: top_metrics.append({"value": val, "label": lab})

    return {
        "name": name, "headline": headline, "tagline": tagline,
        "email": re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", raw_text, re.I).group(0) if re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", raw_text, re.I) else "",
        "phone": extract_labeled_value(raw_text, ["联系电话", "手机"]),
        "summary": summary if summary else lines[:2],
        "tags": [l[:6] for l in pick_section(lines, SECTION_ALIASES["skills"])][:5],
        "top_metrics": top_metrics,
        "experiences": experiences, "projects": [], "educations": parse_structured_entries(pick_section(lines, SECTION_ALIASES["education"]), "education")
    }

def deepseek_json(messages):
    api_key = os.environ.get("deepseek", "") or os.environ.get("DEEPSEEK_API_KEY", "")
    api_key = api_key.strip()
    if not api_key: 
        return {"error": "未找到 API Key。请在环境变量中设置 deepseek 或 DEEPSEEK_API_KEY。"}
    base_url = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
    payload = {"model": os.environ.get("DEEPSEEK_MODEL", "deepseek-chat"), "messages": messages, "response_format": {"type": "json_object"}, "temperature": 0.2}
    req = urllib.request.Request(f"{base_url}/chat/completions", data=json.dumps(payload).encode("utf-8"), headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            content = data["choices"][0]["message"]["content"].strip()
            return json.loads(re.sub(r"```json\\s*|```", "", content))
    except Exception as e:
        import traceback
        print(f"DeepSeek Error: {e}")
        print(traceback.format_exc())
        return {"error": str(e)}

# --- Flask Endpoints ---

from flask import send_from_directory
import os

@app.route('/')
def serve_index():
    # Serve index.html from the parent directory
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return send_from_directory(parent_dir, 'index.html')

@app.route('/api/parse-resume', methods=['POST'])
def parse_resume():
    data = request.json
    text = data.get("text", "").strip()
    if not text: return jsonify({"error": "Missing text"}), 400
    
    local_profile = local_parse_resume(text)
    prompt = [
        {
            "role": "system",
            "content": "You are a resume parsing engine. Return only valid JSON. Do not invent facts."
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
- tagline: You MUST return a non-empty string. Write ONE short, highly engaging, and FUN sentence (max 35 Chinese characters) about this person's most distinctive competitive quality. Be creative, confident, and memorable. Use a slightly playful or 'meme-like' tone if appropriate, but keep it professional. Combine concrete achievements with a strong persona. Do NOT use generic boring phrases. Good examples: "不仅能把营销活动办得漂亮，还能让转化率起飞的策划星人", "写得一手好文案，更是个无情的拉新机器", "组织过12场百人活动，发量依然坚挺的00后斜杠青年".

Resume text:
{text}"""
        }
    ]
    ai_res = deepseek_json(prompt)
    if ai_res and "error" in ai_res:
        return jsonify({"profile": local_profile, "aiStructured": False, "debugError": ai_res["error"]})
        
    profile = normalize_profile(ai_res.get("profile") if ai_res else None, local_profile)
    return jsonify({"profile": profile, "aiStructured": bool(ai_res)})

@app.route('/api/publish', methods=['POST'])
def publish():
    return jsonify({"error": "Publish feature is coming soon in the cloud version!"}), 501

@app.route('/api/rewrite-for-jd', methods=['POST'])
def rewrite():
    # Simple pass-through for now as user prioritized parsing
    return jsonify({"qaNotice": "Feature temporarily unavailable in preview"})

if __name__ == '__main__':
    app.run(port=3000)
