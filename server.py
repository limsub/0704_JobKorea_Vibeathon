#!/usr/bin/env python3
import concurrent.futures
import datetime
import hashlib
import html
import io
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(ROOT, "public")
DATA_DIR = os.path.join(ROOT, "data")
STATE_DIR = os.environ.get(
    "STATE_DIR",
    os.path.join(tempfile.gettempdir(), "jobkorea-vibe-state") if os.environ.get("VERCEL") else DATA_DIR,
)
STATE_PATH = os.environ.get("STATE_PATH", os.path.join(STATE_DIR, "state.json"))
ROLE_CATALOG_PATH = os.path.join(DATA_DIR, "job_roles.json")
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
MAX_UPLOAD_BYTES = 40 * 1024 * 1024
MAX_OPENAI_TEXT_CHARS = 10485760
OCR_MAX_PAGES = 20
OCR_DPI = 160
OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
DEFAULT_OPENAI_TIMEOUT = 60
DEFAULT_OPENAI_JOB_MESSAGE_TIMEOUT = 8

DEFAULT_ENABLED_CHANNEL_IDS = ["pm"]

DIRECT_CHANNEL = {
    "id": "direct",
    "name": "URL 가져오기",
    "query": "",
    "subtitle": "채용공고 URL을 붙여넣으면 메시지로 정리합니다.",
    "bookmarks": [],
    "source": "system",
    "protected": True,
}

DEFAULT_PROFILE = {
    "resume": "",
    "portfolio": "",
    "skills": "PM, 서비스기획, 데이터분석, iOS, Swift, 서버개발, API",
    "preferences": "성장 가능성, 좋은 동료, 명확한 역할, 합리적인 연봉",
}

DEFAULT_PROFILE_ANALYSIS = {
    "status": "not_started",
    "attempts": 0,
    "locked": False,
    "lastError": "",
    "sourceDocument": None,
    "extractedText": "",
    "convertedJsonText": "",
    "result": None,
    "model": "",
    "attemptedAt": "",
    "completedAt": "",
}

PROFILE_ANALYSIS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["candidate_profile", "matching_profile", "ai_analysis_result"],
    "properties": {
        "candidate_profile": {
            "type": "object",
            "additionalProperties": False,
            "required": [
                "personal_info",
                "headline",
                "summary",
                "career",
                "skills",
                "work_experiences",
                "projects",
                "education",
                "certifications",
                "awards",
            ],
            "properties": {
                "personal_info": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["name", "email", "phone", "location", "links"],
                    "properties": {
                        "name": {"type": "string"},
                        "email": {"type": "string"},
                        "phone": {"type": "string"},
                        "location": {"type": "string"},
                        "links": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["portfolio", "github", "linkedin", "blog", "other"],
                            "properties": {
                                "portfolio": {"type": "string"},
                                "github": {"type": "string"},
                                "linkedin": {"type": "string"},
                                "blog": {"type": "string"},
                                "other": {"type": "array", "items": {"type": "string"}},
                            },
                        },
                    },
                },
                "headline": {"type": "string"},
                "summary": {"type": "string"},
                "career": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "total_years_of_experience",
                        "seniority_level",
                        "current_or_recent_role",
                        "desired_roles",
                        "preferred_industries",
                    ],
                    "properties": {
                        "total_years_of_experience": {"type": "number"},
                        "seniority_level": {"type": "string"},
                        "current_or_recent_role": {"type": "string"},
                        "desired_roles": {"type": "array", "items": {"type": "string"}},
                        "preferred_industries": {"type": "array", "items": {"type": "string"}},
                    },
                },
                "skills": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["technical_skills", "tools", "soft_skills", "languages"],
                    "properties": {
                        "technical_skills": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "required": ["name", "category", "level", "evidence"],
                                "properties": {
                                    "name": {"type": "string"},
                                    "category": {"type": "string"},
                                    "level": {"type": "string"},
                                    "evidence": {"type": "string"},
                                },
                            },
                        },
                        "tools": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "required": ["name", "category", "level", "evidence"],
                                "properties": {
                                    "name": {"type": "string"},
                                    "category": {"type": "string"},
                                    "level": {"type": "string"},
                                    "evidence": {"type": "string"},
                                },
                            },
                        },
                        "soft_skills": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "required": ["name", "evidence"],
                                "properties": {
                                    "name": {"type": "string"},
                                    "evidence": {"type": "string"},
                                },
                            },
                        },
                        "languages": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "required": ["name", "proficiency"],
                                "properties": {
                                    "name": {"type": "string"},
                                    "proficiency": {"type": "string"},
                                },
                            },
                        },
                    },
                },
                "work_experiences": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": [
                            "company",
                            "position",
                            "department",
                            "employment_type",
                            "start_date",
                            "end_date",
                            "is_current",
                            "responsibilities",
                            "achievements",
                            "tech_stack",
                            "evidence",
                        ],
                        "properties": {
                            "company": {"type": "string"},
                            "position": {"type": "string"},
                            "department": {"type": "string"},
                            "employment_type": {"type": "string"},
                            "start_date": {"type": "string"},
                            "end_date": {"type": "string"},
                            "is_current": {"type": "boolean"},
                            "responsibilities": {"type": "array", "items": {"type": "string"}},
                            "achievements": {"type": "array", "items": {"type": "string"}},
                            "tech_stack": {"type": "array", "items": {"type": "string"}},
                            "evidence": {"type": "string"},
                        },
                    },
                },
                "projects": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": [
                            "name",
                            "role",
                            "start_date",
                            "end_date",
                            "description",
                            "problem",
                            "solution",
                            "impact",
                            "contribution",
                            "tech_stack",
                            "links",
                            "evidence",
                        ],
                        "properties": {
                            "name": {"type": "string"},
                            "role": {"type": "string"},
                            "start_date": {"type": "string"},
                            "end_date": {"type": "string"},
                            "description": {"type": "string"},
                            "problem": {"type": "string"},
                            "solution": {"type": "string"},
                            "impact": {"type": "string"},
                            "contribution": {"type": "string"},
                            "tech_stack": {"type": "array", "items": {"type": "string"}},
                            "links": {"type": "array", "items": {"type": "string"}},
                            "evidence": {"type": "string"},
                        },
                    },
                },
                "education": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["school", "major", "degree", "start_date", "end_date", "status"],
                        "properties": {
                            "school": {"type": "string"},
                            "major": {"type": "string"},
                            "degree": {"type": "string"},
                            "start_date": {"type": "string"},
                            "end_date": {"type": "string"},
                            "status": {"type": "string"},
                        },
                    },
                },
                "certifications": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["name", "issuer", "issued_date"],
                        "properties": {
                            "name": {"type": "string"},
                            "issuer": {"type": "string"},
                            "issued_date": {"type": "string"},
                        },
                    },
                },
                "awards": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["name", "issuer", "date", "description"],
                        "properties": {
                            "name": {"type": "string"},
                            "issuer": {"type": "string"},
                            "date": {"type": "string"},
                            "description": {"type": "string"},
                        },
                    },
                },
            },
        },
        "matching_profile": {
            "type": "object",
            "additionalProperties": False,
            "required": [
                "primary_job_categories",
                "recommended_job_titles",
                "core_keywords",
                "strong_match_signals",
                "weak_match_signals",
                "preferred_work_style",
            ],
            "properties": {
                "primary_job_categories": {"type": "array", "items": {"type": "string"}},
                "recommended_job_titles": {"type": "array", "items": {"type": "string"}},
                "core_keywords": {"type": "array", "items": {"type": "string"}},
                "strong_match_signals": {"type": "array", "items": {"type": "string"}},
                "weak_match_signals": {"type": "array", "items": {"type": "string"}},
                "preferred_work_style": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["remote", "employment_type", "location"],
                    "properties": {
                        "remote": {"type": "string"},
                        "employment_type": {"type": "array", "items": {"type": "string"}},
                        "location": {"type": "array", "items": {"type": "string"}},
                    },
                },
            },
        },
        "ai_analysis_result": {
            "type": "object",
            "additionalProperties": False,
            "required": [
                "overall_summary",
                "candidate_type",
                "career_level_assessment",
                "strengths",
                "risks_or_gaps",
                "recommended_roles",
                "improvement_suggestions",
                "chat_display_message",
                "confidence",
            ],
            "properties": {
                "overall_summary": {"type": "string"},
                "candidate_type": {"type": "string"},
                "career_level_assessment": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["level", "reason"],
                    "properties": {
                        "level": {"type": "string"},
                        "reason": {"type": "string"},
                    },
                },
                "strengths": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["title", "description", "evidence"],
                        "properties": {
                            "title": {"type": "string"},
                            "description": {"type": "string"},
                            "evidence": {"type": "string"},
                        },
                    },
                },
                "risks_or_gaps": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["title", "description", "severity"],
                        "properties": {
                            "title": {"type": "string"},
                            "description": {"type": "string"},
                            "severity": {"type": "string"},
                        },
                    },
                },
                "recommended_roles": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["role", "reason", "confidence"],
                        "properties": {
                            "role": {"type": "string"},
                            "reason": {"type": "string"},
                            "confidence": {"type": "number"},
                        },
                    },
                },
                "improvement_suggestions": {"type": "array", "items": {"type": "string"}},
                "chat_display_message": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["title", "summary", "bullets"],
                    "properties": {
                        "title": {"type": "string"},
                        "summary": {"type": "string"},
                        "bullets": {"type": "array", "items": {"type": "string"}},
                    },
                },
                "confidence": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["overall", "missing_information"],
                    "properties": {
                        "overall": {"type": "number"},
                        "missing_information": {"type": "array", "items": {"type": "string"}},
                    },
                },
            },
        },
    },
}

