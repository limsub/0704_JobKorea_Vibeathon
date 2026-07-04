# JobKorea Vibe

Slack 스타일 UI에서 JobKorea 채용공고를 직군 채널별로 모아보고, 공고 분류, DM 메모, 자연어 검색, PDF 이력서/포트폴리오 분석, 로컬 매칭까지 한 화면에서 처리하는 해커톤 웹앱입니다.

현재 코드는 별도 프론트엔드 빌드 과정 없이 정적 HTML/CSS/JS와 Python 표준 라이브러리 서버로 동작합니다. 개인 상태는 서버 DB가 아니라 브라우저 `localStorage`에 저장됩니다.

## 주요 기능

- JobKorea 검색 결과 수집: 직군 채널별 query로 JobKorea Search 페이지를 요청하고, HTML 안의 Next.js hydration JSON에서 공고 배열을 추출합니다.
- Slack형 채널 피드: PM/PO, 서버/백엔드, 프론트엔드, iOS, 데이터/AI 등 `data/job_roles.json` 기반 직군 채널을 렌더링합니다.
- 채널 관리: 기본 카탈로그 직군을 카드 형태로 살펴보고, 표시할 채널을 브라우저에 저장합니다.
- 공고 원문 JSON 표시: 공고 카드는 정규화된 `job_profile`, `raw`, `slack_messages` 구조를 그대로 보여줍니다.
- 이모지 분류: 관심 있음, 지원 후보, 연봉 좋음 상태를 공고별로 기록하고 나중에 보기에서 모아봅니다.
- 공고별 DM: 회사/공고 담당자 DM처럼 공고 카드와 개인 메모, 자소서 초안, 면접 메모를 저장합니다.
- direct-parsing 채널: 채용공고 URL을 붙여넣으면 서버가 URL을 fetch해서 제목, 기간, 경력, 지역, 상세 문단을 추론합니다.
- Search DM: 자연어 문장을 로컬 intent parser로 검색어로 바꾸고 JobKorea 결과와 crawler trace를 답장처럼 표시합니다.
- Resume & Portfolio DM: PDF 파일만 업로드하고, 텍스트 추출 후 OpenAI Responses API로 구조화된 프로필 JSON을 생성합니다.
- 로컬 매칭 Thread: 브라우저가 보낸 프로필과 공고 키워드를 비교해 점수, 강점, 리스크, 다음 행동을 표시합니다.
- 구현 대시보드: `/dashboard.html`에서 서버가 제공하는 기능/API/런타임 메타데이터를 확인합니다.
- 스크롤 UX: 채널은 메시지를 하단 기준으로 보여주고 최초 위치를 가장 아래로 둡니다. DM은 시간순 위에서 아래로 보여주고 최초 위치를 가장 위로 둡니다.

## 빠른 실행

```bash
./scripts/start_server.sh
```

기본 로컬 주소:

```text
http://127.0.0.1:5174
```

포트를 바꾸려면:

```bash
PORT=5175 ./scripts/start_server.sh
```

`scripts/start_server.sh`는 `.venv`를 만들고 `requirements.txt`를 설치한 뒤 `server.py`를 실행합니다.

## OpenAI PDF 분석

Resume & Portfolio DM의 AI 분석을 사용하려면 서버 실행 전에 API 키를 설정합니다.

```bash
OPENAI_API_KEY=... ./scripts/start_server.sh
```

지원 환경 변수:

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `OPENAI_API_KEY` | 없음 | OpenAI Responses API 호출용 키 |
| `CHATGPT_API_KEY` | 없음 | `OPENAI_API_KEY`가 없을 때 사용하는 대체 키 |
| `OPENAI_MODEL` | `gpt-4o-mini` | PDF 프로필 JSON 변환 모델 |
| `OCR_MAX_PAGES` | `20` | OCR 대상 최대 페이지 수 |
| `OCR_DPI` | `160` | PDF를 이미지로 변환할 때 DPI |
| `TESSERACT_LANGS` | `kor+eng` | Tesseract OCR 언어 |
| `TESSERACT_PSM` | `6` | Tesseract page segmentation mode |
| `PDFTOPPM_BIN` | 자동 탐색 | `pdftoppm` 실행 파일 경로 override |
| `TESSERACT_BIN` | 자동 탐색 | `tesseract` 실행 파일 경로 override |

PDF 처리 순서:

