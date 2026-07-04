# JobKorea Vibe

JobKorea Vibe는 JobKorea 채용공고를 Slack 워크스페이스처럼 탐색하고, 관심 공고를 분류하고, 공고별 DM 메모와 이력서/포트폴리오 PDF 분석 결과를 바탕으로 AI/fallback 매칭까지 확인하는 해커톤 프로토타입입니다.

최종 코드 분석 기준: 2026-07-04

## 현재 구현 요약

- Slack형 단일 페이지 UI: 채널, DM, 스레드, Later 보기, 검색 모달을 정적 HTML/CSS/JS로 구현했습니다.
- JobKorea 채용공고 수집: 채널별 검색어로 JobKorea Search 페이지를 요청하고 Next.js hydration JSON에서 공고 배열을 추출합니다.
- 공고 Slack 메시지 변환: 공고 JSON을 OpenAI Responses API에 보내 `message_body`, `thread_comment`, `key_points`를 생성하고, API 키가 없거나 실패하면 같은 형식의 로컬 fallback 문장을 만듭니다.
- 18개 직군 카탈로그: 최초 진입에는 PM/PO 채널만 노출하고, 채널 관리에서 기획, 마케팅, 서버/백엔드, 프론트엔드, iOS, Android, 데이터/AI 등 직군 채널을 추가합니다.
- 브라우저 중심 개인화: 공고 분류, 노트, PDF 분석 결과, 활성 채널, 사용자 추가 채널, 직접 파싱 공고는 서버 DB가 아니라 브라우저 `localStorage`에 저장합니다.
- 공고별 워크플로우: 공고 카드에서 원문 열기, DM 메모, Thread 매칭, 관심/지원 후보/연봉 좋음 분류를 실행합니다.
- URL 가져오기 기능: 채용공고 URL을 붙여넣으면 서버가 페이지를 fetch하고 제목, 기간, 경력, 지역, 키워드, 상세 문단을 추론합니다.
- 자연어 Search DM: 사용자의 문장을 JobKorea 검색어로 바꾸고, 검색 결과를 Slack 메시지형 카드로 보여줍니다.
- Resume & Portfolio DM: PDF만 업로드할 수 있고, `pypdf` 텍스트 추출과 필요 시 Poppler/Tesseract OCR을 거친 뒤 OpenAI Responses API로 구조화 JSON을 생성합니다.
- AI 매칭 Thread: PDF 분석 JSON이 있으면 OpenAI Responses API로 Slack 코멘트형 매칭 분석을 만들고, 없으면 프로필/공고 키워드 기반 로컬 매칭을 계산합니다.
- 구현 대시보드: `/dashboard.html`에서 서버가 제공하는 기능/API/런타임 메타데이터를 확인할 수 있습니다.
- 배포 준비: 로컬 Python 서버, Vercel Python Function, Docker 실행, ngrok 공유 스크립트를 포함합니다.

## 빠른 실행

```bash
./scripts/start_server.sh
```

기본 주소는 아래와 같습니다.

```text
http://127.0.0.1:5174
```

포트를 바꿔 실행하려면 `PORT`를 지정합니다.

```bash
PORT=5175 ./scripts/start_server.sh
```

`scripts/start_server.sh`는 `.venv`를 만들고 `requirements.txt`를 설치한 뒤 `server.py`를 실행합니다. 현재 Python dependency는 `pypdf` 하나이며, OCR은 시스템 바이너리인 `pdftoppm`과 `tesseract`가 있을 때 동작합니다.

## 화면 구성

### Channels

왼쪽 채널 목록은 직군 카탈로그와 브라우저 저장 상태를 합쳐 구성합니다. 기본 활성 채널은 `pm`, `ios`, `server`, `frontend`, `data`입니다.

채널 피드는 JobKorea 검색 결과를 Slack 메시지 카드로 보여줍니다. 각 공고는 정규화된 `raw`, `job_profile`, `slack_messages` 구조를 갖습니다. `slack_messages`에는 채널 본문용 `message_title`, `message_body`와 스레드용 `thread_comment`, `key_points`, 생성 모드 메타데이터가 포함됩니다.

### Direct Messages

- `Search`: 자연어 문장을 JobKorea 검색어로 해석하고 결과와 trace를 보여줍니다.
- `Resume & Portfolio`: PDF 업로드, 추출 텍스트, OpenAI 변환 JSON, 프로필 반영 결과를 보여줍니다.
- 공고별 DM: 공고 카드와 사용자가 남긴 개인 메모를 시간순으로 보여줍니다.