PROFILE_ANALYSIS_PROMPT = """
너는 채용 매칭 서비스의 이력서/포트폴리오 분석 엔진이다.
입력은 PDF에서 추출한 텍스트이며, 출력은 반드시 지정된 JSON schema와 일치해야 한다.

원칙:
- 텍스트에 근거가 있는 사실만 구조화한다.
- 불명확하거나 없는 정보는 빈 문자열, 빈 배열, 0, unknown 중 가장 자연스러운 값으로 둔다.
- evidence에는 원문에서 어떤 부분을 근거로 삼았는지 짧게 한국어로 적는다.
- 매칭에 유용한 직무명, 기술 키워드, 강점/약점 신호를 적극적으로 정리한다.
- ai_analysis_result는 채팅창에 바로 보여줄 수 있는 한국어 분석 결과로 작성한다.
- 개인정보는 원문에 있는 경우에만 추출한다.
""".strip()

SLACK_JOB_MESSAGE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["jobs"],
    "properties": {
        "jobs": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "id",
                    "message_title",
                    "message_body",
                    "thread_comment",
                    "thread_summary",
                    "key_points",
                ],
                "properties": {
                    "id": {"type": "string"},
                    "message_title": {"type": "string"},
                    "message_body": {"type": "string"},
                    "thread_comment": {"type": "string"},
                    "thread_summary": {"type": "string"},
                    "key_points": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
    },
}

SLACK_JOB_MESSAGE_PROMPT = """
너는 채용공고를 Slack 채널에 공유하는 한국어 커리어 큐레이터다.
입력은 JobKorea에서 크롤링/파싱한 공고 JSON 배열이며, 출력은 반드시 지정된 JSON schema와 일치해야 한다.

작성 원칙:
- 사실을 바꾸거나 추측으로 단정하지 않는다. 모르는 정보는 "확인 필요"라고 쓴다.
- message_body는 Slack 본문에 바로 붙일 수 있게 3~5문단의 자연스러운 한국어로 쓴다.
- thread_comment는 스레드 첫 코멘트로, 짧은 해석 문단 + 핵심 항목 bullet + 확인 필요 사항 + 한 줄 결론 순서로 쓴다.
- 사용자가 준 예시처럼 너무 딱딱한 공고 요약이 아니라 동료에게 레퍼런스를 공유하는 톤으로 쓴다.
- 공고마다 문장 시작, 길이, 이모지, 말투를 다르게 쓴다. 같은 템플릿을 반복하지 않는다.
- 톤은 팀 리드의 업무 공유, 후배의 가벼운 제보, 대표의 전체 공지, 실무자의 짧은 체크, 길게 해석한 메모처럼 후보군이 충분히 달라야 한다.
- "채용공고 안내"처럼 공고문 말투를 피하고, 실제 Slack에서 동료에게 공유하는 메모처럼 쓴다.
- 이모지는 :eyes:, :memo:, :bulb:, :mag:, :sparkles: 중 상황에 맞게 0~2개만 쓴다.
- key_points는 역할 성격, 주요 키워드, 산업군, 경험 기준, 확인 기한, 급여/위치 중 중요한 것만 4~7개로 쓴다.
- 각 결과의 id는 입력 job id와 정확히 같아야 한다.
""".strip()

MATCH_ANALYSIS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "score",
        "summary",
        "strengths",
        "risks",
        "nextActions",
        "comment_text",
        "recommendation_direction",
    ],
    "properties": {
        "score": {"type": "number"},
        "summary": {"type": "string"},
        "strengths": {"type": "array", "items": {"type": "string"}},
        "risks": {"type": "array", "items": {"type": "string"}},
        "nextActions": {"type": "array", "items": {"type": "string"}},
        "comment_text": {"type": "string"},
        "recommendation_direction": {"type": "string"},
    },
}

MATCH_ANALYSIS_PROMPT = """
너는 이력서/포트폴리오 분석 결과와 채용공고를 비교하는 한국어 커리어 매칭 코치다.
입력은 사용자 프로필 JSON, PDF 분석 JSON, 공고 JSON, 로컬 키워드 매칭 초안이다.
출력은 반드시 지정된 JSON schema와 일치해야 한다.

작성 원칙:
- score는 0~100 사이 숫자다. 근거가 약하면 과감히 낮춘다.
- comment_text는 Slack 스레드의 두 번째 코멘트처럼 쓴다.
- comment_text 첫 줄은 가능하면 "@이름 님, 이 건은 76점 정도예요." 형식으로 쓴다.
- 장점 1~2개, 부족한 점 1~2개, 추천 방향 1개, "보완하면 좋은 것" 번호 목록을 포함한다.
- 포트폴리오/이력서에 없는 경험을 만들어내지 않는다.
- 공고 정보가 애매하면 "원문 확인 필요"라고 쓴다.
- 말투는 사용자가 준 예시처럼 부드럽고 실무적인 한국어로 쓴다.
""".strip()

JOB_MESSAGE_CACHE = {}


def default_state():
    return {
        "notes": {},
        "classifications": {},
        "profile": dict(DEFAULT_PROFILE),
        "profileAnalysis": dict(DEFAULT_PROFILE_ANALYSIS),
        "directParsedJobs": [],
        "enabledChannelIds": list(DEFAULT_ENABLED_CHANNEL_IDS),
        "customChannels": [],
    }


def ensure_state():
    os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
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
    if "profileAnalysis" not in state or not isinstance(state["profileAnalysis"], dict):
        state["profileAnalysis"] = dict(DEFAULT_PROFILE_ANALYSIS)
        changed = True
    else:
        for key, value in DEFAULT_PROFILE_ANALYSIS.items():
            if key not in state["profileAnalysis"]:
                state["profileAnalysis"][key] = value
                changed = True
        analysis = state["profileAnalysis"]
        if analysis.get("status") == "failed" and analysis.get("extractedText") and not analysis.get("result"):
            analysis["status"] = "text_extracted"
            analysis["locked"] = False
            analysis["convertedJsonText"] = ""
            changed = True
    if changed:
        write_state(state)