1. 업로드는 `.pdf` 파일만 허용합니다.
2. 최대 크기는 40MB입니다.
3. 먼저 `pypdf`로 텍스트 레이어를 추출합니다.
4. 텍스트가 부족하면 `pdftoppm` + `tesseract` OCR을 시도합니다.
5. OCR도 실패하면 PDF 문자열 추출 fallback을 시도합니다.
6. 추출 텍스트가 있으면 OpenAI Responses API에 JSON schema 형식으로 분석을 요청합니다.

Docker 배포에는 Poppler/Tesseract가 포함되어 있습니다. 일반 Vercel Python Runtime에서는 이미지 기반 PDF OCR에 필요한 시스템 바이너리가 없을 수 있으므로, 텍스트 레이어가 없는 PDF까지 안정적으로 처리하려면 Docker 런타임을 권장합니다.

## 화면과 워크플로우

### 채널

- 왼쪽 Channels 목록은 `data/job_roles.json`의 직군 카탈로그와 브라우저에 저장된 선택 상태를 기준으로 구성합니다.
- 기본 활성 채널은 `pm`, `ios`, `server`, `frontend`, `data`입니다.
- 채널 피드는 서버에서 불러온 JobKorea 공고를 아래 기준으로 표시합니다.
- 공고 카드에서 DM, Thread, 원문 URL 열기, 이모지 분류를 실행할 수 있습니다.

### DM

- Search DM은 자연어 검색 요청을 `Me` 메시지와 `Search` 응답 쌍으로 시간순 표시합니다.
- Resume & Portfolio DM은 PDF 업로드, 추출 텍스트, AI 분석 JSON을 표시합니다.
- 공고별 DM은 해당 공고와 사용자가 남긴 노트를 시간순으로 보여줍니다.
- DM 화면은 위에서 아래로 읽는 흐름이며 최초 스크롤 위치는 최상단입니다.

### Thread

- 공고 Thread는 선택 공고, 파싱 상세, `/api/match` 로컬 매칭 결과를 보여줍니다.
- Thread reply에 입력한 내용은 해당 공고의 노트로 저장됩니다.

### 검색 모달

- 상단 검색창은 이미 브라우저에 로드된 공고들을 대상으로 회사명, 제목, 경력, 지역, 키워드를 검색합니다.

## 데이터 저장 정책

사용자별 개인 데이터는 서버에 저장하지 않고 브라우저 `localStorage`에 저장합니다.

```text
localStorage key: slezzuk_local_state_v1
```

저장되는 값:

- 공고 이모지 분류
- 공고별 노트
- Resume & Portfolio 프로필/분석 결과
- 직접 파싱한 URL 공고
- 활성 채널 목록

`data/state.json`은 레거시/로컬 개발용 기본 상태 파일입니다. 배포 앱에서 여러 사용자가 같은 URL에 접속해도 개인 데이터는 각 브라우저에 분리됩니다. 브라우저 저장소를 지우거나 다른 기기에서 접속하면 개인 데이터는 이어지지 않습니다.

## API

`server.py`는 로컬 서버와 Vercel Function에서 같은 `Handler`를 사용합니다.

| Method | Path | 설명 |
| --- | --- | --- |
| `GET` | `/api/channels` | 직군 채널 카탈로그와 활성 채널 조회 |
| `GET` | `/api/jobs?channel=pm` | 채널 query 기준 JobKorea 공고 검색 |
| `GET` | `/api/search?q=NC` | 키워드 기반 JobKorea 공고 검색 |
| `GET` | `/api/parse?url=...` | 채용공고 URL 직접 파싱 |
| `GET` | `/api/state` | 레거시 호환 기본 상태 반환 |
| `GET` | `/api/docs` | 구현 대시보드용 프로젝트/기능/API 메타데이터 |
| `POST` | `/api/classify` | 레거시 호환 응답. 실제 저장은 브라우저 담당 |
| `POST` | `/api/note` | 레거시 호환 응답. 실제 저장은 브라우저 담당 |
| `POST` | `/api/profile` | 레거시 호환 응답. 실제 저장은 브라우저 담당 |
| `POST` | `/api/profile/analyze-pdf` | PDF 업로드, 텍스트 추출, OpenAI 분석 JSON 반환 |
| `POST` | `/api/match` | 브라우저가 보낸 프로필과 공고의 로컬 매칭 결과 반환 |
| `POST` | `/api/channels` | 레거시 호환 응답. 실제 저장은 브라우저 담당 |
| `POST` | `/api/ai-search` | 자연어 문장을 검색 의도로 해석하고 JobKorea 크롤링 결과 반환 |