### Thread

공고 Thread는 선택한 공고 원문, URL 파싱 결과, OpenAI 또는 fallback으로 만든 스레드 코멘트, `/api/match` 매칭 결과를 보여줍니다. Thread reply에 입력한 내용은 해당 공고 노트로 저장됩니다.

### Later

공고 카드의 분류 버튼으로 저장한 공고를 관심 있음, 지원 후보, 연봉 좋음 그룹으로 모아봅니다. 분류된 공고의 축약 정보는 `savedJobs`로 브라우저에 함께 저장됩니다.

## 데이터 저장 정책

개인 데이터는 서버 파일이나 DB에 저장하지 않습니다. 배포 URL을 여러 사람이 같이 쓰더라도 각자의 브라우저 저장소에만 남습니다.

```text
localStorage key: slezzuk_local_state_v1
```

저장되는 값은 다음과 같습니다.

- 공고 이모지 분류와 Later 저장 공고
- 공고별 노트
- Resume & Portfolio 프로필과 PDF 분석 결과
- 직접 URL 파싱으로 추가한 공고
- 활성 채널 목록
- 사용자 추가 채널

`data/state.json`은 레거시/로컬 개발용 기본 상태 파일입니다. Vercel 배포에서는 `api/index.py`가 `STATE_DIR`를 `/tmp/jobkorea-vibe-state`로 지정하지만, 현재 실제 개인화 저장은 프론트엔드 `localStorage`가 담당합니다. 브라우저 저장소를 지우거나 다른 기기/브라우저에서 접속하면 개인 상태는 이어지지 않습니다.

## OpenAI 분석

OpenAI API 키는 세 곳에서 사용합니다. 키가 없으면 PDF는 텍스트 추출까지만 진행하고, 공고 메시지와 매칭 코멘트는 같은 JSON 형식의 로컬 fallback으로 채웁니다.

```bash
OPENAI_API_KEY=... ./scripts/start_server.sh
```

지원 환경 변수:

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `OPENAI_API_KEY` | 없음 | OpenAI Responses API 호출용 키 |
| `CHATGPT_API_KEY` | 없음 | `OPENAI_API_KEY`가 없을 때 사용하는 대체 키 |
| `OPENAI_MODEL` | `gpt-4o-mini` | PDF 프로필 JSON 변환, 공고 Slack 메시지 변환, 매칭 코멘트 생성 모델 |
| `OPENAI_JOB_MESSAGE_LIMIT` | `10` | 공고 리스트 응답 1회에서 OpenAI로 변환할 최대 공고 수. 초과분은 로컬 fallback |
| `OCR_MAX_PAGES` | `20` | OCR 대상 최대 페이지 수 |
| `OCR_DPI` | `160` | PDF를 이미지로 변환할 때 DPI |
| `TESSERACT_LANGS` | `kor+eng` | Tesseract OCR 언어 |
| `TESSERACT_PSM` | `6` | Tesseract page segmentation mode |
| `PDFTOPPM_BIN` | 자동 탐색 | `pdftoppm` 실행 파일 경로 override |
| `TESSERACT_BIN` | 자동 탐색 | `tesseract` 실행 파일 경로 override |
| `HOST` | `127.0.0.1` | 로컬 서버 bind host |
| `PORT` | `5174` | 로컬 서버 port |
| `STATE_DIR` | `data` | 레거시 상태 파일 디렉터리 |
| `STATE_PATH` | `STATE_DIR/state.json` | 레거시 상태 파일 경로 |

PDF 처리 순서:

1. `.pdf` 확장자, PDF MIME, `%PDF-` 헤더를 검증합니다.
2. 업로드 크기는 최대 40MB입니다.
3. `pypdf`로 텍스트 레이어를 먼저 추출합니다.
4. 텍스트가 부족하면 `pdftoppm`과 `tesseract` OCR을 시도합니다.
5. OCR도 실패하면 PDF 내부 문자열 추출 fallback을 사용합니다.
6. 추출 텍스트가 있으면 OpenAI Responses API에 JSON schema 기반 분석을 요청합니다.
7. 분석 성공 시 `candidate_profile`, `matching_profile`, `ai_analysis_result`를 포함한 `resume_portfolio_profile.v1` 구조로 저장합니다.

공고 처리 순서:

1. JobKorea 검색 또는 URL 파싱으로 공고 JSON을 만듭니다.
2. OpenAI Responses API가 Slack 채널 본문과 스레드 코멘트를 생성합니다.
3. 생성 결과는 각 공고의 `slack_messages`에 저장되어 브라우저 `localStorage`에도 함께 남습니다.
4. OpenAI 호출 실패 또는 키 미설정 시 같은 필드를 로컬 fallback 문장으로 채웁니다.

일반 Vercel Python Runtime에는 Poppler/Tesseract 시스템 바이너리가 없을 수 있습니다. 이미지 기반 PDF까지 안정적으로 처리하려면 Docker 런타임처럼 OCR 바이너리가 설치된 환경을 권장합니다.

## API

`server.py`의 `Handler`는 로컬 HTTP 서버와 Vercel Function에서 같은 로직을 사용합니다.

| Method | Path | 설명 |
| --- | --- | --- |
| `GET` | `/api/channels` | 직군 카탈로그, 활성 채널, 사용자 채널 기본 payload 조회 |
| `GET` | `/api/jobs?channel=pm` | 채널 query 기준 JobKorea 공고 검색 후 `slack_messages` 변환. 실패 시 fallback 공고 반환 |
| `GET` | `/api/search?q=NC` | 키워드 기반 JobKorea 공고 검색 후 `slack_messages` 변환 |
| `GET` | `/api/parse?url=...` | 채용공고 URL 직접 파싱 후 `slack_messages` 변환 |
| `GET` | `/api/state` | 레거시 호환 기본 상태 반환 |
| `GET` | `/api/docs` | 구현 대시보드용 프로젝트/기능/API/런타임 메타데이터 |
| `POST` | `/api/classify` | 레거시 호환 응답. 실제 저장은 브라우저 담당 |
| `POST` | `/api/note` | 레거시 호환 응답. 실제 저장은 브라우저 담당 |
| `POST` | `/api/profile` | 레거시 호환 응답. 실제 저장은 브라우저 담당 |
| `POST` | `/api/profile/analyze-pdf` | PDF 업로드, 텍스트 추출, OpenAI 분석 JSON 반환 |
| `POST` | `/api/match` | 브라우저가 보낸 프로필/PDF 분석 JSON과 공고의 AI 또는 fallback 매칭 결과 반환 |
| `POST` | `/api/channels` | 레거시 호환 응답. 실제 채널 변경 저장은 브라우저 담당 |
| `POST` | `/api/ai-search` | 자연어 입력을 로컬 검색 의도로 해석하고 JobKorea 크롤링 결과 반환 |

## 아키텍처

```text
Browser SPA
  ├─ public/index.html
  ├─ public/styles.css
  └─ public/app.js
       │
       ├─ localStorage: slezzuk_local_state_v1
       │
       └─ /api/*
            │
            ├─ Local: server.py ThreadingHTTPServer
            └─ Vercel: api/index.py -> server.Handler
                    │
                    ├─ JobKorea Search/Posting fetch
                    ├─ URL parser
                    ├─ PDF text/OCR extraction
                    ├─ OpenAI Responses API
                    └─ local fallback matching/message generation
```

로컬 서버는 `PUBLIC_DIR`인 `public/`을 정적 루트로 서빙합니다. Vercel에서는 `public/` 안 파일이 URL 루트로 배포되므로, 루트의 `index.html`과 `dashboard.html`은 Vercel 진입용 정적 파일로 유지됩니다.

## 프로젝트 구조

```text
.
├── api/
│   └── index.py                         # Vercel Python Function 엔트리포인트
├── data/
│   ├── job_roles.json                   # 18개 직군 채널 카탈로그
│   └── state.json                       # 레거시/로컬 개발용 기본 상태
├── docs/
│   ├── PRD_Slezzuk.md
│   ├── SPEC_Slezzuk.md
│   ├── GUIDE_Slezzuk_API_Deploy_Privacy.md
│   ├── VERCEL_HANDOFF.md
│   └── simple/
├── public/
│   ├── index.html                       # 로컬 서버 메인 Slack UI
│   ├── app.js                           # SPA 상태, 렌더링, 이벤트, localStorage
│   ├── styles.css                       # Slack 스타일 UI
│   ├── dashboard.html                   # 로컬 구현 대시보드
│   ├── dashboard.js
│   └── dashboard.css
├── scripts/
│   ├── python_env.sh                    # .venv 생성 및 requirements 설치
│   ├── start_server.sh                  # 로컬 서버 실행
│   └── start_ngrok.sh                   # 로컬 서버 + ngrok 공유
├── AGENTS.md                            # 프로젝트 작업 규칙
├── Dockerfile                           # Poppler/Tesseract 포함 컨테이너 실행
├── dashboard.html                       # Vercel 대시보드 진입 파일
├── index.html                           # Vercel 루트 진입 파일
├── requirements.txt
├── server.py                            # API, JobKorea 파서, PDF 분석, 로컬 서버
└── vercel.json                          # /api/* rewrite와 Function 설정
```