def read_state():
    ensure_state()
    with open(STATE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def write_state(state):
    os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
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
    return [channel for channel in all_job_channels(state) if channel["id"] in enabled_ids]


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
    source_url = f"https://www.jobkorea.co.kr/Search/?stext={urllib.parse.quote(query)}"
    jobs = [build_job_payload(
        source="fallback",
        source_url=source_url,
        raw={
            "title": f"{query} 채용공고",
            "company_name": "JobKorea Search",
            "career": "공고 상세 참고",
            "location": "공고 상세 참고",
            "salary": "공고 상세 참고",
            "period": "JobKorea 검색 결과",
            "raw_text": "JobKorea 검색 결과를 불러오지 못해 생성한 fallback 데이터입니다.",
        },
        job_profile={
            "company_name": "JobKorea Search",
            "job_title": f"{query} 채용공고",
            "required_skills": channel.get("bookmarks", [])[:5] or [query],
        },
        job_id=f"fallback-{channel.get('id', slugify_channel_id(query))}",
    )]
    return hydrate_slack_messages(jobs)


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


def iso_now():
    tz = datetime.timezone(datetime.timedelta(hours=9))
    return datetime.datetime.now(tz).isoformat(timespec="seconds")


def normalize_extracted_text(value):
    value = str(value or "").replace("\x00", " ")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def parse_content_disposition(value):
    result = {}
    for part in value.split(";"):
        part = part.strip()
        if "=" not in part:
            result.setdefault("type", part.lower())
            continue
        key, raw = part.split("=", 1)
        result[key.strip().lower()] = raw.strip().strip('"')
    return result


def read_multipart_form(headers, body):
    content_type = headers.get("Content-Type") or headers.get("content-type") or ""
    boundary_match = re.search(r'boundary="?([^";]+)"?', content_type)
    if not boundary_match:
        raise ValueError("multipart boundary is missing")
    boundary = ("--" + boundary_match.group(1)).encode("utf-8")
    fields = {}
    files = {}
    for part in body.split(boundary):
        part = part.strip(b"\r\n")
        if not part or part == b"--":
            continue
        if part.endswith(b"--"):
            part = part[:-2].rstrip(b"\r\n")
        header_bytes, separator, value = part.partition(b"\r\n\r\n")
        if not separator:
            continue
        part_headers = {}
        for raw_line in header_bytes.decode("utf-8", "ignore").split("\r\n"):
            key, _, header_value = raw_line.partition(":")
            if key:
                part_headers[key.strip().lower()] = header_value.strip()
        disposition = parse_content_disposition(part_headers.get("content-disposition", ""))
        name = disposition.get("name")
        if not name:
            continue
        if "filename" in disposition:
            files[name] = {
                "filename": disposition.get("filename", ""),
                "content_type": part_headers.get("content-type", ""),
                "content": value.rstrip(b"\r\n"),
            }
        else:
            fields[name] = value.decode("utf-8", "ignore").strip()
    return fields, files


def estimate_pdf_page_count(pdf_bytes):
    matches = re.findall(rb"/Type\s*/Page\b", pdf_bytes)
    return max(1, len(matches))


def extract_text_with_pypdf(pdf_bytes):
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")
    return normalize_extracted_text("\n\n".join(pages)), len(reader.pages)


def is_useful_extracted_text(text):
    text = normalize_extracted_text(text)
    if len(text) < 20:
        return False
    sample = text[:5000]
    total = max(len(sample), 1)
    printable = sum(1 for ch in sample if ch.isprintable() or ch in "\n\r\t")
    control = sum(1 for ch in sample if ord(ch) < 32 and ch not in "\n\r\t")
    alpha_num = sum(1 for ch in sample if ch.isalnum())
    pdf_markers = sum(sample.count(marker) for marker in [
        "endstream",
        "endobj",
        "FlateDecode",
        "/Type /Page",
        "/XObject",
        " obj",
    ])
    if pdf_markers >= 3:
        return False
    if control / total > 0.02:
        return False
    if printable / total < 0.9:
        return False
    return alpha_num / max(printable, 1) > 0.12


def find_runtime_binary(name):
    override = os.environ.get(f"{name.upper()}_BIN")
    if override and os.path.exists(override):
        return override
    found = shutil.which(name)
    if found:
        return found
    bundled = os.path.expanduser(f"~/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/{name}")
    if os.path.exists(bundled):
        return bundled
    return ""


def run_tesseract(image_path, languages):
    tesseract = find_runtime_binary("tesseract")
    if not tesseract:
        return ""
    try:
        completed = subprocess.run(
            [tesseract, image_path, "stdout", "-l", languages, "--psm", os.environ.get("TESSERACT_PSM", "6")],
            check=True,
            capture_output=True,
            text=True,
            timeout=45,
        )
        return normalize_extracted_text(completed.stdout)
    except Exception:
        return ""


def extract_text_with_ocr(pdf_bytes, page_count):
    pdftoppm = find_runtime_binary("pdftoppm")
    if not pdftoppm:
        return "", "ocr_unavailable:pdftoppm"
    if not find_runtime_binary("tesseract"):
        return "", "ocr_unavailable:tesseract"

    max_pages = min(max(page_count or 1, 1), int(os.environ.get("OCR_MAX_PAGES", OCR_MAX_PAGES)))
    dpi = int(os.environ.get("OCR_DPI", OCR_DPI))
    language_candidates = [
        os.environ.get("TESSERACT_LANGS", "kor+eng"),
        "eng",
    ]
    with tempfile.TemporaryDirectory(prefix="profile-pdf-ocr-") as tmpdir:
        pdf_path = os.path.join(tmpdir, "input.pdf")
        prefix = os.path.join(tmpdir, "page")
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)
        subprocess.run(
            [pdftoppm, "-png", "-r", str(dpi), "-f", "1", "-l", str(max_pages), pdf_path, prefix],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        pages = []
        for page_number in range(1, max_pages + 1):
            image_path = f"{prefix}-{page_number}.png"
            if not os.path.exists(image_path):
                continue
            page_text = ""
            for languages in language_candidates:
                if not languages:
                    continue
                page_text = run_tesseract(image_path, languages)
                if is_useful_extracted_text(page_text):
                    break
            if page_text:
                pages.append(f"[Page {page_number}]\n{page_text}")
        text = normalize_extracted_text("\n\n".join(pages))
    if not is_useful_extracted_text(text):
        return "", "ocr_no_text"
    return text, "tesseract_ocr"


def decode_pdf_literal(value):
    output = []
    i = 0
    while i < len(value):
        char = value[i]
        if char != "\\":
            output.append(char)
            i += 1
            continue
        i += 1
        if i >= len(value):
            break
        escaped = value[i]
        mapping = {"n": "\n", "r": "\r", "t": "\t", "b": "\b", "f": "\f", "\\": "\\", "(": "(", ")": ")"}
        if escaped in mapping:
            output.append(mapping[escaped])
            i += 1
        elif escaped in "01234567":
            digits = escaped
            i += 1
            for _ in range(2):
                if i < len(value) and value[i] in "01234567":
                    digits += value[i]
                    i += 1
            output.append(chr(int(digits, 8)))
        else:
            output.append(escaped)
            i += 1
    return "".join(output)


def fallback_pdf_text(pdf_bytes):
    chunks = []
    raw_streams = re.findall(rb"stream\r?\n(.*?)\r?\nendstream", pdf_bytes, flags=re.S)
    candidates = [pdf_bytes]
    for stream in raw_streams:
        try:
            candidates.append(zlib.decompress(stream.strip()))
        except Exception:
            candidates.append(stream)
    for candidate in candidates:
        text = candidate.decode("latin-1", "ignore")
        for literal in re.findall(r"\((?:\\.|[^\\()]){2,}\)", text):
            decoded = decode_pdf_literal(literal[1:-1])
            if re.search(r"[A-Za-z가-힣0-9]", decoded):
                chunks.append(decoded)
        for hex_text in re.findall(r"<([0-9A-Fa-f\s]{8,})>", text):
            compact = re.sub(r"\s+", "", hex_text)
            try:
                decoded = bytes.fromhex(compact).decode("utf-16-be", "ignore")
            except Exception:
                continue
            if re.search(r"[A-Za-z가-힣0-9]", decoded):
                chunks.append(decoded)
    unique_chunks = []
    seen = set()
    for chunk in chunks:
        key = chunk.strip()
        if key and key not in seen:
            seen.add(key)
            unique_chunks.append(chunk)
    return normalize_extracted_text("\n".join(unique_chunks))


def extract_pdf_text(pdf_bytes):
    page_count = estimate_pdf_page_count(pdf_bytes)
    try:
        text, pypdf_page_count = extract_text_with_pypdf(pdf_bytes)
        page_count = pypdf_page_count or page_count
        if is_useful_extracted_text(text):
            return {
                "text": text,
                "page_count": page_count,
                "extractor": "pypdf",
            }
    except Exception:
        pass

    ocr_text, ocr_status = extract_text_with_ocr(pdf_bytes, page_count)
    if ocr_text:
        return {
            "text": ocr_text,
            "page_count": page_count,
            "extractor": ocr_status,
        }

    text = fallback_pdf_text(pdf_bytes)
    if not is_useful_extracted_text(text):
        text = ""
    return {
        "text": text,
        "page_count": page_count,
        "extractor": "fallback_pdf_strings" if text else ocr_status,
    }


def extract_response_output_text(response):
    if response.get("output_text"):
        return response["output_text"]
    parts = []
    for item in response.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text":
                parts.append(content.get("text", ""))
    return "\n".join(parts).strip()


def parse_json_object(text):
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start:end + 1])
        raise


def openai_error_message(error):
    body = error.read().decode("utf-8", "ignore")
    try:
        payload = json.loads(body)
        return clean_text((payload.get("error") or {}).get("message") or body)
    except Exception:
        return clean_text(body)


def openai_api_key():
    return os.environ.get("OPENAI_API_KEY") or os.environ.get("CHATGPT_API_KEY")


def openai_model():
    return os.environ.get("OPENAI_MODEL", DEFAULT_OPENAI_MODEL)


def call_openai_structured(instructions, user_payload, schema_name, schema, max_output_tokens=4000, timeout=DEFAULT_OPENAI_TIMEOUT):
    api_key = openai_api_key()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured on the server")

    model = openai_model()
    if isinstance(user_payload, str):
        input_text = user_payload
    else:
        input_text = json.dumps(user_payload, ensure_ascii=False)
    payload = {
        "model": model,
        "instructions": instructions,
        "input": [
            {
                "role": "user",
                "content": [{"type": "input_text", "text": input_text}],
            }
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": schema_name,
                "schema": schema,
                "strict": True,
            }
        },
        "store": False,
        "temperature": 0.2,
        "max_output_tokens": max_output_tokens,
    }
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        OPENAI_RESPONSES_URL,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            response = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"OpenAI API error {exc.code}: {openai_error_message(exc)}")
    except urllib.error.URLError as exc:
        raise RuntimeError(f"OpenAI API request failed: {exc.reason}")
    output_text = extract_response_output_text(response)
    if not output_text:
        raise RuntimeError("OpenAI API returned an empty response")
    return parse_json_object(output_text), model


def call_openai_profile_analysis(extracted_text, document_type, source_document):
    text_for_ai = extracted_text[:MAX_OPENAI_TEXT_CHARS]
    prompt = {
        "document_type": document_type,
        "source_document": source_document,
        "extracted_text": text_for_ai,
    }
    parsed, model = call_openai_structured(
        PROFILE_ANALYSIS_PROMPT,
        "다음 PDF 추출 텍스트를 분석해 JSON으로 변환하세요.\n\n" + json.dumps(prompt, ensure_ascii=False),
        "resume_portfolio_profile",
        PROFILE_ANALYSIS_SCHEMA,
        max_output_tokens=7000,
        timeout=90,
    )
    return parsed, model