## 프로젝트 구조

```text
.
├── api/index.py                  # Vercel Python Function 엔트리포인트
├── server.py                     # 로컬 HTTP 서버, API, JobKorea 파서, PDF 분석
├── public/
│   ├── index.html                # 로컬 서버가 서빙하는 메인 Slack UI
│   ├── app.js                    # SPA 상태, 렌더링, 이벤트, localStorage
│   ├── styles.css                # Slack 스타일 앱 UI
│   ├── dashboard.html            # 구현 대시보드
│   ├── dashboard.js              # /api/docs 기반 대시보드 렌더링
│   └── dashboard.css
├── index.html                    # Vercel 루트 정적 엔트리
├── dashboard.html                # Vercel 대시보드 정적 엔트리
├── data/
│   ├── job_roles.json            # 18개 직군 채널 카탈로그
│   └── state.json                # 레거시/로컬 개발용 기본 상태
├── scripts/
│   ├── start_server.sh           # 로컬 서버 실행
│   ├── start_ngrok.sh            # 로컬 서버 + ngrok 공유
│   └── python_env.sh             # .venv 생성 및 requirements 설치
├── docs/                         # PRD, SPEC, handoff, 간단 문서
├── vercel.json                   # /api/* rewrite와 Function 설정
├── Dockerfile                    # Poppler/Tesseract 포함 컨테이너 실행
├── requirements.txt              # Python dependency
└── AGENTS.md                     # 프로젝트 작업 규칙
```

## Vercel 배포

이 저장소는 GitHub `main` 브랜치 push를 통해 Vercel 자동 배포가 갱신되는 것을 전제로 합니다.

Vercel Import 설정:

1. GitHub 저장소를 Import합니다.
2. Framework Preset은 `Other`로 둡니다.
3. Build Command는 비워둡니다.
4. Output Directory도 비워둡니다.
5. PDF AI 분석을 사용할 경우 Environment Variables에 `OPENAI_API_KEY`를 추가합니다.
6. Deploy를 실행합니다.

배포 구조:

- 정적 UI: 루트 `index.html`, `dashboard.html`, 그리고 `public/` assets
- API: `api/index.py`가 `server.Handler`를 Vercel Python Function으로 노출
- 라우팅: `vercel.json`이 `/api/*`를 `/api/index.py`로 rewrite
- Function 제한: `maxDuration` 60초

로컬에서 Vercel 라우팅을 확인하려면 Vercel CLI를 사용할 수 있습니다.

```bash
npm i -g vercel
vercel dev
```

## 외부 공유

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

Vercel이 아니라 컨테이너 서버로 배포해야 하는 경우:

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

이 프로젝트의 작업 규칙은 `AGENTS.md`에 있습니다.

- 구현 또는 파일 변경 작업은 검증 후 git commit으로 마무리합니다.
- 커밋 후 항상 `git push origin main`을 실행해 Vercel 자동 배포가 갱신되도록 합니다.
- 관련 없는 변경은 섞지 않고 focused commit을 유지합니다.

기본 검증 예시:

```bash
git diff --check
python -m py_compile server.py api/index.py
```

프론트엔드 변경 시에는 로컬 서버를 띄운 뒤 브라우저에서 주요 화면을 확인합니다.

## 현재 한계와 주의사항

- JobKorea HTML 또는 hydration JSON 구조가 바뀌면 파서 수정이 필요합니다.
- 크롤링은 대상 사이트 정책과 요청 빈도 제한을 고려해야 합니다.
- 서버에는 사용자 인증/권한 관리가 없습니다.
- 개인 상태는 브라우저 저장소 기반이므로 기기/브라우저 간 자동 동기화가 없습니다.
- OpenAI API 키가 없으면 PDF 텍스트 추출까지만 진행되고 AI JSON 변환은 실패 메시지로 남습니다.
- 이미지 기반 PDF OCR은 `pdftoppm`과 `tesseract`가 설치된 환경에서만 안정적으로 동작합니다.
- `slack_messages.message_title`과 `slack_messages.message_body` 자동 생성은 아직 planned 상태입니다.
