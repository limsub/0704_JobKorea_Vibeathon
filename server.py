#!/usr/bin/env python3
import html
import json
import os
import re
import time
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, "data")
STATE_PATH = os.path.join(DATA_DIR, "state.json")
ROLE_CATALOG_PATH = os.path.join(DATA_DIR, "job_roles.json")
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

DEFAULT_ENABLED_CHANNEL_IDS = ["pm", "ios", "server", "frontend", "data"]

DIRECT_CHANNEL = {
    "id": "direct",
    "name": "direct-parsing",
    "query": "",
    "subtitle": "채용공고 URL을 붙여넣으면 thread로 파싱",
    "bookmarks": ["URL parser", "Raw posting", "Thread"],
    "source": "system",
    "protected": True,
}

DEFAULT_PROFILE = {
    "resume": "",
    "portfolio": "",
    "skills": "PM, 서비스기획, 데이터분석, iOS, Swift, 서버개발, API",
    "preferences": "성장 가능성, 좋은 동료, 명확한 역할, 합리적인 연봉",
}


def default_state():
    return {
        "notes": {},
        "classifications": {},
        "profile": dict(DEFAULT_PROFILE),
        "directParsedJobs": [],
        "enabledChannelIds": list(DEFAULT_ENABLED_CHANNEL_IDS),
        "customChannels": [],
    }


def ensure_state():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(STATE_PATH):
        write_state(default_state())
        return

    with open(STATE_PATH, "r", encoding="utf-8") as f:
        state = json.load(f)

    changed = False
    baseline = default_state()
    for key, value in baseline.items():
        if key not in state:
            state[key] = value
            changed = True
    for key, value in DEFAULT_PROFILE.items():
        if key not in state["profile"]:
            state["profile"][key] = value
            changed = True
    if changed:
        write_state(state)