def build_profile_text_from_analysis(result):
    profile = result.get("candidate_profile") or {}
    matching = result.get("matching_profile") or {}
    analysis = result.get("ai_analysis_result") or {}
    technical = [
        skill.get("name", "")
        for skill in ((profile.get("skills") or {}).get("technical_skills") or [])
        if skill.get("name")
    ]
    projects = [
        item.get("name", "")
        for item in profile.get("projects", [])
        if item.get("name")
    ]
    return {
        "resume": "\n".join(filter(None, [profile.get("headline", ""), profile.get("summary", ""), analysis.get("overall_summary", "")])),
        "portfolio": ", ".join(projects),
        "skills": ", ".join((matching.get("core_keywords") or []) + technical),
        "preferences": ", ".join((matching.get("preferred_work_style") or {}).get("location") or []),
    }


def wrap_profile_analysis_result(ai_result, source_document, extracted_text, model):
    return {
        "schema_version": "resume_portfolio_profile.v1",
        "user_id": "local-user",
        "generated_at": iso_now(),
        "source_documents": [source_document],
        "candidate_profile": ai_result.get("candidate_profile", {}),
        "matching_profile": ai_result.get("matching_profile", {}),
        "ai_analysis_result": ai_result.get("ai_analysis_result", {}),
        "model": model,
    }


def ensure_profile_analysis_payload(state):
    analysis = state.setdefault("profileAnalysis", dict(DEFAULT_PROFILE_ANALYSIS))
    for key, value in DEFAULT_PROFILE_ANALYSIS.items():
        analysis.setdefault(key, value)
    return analysis


def analyze_profile_pdf_upload(headers, body, state=None):
    analysis = dict(DEFAULT_PROFILE_ANALYSIS)
    fields, files = read_multipart_form(headers, body)
    upload = files.get("document")
    if not upload:
        raise ValueError("PDF file is required")

    filename = os.path.basename(upload.get("filename") or "")
    document_type = clean_text(fields.get("documentType") or "resume_portfolio")
    content_type = upload.get("content_type") or ""
    pdf_bytes = upload.get("content") or b""
    if len(pdf_bytes) > MAX_UPLOAD_BYTES:
        raise ValueError(f"PDF file is too large. Maximum size is {MAX_UPLOAD_BYTES // 1024 // 1024}MB")
    if not filename.lower().endswith(".pdf"):
        raise ValueError("Only .pdf files are supported")
    if content_type and "pdf" not in content_type.lower() and content_type.lower() != "application/octet-stream":
        raise ValueError("Only PDF uploads are supported")
    if not pdf_bytes.startswith(b"%PDF-"):
        raise ValueError("Uploaded file is not a valid PDF")

    extracted = extract_pdf_text(pdf_bytes)
    extracted_text = extracted.get("text", "")
    source_document = {
        "document_id": f"profile_pdf_{int(time.time())}",
        "document_type": document_type,
        "original_file_name": filename,
        "file_format": "pdf",
        "mime_type": content_type or "application/pdf",
        "page_count": extracted.get("page_count") or estimate_pdf_page_count(pdf_bytes),
        "text_extractor": extracted.get("extractor") or "unknown",
        "extracted_text_char_count": len(extracted_text),
        "sent_to_ai_char_count": min(len(extracted_text), MAX_OPENAI_TEXT_CHARS),
        "truncated_for_ai": len(extracted_text) > MAX_OPENAI_TEXT_CHARS,
        "language": ["ko", "en"],
        "parse_status": "success" if extracted_text else "no_text",
    }
    if not extracted_text:
        analysis.update({
            "status": "text_extraction_failed",
            "locked": False,
            "lastError": "No selectable text was found. Configure Tesseract OCR on the server for image-only PDFs.",
            "sourceDocument": source_document,
            "extractedText": "",
            "convertedJsonText": "",
            "result": "",
            "model": os.environ.get("OPENAI_MODEL", DEFAULT_OPENAI_MODEL),
            "attemptedAt": iso_now(),
            "completedAt": iso_now(),
        })
        return {
            "ok": True,
            "analysis": analysis,
            "profile": {},
        }, 200

    analysis.update({
        "status": "text_extracted",
        "locked": False,
        "lastError": "",
        "sourceDocument": source_document,
        "extractedText": extracted_text,
        "convertedJsonText": "",
        "result": "",
        "model": os.environ.get("OPENAI_MODEL", DEFAULT_OPENAI_MODEL),
        "attemptedAt": iso_now(),
        "completedAt": "",
    })

    try:
        analysis["status"] = "running"
        analysis["attempts"] = int(analysis.get("attempts") or 0) + 1
        ai_result, model = call_openai_profile_analysis(extracted_text, document_type, source_document)
        result = wrap_profile_analysis_result(ai_result, source_document, extracted_text, model)
    except Exception as exc:
        analysis.update({
            "status": "text_extracted",
            "locked": False,
            "lastError": str(exc),
            "convertedJsonText": "",
            "result": "",
            "completedAt": iso_now(),
        })
        return {
            "ok": True,
            "analysis": analysis,
            "profile": {},
        }, 200

    profile = build_profile_text_from_analysis(result)
    analysis.update({
        "status": "completed",
        "locked": True,
        "lastError": "",
        "sourceDocument": source_document,
        "extractedText": extracted_text,
        "result": result,
        "convertedJsonText": json.dumps(result, ensure_ascii=False, indent=2),
        "model": model,
        "completedAt": iso_now(),
    })
    return {
        "ok": True,
        "analysis": analysis,
        "profile": profile,
    }, 200


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


def empty_slack_messages():
    return {
        "message_title": "",
        "message_body": "",
        "thread_comment": "",
        "thread_summary": "",
        "key_points": [],
        "ai_mode": "",
        "model": "",
        "generated_at": "",
        "error": "",
    }


def build_job_payload(source, source_url, raw, job_profile=None, job_id=None):
    raw = {
        "title": clean_text(raw.get("title")),
        "company_name": clean_text(raw.get("company_name")),
        "career": clean_text(raw.get("career")),
        "location": clean_text(raw.get("location")),
        "salary": clean_text(raw.get("salary") or "공고 상세 참고"),
        "period": clean_text(raw.get("period")),
        "raw_text": clean_text(raw.get("raw_text"))[:8000],
    }
    profile = {
        "company_name": raw["company_name"],
        "job_title": raw["title"],
        "responsibilities": [],
        "required_skills": [],
        "preferred_skills": [],
        "cover_letter_questions": [],
        "deadline": "",
    }
    profile.update(job_profile or {})
    for key in ["responsibilities", "required_skills", "preferred_skills", "cover_letter_questions"]:
        value = profile.get(key)
        if isinstance(value, str):
            profile[key] = [value] if value else []
        elif not isinstance(value, list):
            profile[key] = []
    return {
        "id": job_id or f"{source}_{abs(hash(source_url))}",
        "source": source,
        "source_url": source_url,
        "raw": raw,
        "job_profile": profile,
        "slack_messages": empty_slack_messages(),
    }


def format_deadline(period_end):
    period_end = clean_text(period_end)
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", period_end):
        return ""
    return f"{period_end}T23:59:59+09:00"


def job_company(job):
    return clean_text((job.get("job_profile") or {}).get("company_name") or (job.get("raw") or {}).get("company_name") or job.get("company"))


def job_title(job):
    return clean_text((job.get("job_profile") or {}).get("job_title") or (job.get("raw") or {}).get("title") or job.get("title"))


def job_keywords(job):
    profile = job.get("job_profile") or {}
    values = []
    for key in ["responsibilities", "required_skills", "preferred_skills"]:
        values.extend(profile.get(key) or [])
    return [clean_text(value) for value in values if clean_text(value)]


def env_int(name, default):
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def clamp_int(value, default, minimum=1, maximum=20):
    try:
        number = int(value)
    except (TypeError, ValueError):
        number = default
    return max(minimum, min(maximum, number))


def openai_job_message_limit():
    default = 0 if os.environ.get("VERCEL") else 10
    return max(0, env_int("OPENAI_JOB_MESSAGE_LIMIT", default))


def openai_job_message_timeout():
    return max(1, env_int("OPENAI_JOB_MESSAGE_TIMEOUT", DEFAULT_OPENAI_JOB_MESSAGE_TIMEOUT))


def compact_job_for_ai(job):
    raw = job.get("raw") or {}
    profile = job.get("job_profile") or {}
    return {
        "id": str(job.get("id", "")),
        "source": clean_text(job.get("source")),
        "source_url": clean_text(job.get("source_url")),
        "raw": {
            "title": clean_text(raw.get("title")),
            "company_name": clean_text(raw.get("company_name")),
            "career": clean_text(raw.get("career")),
            "location": clean_text(raw.get("location")),
            "salary": clean_text(raw.get("salary")),
            "period": clean_text(raw.get("period")),
            "raw_text_excerpt": clean_text(raw.get("raw_text"))[:1800],
        },
        "job_profile": {
            "company_name": clean_text(profile.get("company_name")),
            "job_title": clean_text(profile.get("job_title")),
            "responsibilities": [clean_text(item) for item in (profile.get("responsibilities") or [])[:8]],
            "required_skills": [clean_text(item) for item in (profile.get("required_skills") or [])[:12]],
            "preferred_skills": [clean_text(item) for item in (profile.get("preferred_skills") or [])[:8]],
            "cover_letter_questions": [clean_text(item) for item in (profile.get("cover_letter_questions") or [])[:5]],
            "deadline": clean_text(profile.get("deadline")),
        },
    }


