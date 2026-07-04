# 슬쩍 구현 SPEC

- 기준 폴더: `main_project/`
- 서버: Python 표준 라이브러리 HTTP server
- 프론트엔드: 정적 HTML/CSS/JS 단일 페이지 앱
- 외부 배포: Vercel Python Runtime
- 로컬 임시 공유: ngrok public URL
- AI/GPT/Codex: Resume & Portfolio PDF 분석에서 OpenAI Responses API 선택 사용

## 1. 실행 스펙

로컬 확인:

```bash
cd main_project
./scripts/start_server.sh
```

브라우저:

```text
http://127.0.0.1:5174
```

Vercel 배포:

```bash
vercel dev
vercel deploy
```

로컬 임시 공유, ngrok:

```bash
./scripts/start_ngrok.sh
```

ngrok이 출력하는 `Forwarding` URL도 사용할 수 있다.

## 2. 주요 파일

- `public/index.html`: Slack 스타일 메인 UI
- `public/styles.css`: Slack 스타일 레이아웃과 채널 관리 모달 스타일
- `public/app.js`: 채널, DM, 스레드, 검색, 메모, 프로필, Slack 메시지, AI/로컬 매칭 렌더링
- `server.py`: API 서버, JobKorea 크롤링, URL 파싱, PDF 분석, 매칭 계산
- `api/index.py`: Vercel Serverless Function 엔트리포인트
- `vercel.json`: `/api/*` 요청을 Python 함수로 라우팅
- `data/job_roles.json`: 로컬 직군 채널 카탈로그
- 브라우저 `localStorage`: 채널 표시 상태, 사용자 채널, 메모, 분류, 프로필 저장
- `scripts/start_server.sh`: 로컬 서버 실행
- `scripts/start_ngrok.sh`: 로컬 서버 실행 후 ngrok 터널 실행

## 3. 구현 기능

1. Slack 스타일 채널/DM/스레드 UI
2. JobKorea 검색 결과 크롤링
3. 로컬 직군 카탈로그 기반 채널 표시/숨김
4. 사용자 정의 채널 추가/삭제
5. 채용공고 URL direct parsing
6. 이모지 기반 공고 분류
7. 공고별 DM 메모 저장
8. Resume & Portfolio 텍스트 저장
9. 자연어 검색 DM
10. 검색 봇 DM의 로컬 intent trace
11. 프로필/공고 기반 AI 매칭 코멘트와 로컬 fallback 매칭
12. Vercel 배포와 ngrok 로컬 임시 공유
13. 채널 공고 셀에서 `JSON_1 공고 정보` 원문 표시

## 4. 채널 스펙

프론트는 서버에서 받은 `data/job_roles.json` 직군 카탈로그와 브라우저 `localStorage`의 `enabledChannelIds`, `customChannels`를 합쳐 활성 채널을 만든다.

기본 활성 채널:

- `pm`
- `ios`
- `server`
- `frontend`
- `data`
- `direct`

`direct`는 시스템 채널이며, JobKorea 또는 외부 채용공고 URL을 붙여넣어 파싱하는 용도다.