def read_state():
    ensure_state()
    with open(STATE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def write_state(state):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def read_role_catalog():
    with open(ROLE_CATALOG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def slugify_channel_id(value):
    value = re.sub(r"[^0-9A-Za-z가-힣]+", "-", clean_text(value).lower()).strip("-")
    return value or f"channel-{int(time.time())}"


def normalize_channel(channel, source="catalog"):
    bookmarks = channel.get("bookmarks") or []
    if isinstance(bookmarks, str):
        bookmarks = [item.strip() for item in bookmarks.split(",") if item.strip()]
    query = clean_text(channel.get("query") or channel.get("name") or "개발자")
    name = clean_text(channel.get("name") or query)
    return {
        "id": clean_text(channel.get("id") or slugify_channel_id(name)),
        "name": name,
        "query": query,
        "subtitle": clean_text(channel.get("subtitle") or f"JobKorea {query} 공고 피드"),
        "bookmarks": [clean_text(item) for item in bookmarks[:8]],
        "category": clean_text(channel.get("category") or "사용자 채널"),
        "source": channel.get("source") or source,
        "protected": bool(channel.get("protected", False)),
    }


def all_job_channels(state=None):
    state = state or read_state()
    catalog = [normalize_channel(item, "catalog") for item in read_role_catalog()]
    custom = [normalize_channel(item, "custom") for item in state.get("customChannels", [])]
    return catalog + custom


def enabled_channels(state=None):
    state = state or read_state()
    enabled_ids = set(state.get("enabledChannelIds", DEFAULT_ENABLED_CHANNEL_IDS))
    channels = [channel for channel in all_job_channels(state) if channel["id"] in enabled_ids]
    return channels + [dict(DIRECT_CHANNEL)]


def find_channel(channel_id, state=None):
    if channel_id == DIRECT_CHANNEL["id"]:
        return dict(DIRECT_CHANNEL)
    for channel in all_job_channels(state):
        if channel["id"] == channel_id:
            return channel
    return None


def channel_payload(state=None):
    state = state or read_state()
    return {
        "catalog": all_job_channels(state),
        "channels": enabled_channels(state),
        "enabledChannelIds": state.get("enabledChannelIds", []),
        "customChannels": state.get("customChannels", []),
    }


def fallback_jobs_for(channel):
    query = channel.get("query") or channel.get("name") or "개발자"
    return [{
        "id": f"fallback-{channel.get('id', slugify_channel_id(query))}",
        "title": f"{query} 채용공고",
        "company": "JobKorea Search",
        "url": f"https://www.jobkorea.co.kr/Search/?stext={urllib.parse.quote(query)}",
        "period": "JobKorea 검색 결과",
        "career": "공고 상세 참고",
        "location": "공고 상세 참고",
        "keywords": channel.get("bookmarks", [])[:5] or [query],
        "source": "fallback",
    }]


def create_custom_channel(payload, state):
    name = clean_text(payload.get("name"))
    query = clean_text(payload.get("query") or name)
    if not name or not query:
        raise ValueError("name and query are required")

    existing_ids = {channel["id"] for channel in all_job_channels(state)} | {DIRECT_CHANNEL["id"]}
    base_id = "custom-" + slugify_channel_id(query)
    channel_id = base_id
    suffix = 2
    while channel_id in existing_ids:
        channel_id = f"{base_id}-{suffix}"
        suffix += 1

    raw_keywords = payload.get("bookmarks") or query
    if isinstance(raw_keywords, str):
        bookmarks = [item.strip() for item in re.split(r"[,/ ]+", raw_keywords) if item.strip()]
    else:
        bookmarks = raw_keywords

    channel = normalize_channel({
        "id": channel_id,
        "name": name,
        "query": query,
        "subtitle": f"JobKorea {query} 공고 피드",
        "bookmarks": bookmarks[:6],
        "category": "사용자 추가",
        "source": "custom",
    }, "custom")
    state.setdefault("customChannels", []).append(channel)
    state.setdefault("enabledChannelIds", []).append(channel_id)
    return channel


def set_channel_enabled(payload, state):
    channel_id = clean_text(payload.get("channelId"))
    enabled = bool(payload.get("enabled"))
    if not find_channel(channel_id, state):
        raise ValueError("channel not found")
    enabled_ids = set(state.get("enabledChannelIds", []))
    if enabled:
        enabled_ids.add(channel_id)
    else:
        enabled_ids.discard(channel_id)
    state["enabledChannelIds"] = [channel["id"] for channel in all_job_channels(state) if channel["id"] in enabled_ids]


def delete_custom_channel(payload, state):
    channel_id = clean_text(payload.get("channelId"))
    before = len(state.get("customChannels", []))
    state["customChannels"] = [channel for channel in state.get("customChannels", []) if channel.get("id") != channel_id]
    if len(state["customChannels"]) == before:
        raise ValueError("only custom channels can be deleted")
    state["enabledChannelIds"] = [item for item in state.get("enabledChannelIds", []) if item != channel_id]


def fetch_text(url, timeout=12):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8"})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        raw = res.read()
    return raw.decode("utf-8", "ignore")


def clean_text(value):
    value = html.unescape(str(value or ""))
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\\u0026", "&", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def extract_json_array_at(text, start):
    start = text.find("[", start)
    depth = 0
    in_string = False
    escaped = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                candidate = text[start:i + 1]
                try:
                    return json.loads(candidate)
                except Exception:
                    return []
    return []


def extract_job_content(text):
    normalized = text.replace('\\"', '"').replace("\\u0026", "&")
    arrays = []
    pos = 0
    marker = '"content":['
    while True:
      idx = normalized.find(marker, pos)
      if idx < 0:
          break
      arr = extract_json_array_at(normalized, idx)
      if arr:
          arrays.append(arr)
      pos = idx + len(marker)
    for arr in arrays:
        if any(isinstance(item, dict) and item.get("legacyJobNo") and item.get("title") for item in arr[:5]):
            return arr
    for arr in arrays:
        if any(isinstance(item, dict) and item.get("title") and item.get("companyName") for item in arr[:5]):
            return arr
    return []


def normalize_job(item, query):
    job_id = str(item.get("id") or item.get("legacyJobNo") or f"{query}-{time.time()}")
    url = f"https://www.jobkorea.co.kr/Recruit/GI_Read/{job_id}" if job_id else f"https://www.jobkorea.co.kr/Search/?stext={urllib.parse.quote(query)}"
    period = item.get("applicationPeriod") or {}
    start = str(period.get("start", ""))[:10]
    end = str(period.get("end", ""))[:10]
    keywords = item.get("_internal_keywordList") or item.get("benefitNameList") or []
    if isinstance(keywords, str):
        keywords = [keywords]
    return {
        "id": job_id,
        "title": clean_text(item.get("title")),
        "company": clean_text(item.get("postingCompanyName") or item.get("companyName")),
        "url": url,
        "period": f"{start} ~ {end}" if start or end else "공고 상세 참고",
        "career": career_label(item.get("careerType"), item.get("careerRange")),
        "location": location_label(item.get("areaCodeList")),
        "keywords": [clean_text(k) for k in keywords[:10]],
        "readCount": item.get("readCount", 0),
        "source": "JobKorea",
    }


def career_label(career_type, career_range):
    if str(career_type) == "1":
        return "신입"
    if str(career_type) == "2":
        return f"경력 {career_range}년+" if career_range else "경력"
    return "신입/경력"


def location_label(area_codes):
    if not area_codes:
        return "지역 정보 참고"
    joined = ",".join(area_codes)
    if "I000" in joined or "Q000" in joined:
        return "전국/수도권"
    if "B" in joined:
        return "서울"
    return "공고 상세 참고"


def search_jobkorea(query, limit=8):
    url = f"https://www.jobkorea.co.kr/Search/?stext={urllib.parse.quote(query)}"
    text = fetch_text(url)
    content = extract_job_content(text)
    jobs = [normalize_job(item, query) for item in content if isinstance(item, dict) and item.get("title")]
    return jobs[:limit]


def parse_posting_url(url):
    text = fetch_text(url)
    visible = re.sub(r"<script[^>]*>.*?</script>", " ", text, flags=re.S | re.I)
    visible = re.sub(r"<style[^>]*>.*?</style>", " ", visible, flags=re.S | re.I)
    visible = clean_text(visible)
    title = ""
    title_match = re.search(r"<title[^>]*>(.*?)</title>", text, re.S | re.I)
    if title_match:
        title = clean_text(title_match.group(1))
    if not title:
        og_match = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)', text, re.I)
        title = clean_text(og_match.group(1)) if og_match else "Parsed posting"
    company = "JobKorea" if "jobkorea.co.kr" in url else urllib.parse.urlparse(url).netloc
    bullets = split_summary(visible)
    return {
        "id": f"parsed-{abs(hash(url))}",
        "title": title,
        "company": company,
        "url": url,
        "period": infer_period(visible),
        "career": infer_career(visible),
        "location": infer_location(visible),
        "keywords": infer_keywords(visible),
        "source": "Parsed URL",
        "details": bullets,
    }


def split_summary(text):
    sentences = re.split(r"(?<=[.!?。])\s+|(?:\s{2,})", text)
    chunks = [s.strip() for s in sentences if 20 <= len(s.strip()) <= 220]
    if not chunks:
        chunks = [text[:220]]
    return chunks[:8]


def infer_period(text):
    m = re.search(r"(20\d{2}[./-]\d{1,2}[./-]\d{1,2}).{0,20}(20\d{2}[./-]\d{1,2}[./-]\d{1,2})", text)
    return f"{m.group(1)} ~ {m.group(2)}" if m else "공고 상세 참고"


def infer_career(text):
    if "신입" in text and "경력" in text:
        return "신입/경력"
    if "경력" in text:
        return "경력"
    if "신입" in text:
        return "신입"
    return "공고 상세 참고"


def infer_location(text):
    for loc in ["서울", "경기", "성남", "판교", "부산", "대전", "대구", "인천", "수도권", "재택"]:
        if loc in text:
            return loc
    return "공고 상세 참고"


def infer_keywords(text):
    candidates = ["PM", "PO", "iOS", "Swift", "서버", "백엔드", "Java", "Spring", "Node", "Python", "React", "SQL", "AI", "데이터", "서비스기획"]
    return [k for k in candidates if k.lower() in text.lower()][:8]


def local_match(job):
    state = read_state()
    profile = state.get("profile", {})
    profile_text = " ".join(str(v) for v in profile.values()).lower()
    job_terms = [job.get("title", ""), job.get("company", ""), " ".join(job.get("keywords", []))]
    job_text = " ".join(job_terms).lower()
    hits = []
    for token in re.split(r"[,/\s]+", profile_text):
        token = token.strip().lower()
        if len(token) >= 2 and token in job_text and token not in hits:
            hits.append(token)
    score = min(96, 52 + len(hits) * 8)
    risks = []
    if "경력" in job.get("career", "") and "경력" not in profile_text:
        risks.append("경력 연차/직무 적합성 확인 필요")
    if not hits:
        risks.append("이력서/포트폴리오 키워드가 아직 부족함")
    return {
        "score": score,
        "summary": f"{job.get('company')} 공고는 {', '.join(hits[:4]) or '프로필 보강'} 키워드 기준으로 매칭했습니다.",
        "strengths": hits[:5] or ["프로필 DM에 이력서/포트폴리오를 넣으면 더 정확해집니다."],
        "risks": risks or ["큰 리스크는 감지되지 않았습니다."],
        "nextActions": ["공고 DM에 자소서 초안을 남기기", "스레드에서 원문 확인", "관심/지원 후보 이모지로 분류"],
        "aiMode": "local heuristic",
    }


def local_search_intent(message):
    text = clean_text(message)
    normalized = (
        text.replace("채용 공고", " ")
        .replace("채용공고", " ")
        .replace("보여줘", " ")
        .replace("찾아줘", " ")
        .replace("검색해줘", " ")
        .replace("리스트", " ")
        .replace("출력", " ")
        .replace("에서", " ")
    )
    tokens = [token for token in re.split(r"[\s,./]+", normalized) if token]
    known_roles = ["PM", "PO", "iOS", "Swift", "서버", "백엔드", "프론트엔드", "Android", "데이터", "AI", "기획", "디자인", "마케팅", "DevOps"]
    role_terms = [role for role in known_roles if role.lower() in text.lower()]
    company_terms = []
    for token in tokens:
        if token in role_terms:
            continue
        if len(token) >= 2 and token not in ["개발", "직군", "공고", "신입", "경력"]:
            company_terms.append(token)
    query_parts = []
    if company_terms:
        query_parts.append(company_terms[0])
    query_parts.extend(role_terms[:3])
    if not query_parts:
        query_parts = tokens[:4] or ["개발자"]
    return {
        "query": " ".join(query_parts),
        "company": company_terms[0] if company_terms else "",
        "role": " ".join(role_terms),
        "location": "",
        "seniority": "경력" if "경력" in text else "신입" if "신입" in text else "",
        "keywords": query_parts,
        "reason": "로컬 파서가 회사명/직무 키워드를 추출했습니다.",
    }


def local_recruiter_search(message):
    intent = local_search_intent(message)
    query = intent.get("query") or "개발자"
    crawl_url = f"https://www.jobkorea.co.kr/Search/?stext={urllib.parse.quote(query)}"
    jobs = search_jobkorea(query, limit=8)
    top_detail = None
    if jobs:
        try:
            parsed = parse_posting_url(jobs[0]["url"])
            top_detail = {
                "title": parsed.get("title"),
                "period": parsed.get("period"),
                "keywords": parsed.get("keywords", []),
                "details": parsed.get("details", [])[:3],
            }
        except Exception as exc:
            top_detail = {"error": str(exc)}
    return {
        "message": message,
        "intent": intent,
        "jobs": jobs,
        "topDetail": top_detail,
        "aiTrace": {
            "mode": "local-keyword-parser",
            "crawlUrl": crawl_url,
            "resultCount": len(jobs),
            "steps": [
                "자연어 입력 수신",
                "로컬 키워드 파서로 회사명/직군 추출",
                "JobKorea 검색 URL 생성",
                "검색 결과 HTML 크롤링",
                "Next.js hydration JSON에서 공고 배열 추출",
                "상위 공고 상세 페이지 1건 추가 파싱",
            ],
        },
        "answer": f"'{message}'를 '{query}' 검색으로 해석했고 JobKorea에서 {len(jobs)}개 공고를 가져왔습니다.",
    }


def build_docs_payload():
    state = read_state()
    return {
        "project": {
            "name": "JobKorea Vibe Slack Dashboard",
            "version": "local prototype",
            "servedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
            "entry": "/",
            "dashboard": "/dashboard.html",
        },
        "runtime": {
            "host": os.environ.get("HOST", "127.0.0.1"),
            "port": int(os.environ.get("PORT", "5174")),
            "dataPath": STATE_PATH,
            "roleCatalogPath": ROLE_CATALOG_PATH,
            "externalShare": "ngrok http 5174",
            "aiProvider": "not used; local keyword parsing only",
        },
        "features": [
            {"name": "JobKorea 공고 수집", "status": "implemented", "detail": "JobKorea Search HTML 내 Next.js hydration JSON에서 채용공고 content 배열 추출"},
            {"name": "동적 채널 관리", "status": "implemented", "detail": "로컬 직군 카탈로그 기반으로 채널 표시/숨김, 사용자 채널 추가/삭제"},
            {"name": "이모지 공고 분류", "status": "implemented", "detail": "👀 관심 있음, ⭐ 지원 후보, ❌ 패스, 💰 연봉 좋음"},
            {"name": "웹 공고 URL 파싱", "status": "implemented", "detail": "URL fetch 후 title, 기간, 경력, 지역, 키워드, 상세 문단 추론"},
            {"name": "공고별 DM 노트", "status": "implemented", "detail": "공고 DM/스레드 reply로 자소서 초안 및 메모 저장"},
            {"name": "이력서/포트폴리오 저장", "status": "implemented", "detail": "Resume & Portfolio DM에서 local profile 저장"},
            {"name": "로컬 매칭 패널", "status": "implemented", "detail": "GPT API Key와 로컬 Codex 없이 프로필/공고 키워드 기반 매칭"},
            {"name": "톤 조절", "status": "implemented", "detail": "raw, business, friendly 3단계 슬라이더"},
            {"name": "자연어 검색 DM", "status": "implemented", "detail": "문장에서 핵심 키워드 추출 후 JobKorea 검색"},
            {"name": "검색 봇 DM", "status": "implemented", "detail": "로컬 intent 파서 + JobKorea 크롤링 trace 표시"},
            {"name": "ngrok 외부 공유", "status": "implemented", "detail": "scripts/start_ngrok.sh로 public URL 생성"},
        ],
        "apis": [
            {"method": "GET", "path": "/api/channels", "description": "직군 카탈로그, 활성 채널, 사용자 채널 조회"},
            {"method": "GET", "path": "/api/jobs?channel=pm", "description": "채널별 JobKorea 공고 검색"},
            {"method": "GET", "path": "/api/search?q=NC", "description": "자연어/키워드 기반 JobKorea 검색"},
            {"method": "GET", "path": "/api/parse?url=...", "description": "채용공고 URL 직접 파싱 후 directParsedJobs에 저장"},
            {"method": "GET", "path": "/api/state", "description": "로컬 저장 상태 조회"},
            {"method": "GET", "path": "/api/docs", "description": "문서 대시보드용 메타데이터"},
            {"method": "POST", "path": "/api/classify", "description": "공고 이모지 분류 저장"},
            {"method": "POST", "path": "/api/note", "description": "공고별 개인 노트 저장"},
            {"method": "POST", "path": "/api/profile", "description": "이력서/포트폴리오/스킬/선호 저장"},
            {"method": "POST", "path": "/api/match", "description": "공고와 프로필 매칭 결과 생성"},
            {"method": "POST", "path": "/api/channels", "description": "채널 활성화/비활성화, 사용자 채널 추가/삭제"},
            {"method": "POST", "path": "/api/ai-search", "description": "자연어 입력을 로컬 검색 의도로 해석하고 JobKorea 크롤링"},
        ],
        "state": {
            "notesCount": sum(len(items) for items in state.get("notes", {}).values()),
            "classifiedJobs": len(state.get("classifications", {})),
            "directParsedJobs": len(state.get("directParsedJobs", [])),
            "enabledChannels": len(state.get("enabledChannelIds", [])),
            "profileFields": [key for key, value in state.get("profile", {}).items() if value],
        },
        "risks": [
            "JobKorea HTML 구조가 바뀌면 hydration JSON 파서 수정 필요",
            "ngrok 사용 시 터널 URL을 받은 사람은 서버에 접근할 수 있으므로 공유 범위 관리 필요",
            "크롤링은 대상 사이트 정책과 요청 빈도 제한을 고려해야 함",
        ],
    }


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            return super().do_GET()
        params = urllib.parse.parse_qs(parsed.query)
        try:
            if parsed.path == "/api/channels":
                return self.json(channel_payload())
            if parsed.path == "/api/jobs":
                channel = params.get("channel", ["pm"])[0]
                channel_info = find_channel(channel) or normalize_channel({"id": channel, "name": channel, "query": channel})
                query = channel_info.get("query") or channel
                try:
                    jobs = search_jobkorea(query)
                except Exception:
                    jobs = fallback_jobs_for(channel_info)
                return self.json({"jobs": jobs, "query": query, "channel": channel_info})
            if parsed.path == "/api/search":
                query = params.get("q", [""])[0].strip()
                jobs = search_jobkorea(query or "개발자") if query else []
                return self.json({"jobs": jobs, "query": query})
            if parsed.path == "/api/parse":
                url = params.get("url", [""])[0]
                if not url:
                    return self.json({"error": "url is required"}, 400)
                job = parse_posting_url(url)
                state = read_state()
                if not any(item.get("url") == url for item in state["directParsedJobs"]):
                    state["directParsedJobs"].insert(0, job)
                    state["directParsedJobs"] = state["directParsedJobs"][:30]
                    write_state(state)
                return self.json({"job": job})
            if parsed.path == "/api/state":
                return self.json(read_state())
            if parsed.path == "/api/docs":
                return self.json(build_docs_payload())
            return self.json({"error": "not found"}, 404)
        except Exception as exc:
            return self.json({"error": str(exc)}, 500)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            return super().do_POST()
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length).decode("utf-8")
            payload = json.loads(body or "{}")
            state = read_state()
            if parsed.path == "/api/classify":
                state["classifications"][payload["jobId"]] = payload.get("classification", [])
                write_state(state)
                return self.json({"ok": True})
            if parsed.path == "/api/note":
                job_id = payload["jobId"]
                state["notes"].setdefault(job_id, []).append({
                    "text": payload.get("text", ""),
                    "createdAt": time.strftime("%Y-%m-%d %H:%M:%S"),
                })
                write_state(state)
                return self.json({"ok": True, "notes": state["notes"][job_id]})
            if parsed.path == "/api/profile":
                state["profile"].update(payload.get("profile", {}))
                write_state(state)
                return self.json({"ok": True, "profile": state["profile"]})
            if parsed.path == "/api/match":
                job = payload.get("job", {})
                result = local_match(job)
                return self.json({"match": result})
            if parsed.path == "/api/channels":
                action = payload.get("action")
                if action == "create":
                    create_custom_channel(payload, state)
                elif action == "setEnabled":
                    set_channel_enabled(payload, state)
                elif action == "delete":
                    delete_custom_channel(payload, state)
                else:
                    return self.json({"error": "unknown channel action"}, 400)
                write_state(state)
                return self.json({"ok": True, **channel_payload(state)})
            if parsed.path == "/api/ai-search":
                message = payload.get("message", "").strip()
                if not message:
                    return self.json({"error": "message is required"}, 400)
                return self.json(local_recruiter_search(message))
            return self.json({"error": "not found"}, 404)
        except Exception as exc:
            return self.json({"error": str(exc)}, 500)

    def json(self, payload, status=200):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    ensure_state()
    os.chdir(ROOT)
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "5174"))
    print(f"Serving JobKorea Vibe on http://{host}:{port}", flush=True)
    print(f"Share with ngrok: ngrok http {port}", flush=True)
    ThreadingHTTPServer((host, port), Handler).serve_forever()