def job_message_cache_key(job):
    return "|".join([
        clean_text(job.get("source_url")),
        job_title(job),
        job_company(job),
        clean_text((job.get("raw") or {}).get("period")),
    ])


def normalize_slack_message(job, message=None, ai_mode="openai", model="", error=""):
    message = message or {}
    fallback = local_slack_message(job, error=error)
    merged = {
        "message_title": clean_text(message.get("message_title")) or fallback["message_title"],
        "message_body": clean_text(message.get("message_body")) or fallback["message_body"],
        "thread_comment": clean_text(message.get("thread_comment")) or fallback["thread_comment"],
        "thread_summary": clean_text(message.get("thread_summary")) or fallback["thread_summary"],
        "key_points": message.get("key_points") if isinstance(message.get("key_points"), list) else fallback["key_points"],
        "ai_mode": ai_mode,
        "model": model,
        "generated_at": iso_now(),
        "error": clean_text(error),
    }
    merged["key_points"] = [clean_text(item) for item in merged["key_points"][:8] if clean_text(item)]
    return merged


def local_slack_message(job, error=""):
    company = job_company(job) or "채용공고"
    title = job_title(job) or "공고"
    raw = job.get("raw") or {}
    profile = job.get("job_profile") or {}
    keywords = job_keywords(job)
    keyword_text = ", ".join(keywords[:5]) or "상세 직무 키워드 확인 필요"
    career = clean_text(raw.get("career")) or "경력 기준 확인 필요"
    location = clean_text(raw.get("location")) or "위치 확인 필요"
    salary = clean_text(raw.get("salary")) or "급여 확인 필요"
    period = clean_text(raw.get("period")) or clean_text(profile.get("deadline")) or "마감일 확인 필요"
    seed = f"{company}|{title}|{period}|{keyword_text}"
    emoji = stable_pick(seed, [":eyes:", ":memo:", ":bulb:", ":mag:", ":sparkles:", ""])
    primary_keyword = keyword_text.split(",")[0].strip() or "직무"
    message_variants = [
        {
            "title": f"{company} 쪽 참고할 만한 흐름",
            "body": "\n\n".join([
                f"{company} 쪽에서 눈에 들어온 역할 하나 공유해요{(' ' + emoji) if emoji else ''}",
                f"{keyword_text} 쪽 키워드가 같이 묶여 있어서, 관련 업무 보시는 분들은 레퍼런스로 봐도 좋겠습니다.",
                f"조건은 {career}, 일정은 {period} 기준이에요. 자세한 건 스레드에 남겨둘게요.",
            ]),
        },
        {
            "title": f"{primary_keyword} 쪽 짧은 메모",
            "body": "\n\n".join([
                f"짧게만 공유합니다. {company}에서 {primary_keyword} 축 역할이 하나 보입니다.",
                f"길게 볼 건 아니고, {keyword_text} 경험 있는 분들이 원문만 빠르게 확인하면 될 것 같아요.",
            ]),
        },
        {
            "title": f"{company} 건, 우선 체크",
            "body": "\n\n".join([
                "이건 우선순위 조금 높게 봐도 좋겠습니다.",
                f"{company} / {title} 흐름이고, 키워드는 {keyword_text} 쪽으로 잡혀 있어요.",
                f"{career} 기준이라 바로 실무 얘기 가능한 분들에게 더 맞을 듯합니다. 스레드에 판단 포인트만 정리해둘게요.",
            ]),
        },
        {
            "title": "전사 참고용 레퍼런스",
            "body": "\n\n".join([
                "전사 참고용으로 하나 공유드립니다.",
                f"{company}에서 {primary_keyword} 관련 역할을 보고 있고, 시장에서 어떤 역량을 같이 묶는지 보기 좋습니다.",
                f"지원 여부와 별개로 {keyword_text} 조합은 한 번 체크해보시면 좋겠습니다.",
            ]),
        },
        {
            "title": f"{company} 레퍼런스 하나",
            "body": "\n\n".join([
                f"요거 봤는데 {company} 쪽 역할 정의가 꽤 선명해 보여요.",
                f"특히 {primary_keyword} 쪽을 중심으로, {keyword_text} 경험을 같이 보는 느낌입니다.",
                f"위치/처우는 원문 확인 필요하고, 마감 흐름은 {period}로 보입니다.",
            ]),
        },
        {
            "title": f"{primary_keyword} 보는 분들만",
            "body": "\n\n".join([
                f"{primary_keyword} 보시는 분들만 가볍게 확인해 주세요.",
                f"{company} 건이고, {career} 기준입니다.",
                "스레드에 핵심만 적어놨습니다 :memo:",
            ]),
        },
        {
            "title": f"{company} / 업무 범위 체크",
            "body": "\n\n".join([
                f"팀장님들께 공유드립니다. {company} 쪽에서 {title} 역할이 올라와 있습니다.",
                f"업무 범위는 {keyword_text} 근처로 보이고, 후보자 풀이 있다면 내부에서 한 번 매칭해볼 만합니다.",
                f"기한은 {period}, 위치는 {location} 기준입니다.",
            ]),
        },
        {
            "title": "가볍게 던져두는 건",
            "body": "\n\n".join([
                "저 이거 보다가 괜찮아 보여서 던져둡니다.",
                f"{company}이고요, {keyword_text} 쪽이 같이 보여요.",
                f"완전 찰떡인지는 원문 봐야 하는데, {career} 조건 괜찮은 분들은 한 번 보면 좋을 듯해요 {emoji}".strip(),
            ]),
        },
        {
            "title": f"{company} 시장 신호",
            "body": "\n\n".join([
                f"{company} 건은 지원용이라기보다 시장 신호로도 볼 만합니다.",
                f"{primary_keyword} 하나만 보는 게 아니라 {keyword_text}를 같이 묶어두고 있어요.",
                "요즘 비슷한 역할들이 어떤 식으로 포지셔닝되는지 참고하기 좋겠습니다.",
            ]),
        },
        {
            "title": "오늘 체크 리스트에 추가",
            "body": "\n\n".join([
                f"오늘 체크 리스트에 {company} 건 하나 추가해두면 좋겠습니다.",
                f"역할은 {title} 쪽이고, 핵심 단어는 {keyword_text}입니다.",
                f"급한 건 아니지만 {period} 일정이라, 관심 있는 분들은 이번 주 안에 원문만 먼저 봐주세요.",
            ]),
        },
        {
            "title": f"{primary_keyword} 관련 참고",
            "body": "\n\n".join([
                f"참고로 {primary_keyword} 관련해서 이런 역할도 나왔습니다.",
                f"{company}에서 보는 기준은 {career}, 위치는 {location}로 잡혀 있어요.",
                "내용이 길진 않아서 스레드에 판단용 포인트만 정리했습니다.",
            ]),
        },
        {
            "title": "대표님 공지 톤으로",
            "body": "\n\n".join([
                "전체 공유드립니다.",
                f"{company}의 {title} 건은 우리가 보는 직무/사업 흐름과 연결해서 참고할 만합니다.",
                f"특히 {keyword_text} 조합이 보이니, 관련 담당자는 원문을 확인하고 적용 가능한 인사이트가 있는지 봐주세요.",
            ]),
        },
        {
            "title": f"{company} 건, 길게 보면",
            "body": "\n\n".join([
                f"{company} 건은 단순 채용이라기보다 역할 설계를 보는 자료로도 괜찮습니다.",
                f"공개된 키워드만 보면 {primary_keyword}를 중심으로 {keyword_text}까지 같이 보고 있고요.",
                f"{career} 기준이라 기대하는 경험치가 어느 정도 있는 편입니다.",
                "지원 후보가 아니어도, 포트폴리오 문장 만들 때 참고할 만한 구조라 스레드에 남겨둡니다.",
            ]),
        },
        {
            "title": "이건 짧게 공유",
            "body": "\n\n".join([
                f"{company} / {primary_keyword} 쪽입니다.",
                f"{career}, {period}.",
                "맞는 분만 스레드 확인해 주세요.",
            ]),
        },
        {
            "title": f"{company} 업무 흐름 메모",
            "body": "\n\n".join([
                f"{company} 쪽 업무 흐름을 보면 {primary_keyword}만 단독으로 보는 건 아닌 듯합니다.",
                f"{keyword_text}가 같이 있어서, 실행/분석/운영 사이를 오가는 역할일 가능성이 있어요.",
                "원문 기준으로 더 확인해야 하지만, 방향성은 참고할 만합니다 :bulb:",
            ]),
        },
        {
            "title": "후보자 추천 관점",
            "body": "\n\n".join([
                f"후보자 추천 관점으로 보면 {company} 건은 {career} 쪽이 핵심입니다.",
                f"{keyword_text} 경험을 말로만 쓴 분보다, 실제 결과물이나 지표가 있는 분이 더 잘 맞을 것 같아요.",
                f"기한은 {period}라 여유는 많지 않을 수 있습니다.",
            ]),
        },
        {
            "title": f"{primary_keyword} 쪽 괜찮은 예시",
            "body": "\n\n".join([
                f"{primary_keyword} 쪽 포지션 설명 예시로 {company} 건 괜찮아 보여요.",
                f"회사/산업 맥락은 원문 확인이 필요하지만, 요구하는 키워드는 {keyword_text} 쪽입니다.",
                "포폴 방향 잡는 분들도 한 번 보면 좋겠습니다.",
            ]),
        },
        {
            "title": "살짝 눈에 띈 건",
            "body": "\n\n".join([
                "살짝 눈에 띈 건이라 공유해요.",
                f"{company}에서 {title} 역할을 보고 있고, 조건은 {career}로 보입니다.",
                f"키워드는 {keyword_text}. 관심 있으면 원문 먼저 열어보고, 괜찮으면 스레드 기준으로 판단해보죠.",
            ]),
        },
        {
            "title": f"{company} 관련 빠른 공유",
            "body": "\n\n".join([
                f"빠르게 공유합니다. {company} 쪽에서 {primary_keyword} 관련 역할이 나왔습니다.",
                f"현재 보이는 정보 기준으로는 {keyword_text} 경험을 같이 보는 듯하고, 위치는 {location}입니다.",
                "공고문처럼 길게 읽기보다, 우리 쪽 후보/포폴 방향과 맞는지만 먼저 보면 될 것 같습니다.",
            ]),
        },
        {
            "title": "실무자 관점 체크",
            "body": "\n\n".join([
                f"실무자 관점에서 보면 {company} 건은 업무 범위 확인이 먼저입니다.",
                f"{title}이라고 되어 있지만 실제 판단은 {keyword_text} 쪽 경험을 얼마나 갖고 있느냐가 될 것 같아요.",
                f"{salary} / {location} / {period}는 원문에서 같이 확인하면 좋겠습니다.",
            ]),
        },
    ]
    selected_variant = stable_pick(seed + "message-variant-20", message_variants)
    message_body = selected_variant["body"]
    thread_intro = stable_pick(seed + "thread", [
        f"{company}의 {title} 역할로 보여요.",
        f"이 건은 {title} 중심으로 보면 될 것 같아요.",
        f"원문 기준으로 보면 {company}에서 {title} 쪽을 찾는 흐름입니다.",
        f"{company} 건은 아래 포인트만 먼저 보면 판단이 빠를 듯해요.",
    ])
    thread_comment = "\n\n".join([
        thread_intro,
        stable_pick(seed + "note", [
            "세부 내용 가볍게 정리해봤어요.",
            "볼 만한 부분만 추려두면 이렇습니다.",
            "지원 검토할 때 볼 체크포인트는 아래 정도예요.",
        ]),
        "\n".join([
            f"• 관련 조직/회사: {company}",
            f"• 역할 성격: {title}",
            f"• 주요 키워드: {keyword_text}",
            f"• 경험 기준: {career}",
            f"• 위치: {location}",
            f"• 확인 기한: {period}",
            f"• 급여: {salary}",
        ]),
        stable_pick(seed + "tail", [
            "전체적으로는 원문 확인 후 역할 범위와 기대 성과를 같이 보면 좋겠습니다.",
            "조건이 축약돼 보이는 부분이 있어서, 원문에서 팀/근무지/처우는 한 번 더 확인해 주세요.",
            "키워드는 괜찮아 보이지만 실제 핏은 상세 업무 범위를 보고 판단하는 게 좋겠습니다.",
        ]),
    ])
    key_points = [
        f"회사: {company}",
        f"역할: {title}",
        f"키워드: {keyword_text}",
        f"경력: {career}",
        f"위치: {location}",
        f"기한: {period}",
    ]
    return {
        "message_title": selected_variant["title"],
        "message_body": message_body,
        "thread_comment": thread_comment,
        "thread_summary": f"{company} / {title} / {career}",
        "key_points": key_points,
        "ai_mode": "local_fallback",
        "model": "",
        "generated_at": iso_now(),
        "error": clean_text(error),
    }