## 5. API 스펙

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/channels` | 직군 카탈로그 조회 |
| POST | `/api/channels` | 레거시 호환. 실제 채널 설정 저장은 브라우저 localStorage |
| GET | `/api/jobs?channel=pm` | 채널 검색어로 JobKorea 공고 조회 후 Slack 메시지 변환 |
| GET | `/api/search?q=...` | 키워드 기반 JobKorea 검색 |
| GET | `/api/parse?url=...` | 채용공고 URL 파싱 결과 반환. direct 채널 저장은 브라우저 localStorage |
| GET | `/api/state` | 레거시 호환 기본 상태 반환 |
| GET | `/api/docs` | 대시보드 메타데이터 조회 |
| POST | `/api/classify` | 레거시 호환. 실제 이모지 저장은 브라우저 localStorage |
| POST | `/api/note` | 레거시 호환. 실제 메모 저장은 브라우저 localStorage |
| POST | `/api/profile` | 레거시 호환. 실제 프로필 저장은 브라우저 localStorage |
| POST | `/api/profile/analyze-pdf` | PDF 업로드 후 OpenAI Responses API 분석 결과 반환 |
| POST | `/api/match` | 브라우저가 보낸 프로필/PDF 분석 JSON과 공고의 AI 또는 로컬 매칭 계산 |
| POST | `/api/ai-search` | 기존 프론트 호환용 이름. 실제 동작은 로컬 검색 봇 |

## 6. 데이터 스펙

공고 리스트 응답의 각 공고는 개발 단계에서 아래 구조를 그대로 화면에 표시한다.

```json
{
  "id": "jobkorea_49435790",
  "source": "jobkorea",
  "source_url": "https://www.jobkorea.co.kr/Recruit/GI_Read/49435790",
  "raw": {
    "title": "원본 공고 제목",
    "company_name": "원본 회사명",
    "career": "신입",
    "location": "서울",
    "salary": "회사 내규에 따름",
    "period": "2026.06.24 ~ 2026.07.13",
    "raw_text": "크롤링한 원문 텍스트"
  },
  "job_profile": {
    "company_name": "현대오토에버㈜",
    "job_title": "2026년 3분기 신입사원 모집",
    "responsibilities": [],
    "required_skills": [],
    "preferred_skills": [],
    "cover_letter_questions": [],
    "deadline": "2026-07-13T13:00:00+09:00"
  },
  "slack_messages": {
    "message_title": "현대오토에버㈜ 2026년 3분기 신입사원 모집 공유해요",
    "message_body": "Slack 채널 본문용 공유 메시지",
    "thread_comment": "스레드 첫 코멘트용 상세 요약",
    "thread_summary": "짧은 스레드 요약",
    "key_points": ["역할 성격: 서비스기획", "경험 기준: 신입"],
    "ai_mode": "openai",
    "model": "gpt-4o-mini",
    "generated_at": "2026-07-04T14:00:00+09:00",
    "error": ""
  }
}
```

`slack_messages`는 OpenAI Responses API로 생성한다. API 키가 없거나 호출이 실패하면 동일 필드를 로컬 fallback 문장으로 채운다.

브라우저 `localStorage`:

배포 앱의 개인 상태는 서버 파일이 아니라 브라우저 `localStorage`의 `slezzuk_local_state_v1` 키에 저장한다. 서버는 JobKorea 검색, URL 파싱, PDF 분석, 매칭 계산만 수행하고 개인 상태를 영구 저장하지 않는다.

```json
{
  "version": 1,
  "notes": {},
  "classifications": {},
  "profile": {
    "resume": "",
    "portfolio": "",
    "skills": "",
    "preferences": ""
  },
  "directParsedJobs": [],
  "enabledChannelIds": ["pm", "ios", "server", "frontend", "data"],
  "customChannels": [],
  "tone": "business"
}
```

## 7. 비사용 항목

현재 MVP에서는 아래를 사용하지 않는다.

- 로컬 Codex CLI 호출
- 같은 Wi-Fi 또는 로컬 IP 기반 팀 접속 전제

## 8. 추후 구현 필요 항목

- 영구 저장이 필요할 경우 Vercel KV/Postgres/Supabase 같은 외부 저장소 연동

## 9. 검증 기준

1. `python3 -m py_compile server.py`가 통과한다.
2. `app.js`, `dashboard.js`의 JS 문법 검사가 통과한다.
3. `/api/channels`가 활성 채널과 직군 카탈로그를 반환한다.
4. `/api/jobs?channel=pm`이 JobKorea 검색 결과 또는 fallback을 반환한다.
5. `/api/jobs?channel=pm`의 각 공고에 채워진 `slack_messages`가 포함된다.
6. 채널 화면에서 Slack 메시지와 공고 JSON이 함께 표시된다.
7. 채널 관리 모달에서 직군 채널을 표시/숨김할 수 있다.
8. 사용자 채널을 추가/삭제할 수 있다.
9. `vercel.json`이 `/api/*` 요청을 `api/index.py`로 라우팅한다.
10. ngrok 설치 환경에서 `./scripts/start_ngrok.sh`도 public URL을 출력한다.