## Vercel 배포

이 저장소는 GitHub `main` 브랜치 push를 통해 Vercel 자동 배포가 갱신되는 구조입니다.

Vercel Import 설정:

1. GitHub 저장소를 Import합니다.
2. Framework Preset은 `Other`로 둡니다.
3. Build Command는 비워둡니다.
4. Output Directory도 비워둡니다.
5. PDF AI 분석을 사용할 경우 Environment Variables에 `OPENAI_API_KEY`를 추가합니다.
6. Deploy를 실행합니다.

배포 구조:

- 정적 UI: 루트 `index.html`, `dashboard.html`, `public/` assets
- API: `api/index.py`가 `server.Handler`를 Vercel Python Function으로 노출
- 라우팅: `vercel.json`이 `/api/*`를 `/api/index.py`로 rewrite
- Function 제한: `maxDuration` 60초

현재 인수인계 문서에 기록된 운영 URL:

```text
https://0704-job-korea-vibeathon.vercel.app/
https://0704-job-korea-vibeathon.vercel.app/dashboard.html
https://0704-job-korea-vibeathon.vercel.app/api/channels
```

## ngrok 공유

로컬 서버를 임시 public URL로 공유해야 할 때는 ngrok을 사용합니다.

```bash
./scripts/start_ngrok.sh
```

처음 사용하는 경우:

```bash
ngrok config add-authtoken <your-token>
```

ngrok URL을 받은 사람은 로컬 서버에 접근할 수 있으므로 공유 범위를 관리해야 합니다.

## Docker 실행

Docker 이미지는 Poppler/Tesseract를 함께 설치하므로 이미지 기반 PDF OCR 검증에 적합합니다.

```bash
docker build -t jobkorea-vibe .
docker run --rm -p 8080:8080 -e OPENAI_API_KEY=... jobkorea-vibe
```

Docker 기본값:

- `HOST=0.0.0.0`
- `PORT=8080`
- `OCR_MAX_PAGES=20`
- `OCR_DPI=160`
- `TESSERACT_LANGS=kor+eng`

## 개발/검증 루틴

프로젝트 작업 규칙은 `AGENTS.md`에 있습니다. 구현 또는 파일 변경 작업은 검증 후 git commit으로 마무리하고, 커밋 후 `git push origin main`까지 진행합니다.

기본 검증:

```bash
git diff --check
.venv/bin/python -m py_compile server.py api/index.py
```

프론트엔드 JavaScript를 수정했다면 Node.js가 있는 환경에서 문법 검사를 추가합니다.

```bash
node --check public/app.js
node --check public/dashboard.js
```

로컬 API 확인:

```bash
./scripts/start_server.sh
curl http://127.0.0.1:5174/api/channels
curl http://127.0.0.1:5174/api/docs
```

## 현재 한계와 주의사항

- JobKorea HTML 또는 hydration JSON 구조가 바뀌면 `extract_job_content`와 `normalize_job` 수정이 필요합니다.
- 크롤링은 대상 사이트 정책과 요청 빈도 제한을 고려해야 합니다.
- 서버에는 사용자 인증, 계정, 권한 관리가 없습니다.
- 개인 상태는 브라우저 저장소 기반이라 기기/브라우저 간 자동 동기화가 없습니다.
- OpenAI API 키가 없으면 PDF 텍스트 추출까지만 진행되고, 공고 메시지/매칭 코멘트는 로컬 fallback으로 생성됩니다.
- 이미지 기반 PDF OCR은 `pdftoppm`과 `tesseract`가 설치된 환경에서만 안정적으로 동작합니다.
- `/api/classify`, `/api/note`, `/api/profile`, `/api/channels` POST는 현재 레거시 호환 응답이며 실제 저장은 프론트엔드가 담당합니다.
- URL 직접 파싱은 외부 페이지를 서버가 가져오는 구조이므로 실제 서비스화 전에는 SSRF 방어, 허용 도메인, timeout, rate limit을 더 엄격하게 설계해야 합니다.