def apply_slack_message(job, message):
    existing = job.get("slack_messages") or {}
    merged = empty_slack_messages()
    merged.update(existing)
    merged.update(message)
    job["slack_messages"] = merged
    return job


def stable_index(seed, length):
    if length <= 0:
        return 0
    digest = hashlib.sha256(clean_text(seed).encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % length


def stable_pick(seed, values):
    return values[stable_index(seed, len(values))]


def hydrate_one_openai_slack_message(key, job):
    result, model = call_openai_structured(
        SLACK_JOB_MESSAGE_PROMPT,
        {
            "jobs": [compact_job_for_ai(job)],
            "output_use": "Slack channel message and first thread comment for this job",
        },
        "job_slack_messages",
        SLACK_JOB_MESSAGE_SCHEMA,
        max_output_tokens=1800,
        timeout=openai_job_message_timeout(),
    )
    messages = result.get("jobs", [])
    message = messages[0] if messages and isinstance(messages[0], dict) else {}
    return key, normalize_slack_message(job, message, ai_mode="openai", model=model)


def hydrate_slack_messages(jobs):
    if not jobs:
        return jobs

    limit = openai_job_message_limit()
    pending = []
    for job in jobs:
        key = job_message_cache_key(job)
        cached = JOB_MESSAGE_CACHE.get(key)
        if cached:
            apply_slack_message(job, cached)
            continue
        pending.append((key, job))

    if not pending:
        return jobs

    if not openai_api_key() or limit <= 0:
        reason = "OPENAI_API_KEY is not configured on the server" if not openai_api_key() else "OPENAI_JOB_MESSAGE_LIMIT disabled"
        for key, job in pending:
            message = normalize_slack_message(job, {}, ai_mode="local_fallback", error=reason)
            JOB_MESSAGE_CACHE[key] = message
            apply_slack_message(job, message)
        return jobs

    selected = pending[:limit]
    overflow = pending[limit:]
    max_workers = max(1, min(env_int("OPENAI_JOB_MESSAGE_WORKERS", 4), len(selected)))
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {
            executor.submit(hydrate_one_openai_slack_message, key, job): (key, job)
            for key, job in selected
        }
        for future in concurrent.futures.as_completed(future_map):
            key, job = future_map[future]
            try:
                _, message = future.result()
            except Exception as exc:
                message = normalize_slack_message(job, {}, ai_mode="local_fallback", error=str(exc))
            JOB_MESSAGE_CACHE[key] = message
            apply_slack_message(job, message)

    for key, job in overflow:
        message = normalize_slack_message(job, {}, ai_mode="local_fallback", error="OPENAI_JOB_MESSAGE_LIMIT overflow")
        JOB_MESSAGE_CACHE[key] = message
        apply_slack_message(job, message)
    return jobs


def normalize_job(item, query):
    legacy_job_no = str(item.get("id") or item.get("legacyJobNo") or f"{query}-{time.time()}")
    url = f"https://www.jobkorea.co.kr/Recruit/GI_Read/{legacy_job_no}" if legacy_job_no else f"https://www.jobkorea.co.kr/Search/?stext={urllib.parse.quote(query)}"
    period = item.get("applicationPeriod") or {}
    start = str(period.get("start", ""))[:10]
    end = str(period.get("end", ""))[:10]
    keywords = item.get("_internal_keywordList") or item.get("benefitNameList") or []
    if isinstance(keywords, str):
        keywords = [keywords]
    title = clean_text(item.get("title"))
    company_name = clean_text(item.get("postingCompanyName") or item.get("companyName"))
    period_label = f"{start} ~ {end}" if start or end else "공고 상세 참고"
    raw_text = json.dumps(item, ensure_ascii=False)
    return build_job_payload(
        source="jobkorea",
        source_url=url,
        raw={
            "title": title,
            "company_name": company_name,
            "career": career_label(item.get("careerType"), item.get("careerRange")),
            "location": location_label(item.get("areaCodeList")),
            "salary": clean_text(item.get("salary") or item.get("pay") or "공고 상세 참고"),
            "period": period_label,
            "raw_text": raw_text,
        },
        job_profile={
            "company_name": company_name,
            "job_title": title,
            "required_skills": [clean_text(k) for k in keywords[:10]],
            "deadline": format_deadline(end),
        },
        job_id=f"jobkorea_{legacy_job_no}",
    )


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


def search_jobkorea(query, limit=10):
    url = f"https://www.jobkorea.co.kr/Search/?stext={urllib.parse.quote(query)}"
    text = fetch_text(url)
    content = extract_job_content(text)
    jobs = [normalize_job(item, query) for item in content if isinstance(item, dict) and item.get("title")]
    return hydrate_slack_messages(jobs[:limit])


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
    keywords = infer_keywords(visible)
    job = build_job_payload(
        source="parsed_url",
        source_url=url,
        raw={
            "title": title,
            "company_name": company,
            "career": infer_career(visible),
            "location": infer_location(visible),
            "salary": "공고 상세 참고",
            "period": infer_period(visible),
            "raw_text": visible,
        },
        job_profile={
            "company_name": company,
            "job_title": title,
            "required_skills": keywords,
            "responsibilities": bullets[:4],
        },
        job_id=f"parsed_{abs(hash(url))}",
    )
    return hydrate_slack_messages([job])[0]


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


def collect_text_values(value):
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, (int, float, bool)):
        return [str(value)]
    if isinstance(value, list):
        values = []
        for item in value:
            values.extend(collect_text_values(item))
        return values
    if isinstance(value, dict):
        values = []
        for item in value.values():
            values.extend(collect_text_values(item))
        return values
    return [str(value)]


def profile_analysis_result(profile_analysis=None):
    if not isinstance(profile_analysis, dict):
        return {}
    result = profile_analysis.get("result")
    if isinstance(result, dict):
        return result
    if isinstance(result, str) and result.strip().startswith("{"):
        try:
            return json.loads(result)
        except json.JSONDecodeError:
            return {}
    converted = profile_analysis.get("convertedJsonText")
    if isinstance(converted, str) and converted.strip().startswith("{"):
        try:
            return json.loads(converted)
        except json.JSONDecodeError:
            return {}
    return {}


def candidate_display_name(profile=None, profile_result=None):
    profile_result = profile_result or {}
    personal = (profile_result.get("candidate_profile") or {}).get("personal_info") or {}
    name = clean_text(personal.get("name"))
    if name:
        return name
    for field in ["name", "userName", "displayName"]:
        name = clean_text((profile or {}).get(field))
        if name:
            return name
    return "사용자"


def profile_has_analysis(profile_analysis=None):
    result = profile_analysis_result(profile_analysis)
    return bool(result.get("schema_version") or result.get("candidate_profile") or result.get("matching_profile"))


def compact_profile_for_ai(profile=None, profile_analysis=None):
    result = profile_analysis_result(profile_analysis)
    return {
        "profile": profile or {},
        "analysis_status": (profile_analysis or {}).get("status") if isinstance(profile_analysis, dict) else "",
        "candidate_profile": result.get("candidate_profile", {}),
        "matching_profile": result.get("matching_profile", {}),
        "ai_analysis_result": result.get("ai_analysis_result", {}),
        "source_documents": result.get("source_documents", []),
    }


def local_match_comment(name, score, strengths, risks, next_actions, recommendation):
    good = strengths[0] if strengths else "프로필과 맞는 키워드"
    risk = risks[0] if risks else "원문 조건 확인"
    actions = next_actions[:3] or ["공고 원문 확인", "경험 근거 보강", "지원 방향 정리"]
    seed = f"{name}|{score}|{good}|{risk}|{recommendation}"
    opener = stable_pick(seed + "match-opener", [
        f"@{name} 님, 이 건은 {score}점 정도예요.",
        f"@{name} 님 기준으로 보면 대략 {score}점 근처로 보여요.",
        f"@{name} 님, 요 건은 {score}점 정도로 보고 있습니다.",
    ])
    body = stable_pick(seed + "match-body", [
        f"보니까 {good} 쪽은 괜찮아요.\n근데 {risk} 부분은 한 번 더 확인하면 좋겠습니다.",
        f"{good} 포인트는 꽤 연결됩니다.\n반대로 {risk} 쪽은 메시지를 조금 더 보강하면 좋아요.",
        f"현재 자료 기준으로는 {good}이 장점이고,\n{risk}은 지원 전에 체크할 부분으로 보여요.",
    ])
    close = stable_pick(seed + "match-close", [
        "요렇게 진행해봅시다 !",
        "이 방향이면 자소서/포폴 문장도 꽤 잡기 쉬울 것 같아요.",
        "먼저 이 세 가지만 보완해보면 좋겠습니다.",
    ])
    return "\n\n".join([
        opener,
        body,
        f"추천 방향은 \"{recommendation}\"으로 잡아보면 좋아 보여요.",
        "보완하면 좋은 것\n\n" + "\n".join(f"{idx}. {item}" for idx, item in enumerate(actions, 1)),
        close,
    ])


def local_match(job, profile=None, profile_analysis=None):
    profile = profile or {}
    result = profile_analysis_result(profile_analysis)
    profile_text = " ".join(collect_text_values(profile) + collect_text_values(result)).lower()
    raw = job.get("raw") or {}
    job_terms = [
        job_title(job),
        job_company(job),
        raw.get("career", ""),
        raw.get("location", ""),
        " ".join(job_keywords(job)),
    ]
    job_text = " ".join(job_terms).lower()
    hits = []
    for token in re.split(r"[,/\s]+", profile_text):
        token = token.strip().lower()
        if len(token) >= 2 and token in job_text and token not in hits:
            hits.append(token)
    score = min(96, 52 + len(hits) * 8)
    risks = []
    if "경력" in clean_text((job.get("raw") or {}).get("career")) and "경력" not in profile_text:
        risks.append("경력 연차/직무 적합성 확인 필요")
    if not hits:
        risks.append("이력서/포트폴리오 키워드가 아직 부족함")
    strengths = hits[:5] or ["프로필 DM에 이력서/포트폴리오를 넣으면 더 정확해집니다."]
    next_actions = ["공고 DM에 자소서 초안을 남기기", "스레드에서 원문 확인", "관심/지원 후보 이모지로 분류"]
    recommendation = f"{job_title(job) or '지원 직무'}에 맞춰 경험 근거를 정리하는 방향"
    name = candidate_display_name(profile, result)
    return {
        "score": score,
        "summary": f"{job_company(job) or '선택한'} 공고는 {', '.join(hits[:4]) or '프로필 보강'} 키워드 기준으로 매칭했습니다.",
        "strengths": strengths,
        "risks": risks or ["큰 리스크는 감지되지 않았습니다."],
        "nextActions": next_actions,
        "comment_text": local_match_comment(name, score, strengths, risks, next_actions, recommendation),
        "recommendation_direction": recommendation,
        "hasProfileAnalysis": profile_has_analysis(profile_analysis),
        "aiMode": "local heuristic",
    }


def call_openai_match(job, profile=None, profile_analysis=None, baseline=None):
    baseline = baseline or local_match(job, profile, profile_analysis)
    result, model = call_openai_structured(
        MATCH_ANALYSIS_PROMPT,
        {
            "candidate_name": candidate_display_name(profile, profile_analysis_result(profile_analysis)),
            "user_profile": compact_profile_for_ai(profile, profile_analysis),
            "job": compact_job_for_ai(job),
            "local_baseline": baseline,
            "slack_messages": job.get("slack_messages") or {},
        },
        "job_profile_match",
        MATCH_ANALYSIS_SCHEMA,
        max_output_tokens=3000,
        timeout=45,
    )
    score = max(0, min(100, int(round(float(result.get("score", baseline.get("score", 0)))))))
    return {
        "score": score,
        "summary": clean_text(result.get("summary")) or baseline.get("summary", ""),
        "strengths": [clean_text(item) for item in (result.get("strengths") or baseline.get("strengths") or [])[:6] if clean_text(item)],
        "risks": [clean_text(item) for item in (result.get("risks") or baseline.get("risks") or [])[:6] if clean_text(item)],
        "nextActions": [clean_text(item) for item in (result.get("nextActions") or baseline.get("nextActions") or [])[:6] if clean_text(item)],
        "comment_text": clean_text(result.get("comment_text")) or baseline.get("comment_text", ""),
        "recommendation_direction": clean_text(result.get("recommendation_direction")) or baseline.get("recommendation_direction", ""),
        "hasProfileAnalysis": profile_has_analysis(profile_analysis),
        "aiMode": "openai",
        "model": model,
    }


def match_job_with_profile(job, profile=None, profile_analysis=None):
    baseline = local_match(job, profile, profile_analysis)
    if not profile_has_analysis(profile_analysis):
        return baseline
    if not openai_api_key():
        baseline["aiMode"] = "local heuristic - OPENAI_API_KEY missing"
        return baseline
    try:
        return call_openai_match(job, profile, profile_analysis, baseline)
    except Exception as exc:
        baseline["aiMode"] = "local heuristic - OpenAI match fallback"
        baseline["error"] = str(exc)
        return baseline


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
    known_roles = [
        "PM", "PO", "iOS", "Swift", "Android", "SW", "AI", "QA", "DevOps",
        "개발자", "소프트웨어", "서버", "백엔드", "프론트엔드", "웹", "앱",
        "데이터", "기획", "디자인", "마케팅", "보안",
    ]
    role_terms = [role for role in known_roles if role.lower() in text.lower()]
    role_term_set = {role.lower() for role in role_terms}
    known_locations = ["서울", "경기", "성남", "판교", "부산", "대전", "대구", "인천", "수도권", "재택", "원격"]
    location_terms = [location for location in known_locations if location in text]
    company_terms = []
    for token in tokens:
        if token.lower() in role_term_set:
            continue
        if token in location_terms:
            continue
        if len(token) >= 2 and token not in ["개발", "직군", "공고", "신입", "경력"]:
            company_terms.append(token)
    query_parts = []
    if company_terms:
        query_parts.append(company_terms[0])
    elif location_terms:
        query_parts.append(location_terms[0])
    query_parts.extend(role_terms[:3])
    if company_terms:
        query_parts.extend(location_terms[:2])
    if not query_parts:
        query_parts = tokens[:4] or ["개발자"]
    return {
        "query": " ".join(query_parts),
        "company": company_terms[0] if company_terms else "",
        "role": " ".join(role_terms),
        "location": " ".join(location_terms),
        "seniority": "경력" if "경력" in text else "신입" if "신입" in text else "",
        "keywords": query_parts,
        "reason": "로컬 파서가 회사명/직무 키워드를 추출했습니다.",
    }


def local_recruiter_search(message):
    intent = local_search_intent(message)
    query = intent.get("query") or "개발자"
    crawl_url = f"https://www.jobkorea.co.kr/Search/?stext={urllib.parse.quote(query)}"
    jobs = search_jobkorea(query, limit=10)
    top_detail = None
    if jobs:
        try:
            parsed = parse_posting_url(jobs[0]["source_url"])
            top_detail = {
                "title": job_title(parsed),
                "period": (parsed.get("raw") or {}).get("period"),
                "keywords": job_keywords(parsed),
                "details": ((parsed.get("job_profile") or {}).get("responsibilities") or [])[:3],
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
    state = default_state()
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "5174"))
    return {
        "project": {
            "name": "JobKorea Vibe Slack Dashboard",
            "version": "vercel-ready prototype",
            "servedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
            "entry": "/",
            "dashboard": "/dashboard.html",
        },
        "runtime": {
            "host": host,
            "port": port,
            "dataPath": "browser localStorage: slezzuk_local_state_v1",
            "roleCatalogPath": ROLE_CATALOG_PATH,
            "deployment": "vercel" if os.environ.get("VERCEL") else "local",
            "externalShare": "Vercel production URL" if os.environ.get("VERCEL") else f"ngrok http {port}",
            "aiProvider": "OpenAI Responses API for PDF profile analysis, job Slack message generation, and profile-job matching comments",
        },
        "features": [
            {"name": "JobKorea 공고 수집", "status": "implemented", "detail": "JobKorea Search HTML 내 Next.js hydration JSON에서 채용공고 content 배열 추출"},
            {"name": "공고 Slack 메시지 변환", "status": "implemented", "detail": "JobKorea 공고 JSON을 OpenAI Responses API로 message_body/thread_comment 형식에 맞게 변환하고, API 키가 없으면 로컬 fallback 문장을 생성"},
            {"name": "동적 채널 관리", "status": "implemented", "detail": "직군 카탈로그를 카드 형태로 보여주고 선택한 채널 표시 상태를 브라우저 localStorage에 저장"},
            {"name": "이모지 공고 분류", "status": "implemented", "detail": "👀 관심 있음, ⭐ 지원 후보, 💰 연봉 좋음. 저장한 공고는 나중에 보기에서 태그별로 확인"},
            {"name": "웹 공고 URL 파싱", "status": "implemented", "detail": "URL fetch 후 title, 기간, 경력, 지역, 키워드, 상세 문단 추론. 저장은 브라우저 localStorage"},
            {"name": "공고별 DM 노트", "status": "implemented", "detail": "공고 DM/스레드 reply로 자소서 초안 및 메모를 브라우저 localStorage에 저장"},
            {"name": "PDF 이력서/포트폴리오 분석", "status": "implemented", "detail": "Resume & Portfolio DM에서 PDF만 업로드하고 OpenAI Responses API로 구조화 JSON을 생성한 뒤 브라우저 localStorage에 저장"},
            {"name": "AI 매칭 패널", "status": "implemented", "detail": "PDF 분석 JSON이 있으면 OpenAI Responses API로 Slack 코멘트형 매칭 분석을 생성하고, 없으면 로컬 키워드 매칭으로 fallback"},
            {"name": "자연어 검색 DM", "status": "implemented", "detail": "문장에서 핵심 키워드 추출 후 JobKorea 검색"},
            {"name": "검색 봇 DM", "status": "implemented", "detail": "로컬 intent 파서 + JobKorea 크롤링 trace 표시"},
            {"name": "Vercel 배포", "status": "implemented", "detail": "public 정적 파일과 api/index.py Python 함수로 배포"},
            {"name": "ngrok 외부 공유", "status": "implemented", "detail": "scripts/start_ngrok.sh로 로컬 public URL 생성"},
        ],
        "apis": [
            {"method": "GET", "path": "/api/channels", "description": "직군 카탈로그 조회"},
            {"method": "GET", "path": "/api/jobs?channel=pm", "description": "채널별 JobKorea 공고 검색 후 Slack 메시지 변환"},
            {"method": "GET", "path": "/api/search?q=NC", "description": "자연어/키워드 기반 JobKorea 검색 후 Slack 메시지 변환"},
            {"method": "GET", "path": "/api/parse?url=...", "description": "채용공고 URL 직접 파싱 후 Slack 메시지 변환"},
            {"method": "GET", "path": "/api/state", "description": "레거시 호환 기본 상태 반환"},
            {"method": "GET", "path": "/api/docs", "description": "문서 대시보드용 메타데이터"},
            {"method": "POST", "path": "/api/classify", "description": "레거시 호환. 실제 저장은 브라우저 localStorage"},
            {"method": "POST", "path": "/api/note", "description": "레거시 호환. 실제 저장은 브라우저 localStorage"},
            {"method": "POST", "path": "/api/profile", "description": "레거시 호환. 실제 저장은 브라우저 localStorage"},
            {"method": "POST", "path": "/api/profile/analyze-pdf", "description": "PDF 업로드 후 ChatGPT API 분석 JSON 반환"},
            {"method": "POST", "path": "/api/match", "description": "브라우저가 보낸 프로필/PDF 분석 JSON과 공고의 AI 또는 fallback 매칭 결과 생성"},
            {"method": "POST", "path": "/api/channels", "description": "레거시 호환. 실제 저장은 브라우저 localStorage"},
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
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR if os.path.isdir(PUBLIC_DIR) else ROOT, **kwargs)

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
                return self.json(channel_payload(default_state()))
            if parsed.path == "/api/jobs":
                channel = params.get("channel", ["pm"])[0]
                limit = clamp_int(params.get("limit", [10])[0], 10, 1, 20)
                channel_info = find_channel(channel, default_state()) or normalize_channel({"id": channel, "name": channel, "query": channel})
                query = channel_info.get("query") or channel
                try:
                    jobs = search_jobkorea(query, limit=limit)
                except Exception:
                    jobs = fallback_jobs_for(channel_info)[:limit]
                return self.json({"jobs": jobs, "query": query, "channel": channel_info})
            if parsed.path == "/api/search":
                query = params.get("q", [""])[0].strip()
                limit = clamp_int(params.get("limit", [10])[0], 10, 1, 20)
                jobs = search_jobkorea(query or "개발자", limit=limit) if query else []
                return self.json({"jobs": jobs, "query": query})
            if parsed.path == "/api/parse":
                url = params.get("url", [""])[0]
                if not url:
                    return self.json({"error": "url is required"}, 400)
                job = parse_posting_url(url)
                return self.json({"job": job})
            if parsed.path == "/api/state":
                return self.json(default_state())
            if parsed.path == "/api/docs":
                return self.json(build_docs_payload())
            return self.json({"error": "not found"}, 404)
        except ValueError as exc:
            return self.json({"error": str(exc)}, 400)
        except Exception as exc:
            return self.json({"error": str(exc)}, 500)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            return super().do_POST()
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > MAX_UPLOAD_BYTES + 2048:
                return self.json({"error": "request body is too large"}, 413)
            raw_body = self.rfile.read(length)
            if parsed.path == "/api/profile/analyze-pdf":
                payload, status = analyze_profile_pdf_upload(self.headers, raw_body)
                return self.json(payload, status)
            body = raw_body.decode("utf-8")
            payload = json.loads(body or "{}")
            if parsed.path == "/api/classify":
                return self.json({"ok": True, "localOnly": True})
            if parsed.path == "/api/note":
                note = {
                    "text": payload.get("text", ""),
                    "createdAt": time.strftime("%Y-%m-%d %H:%M:%S"),
                }
                return self.json({"ok": True, "localOnly": True, "notes": [note]})
            if parsed.path == "/api/profile":
                return self.json({"ok": True, "localOnly": True, "profile": payload.get("profile", {})})
            if parsed.path == "/api/match":
                job = payload.get("job", {})
                result = match_job_with_profile(
                    job,
                    payload.get("profile") or {},
                    payload.get("profileAnalysis") or {},
                )
                return self.json({"match": result})
            if parsed.path == "/api/channels":
                return self.json({"ok": True, "localOnly": True, **channel_payload(default_state())})
            if parsed.path == "/api/ai-search":
                message = payload.get("message", "").strip()
                if not message:
                    return self.json({"error": "message is required"}, 400)
                return self.json(local_recruiter_search(message))
            return self.json({"error": "not found"}, 404)
        except ValueError as exc:
            return self.json({"error": str(exc)}, 400)
        except Exception as exc:
            return self.json({"error": str(exc)}, 500)

    def json(self, payload, status=200):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


handler = Handler


if __name__ == "__main__":
    ensure_state()
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "5174"))
    print(f"Serving JobKorea Vibe on http://{host}:{port}", flush=True)
    print(f"Share with ngrok: ngrok http {port}", flush=True)
    ThreadingHTTPServer((host, port), Handler).serve_forever()
