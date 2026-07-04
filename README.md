# JobKorea Vibe

JobKorea Vibe는 JobKorea 채용공고를 Slack 워크스페이스처럼 탐색하고, 공고를 사람의 업무 공유 메시지처럼 읽고, 이력서/포트폴리오 PDF 분석 결과를 기반으로 공고별 매칭 코멘트를 확인하는 채용 큐레이션 프로토타입입니다.

최종 정리일: 2026-07-04
배포 방식: GitHub `main` 브랜치 push -> Vercel 자동 배포

## 핵심 컨셉

일반적인 채용공고 목록처럼 보이지 않게 만드는 것이 이 프로젝트의 핵심 UX입니다.

- 공고는 표나 카드가 아니라 Slack 채널 메시지처럼 표시됩니다.
- 공고별 상세 내용은 Slack Thread 댓글처럼 정리됩니다.
- 공고별 DM에서는 해당 공고의 dummy sender와 대화하듯 브리핑, 검토 가이드, 원문 URL, 매칭 코멘트를 확인합니다.
- 사용자는 DM composer를 개인 메모장처럼 사용해 자소서 초안, 확인할 조건, 면접 질문을 남길 수 있습니다.
- 이력서/포트폴리오 PDF 분석 결과가 있으면 공고별 Thread와 DM에 매칭 점수와 보완 방향이 붙습니다.

## 최종 구현 상태

### Slack형 채용공고 피드

- Slack 레이아웃을 재현한 SPA입니다.
- 좌측 rail, channel list, direct messages, message composer, thread panel, modal search를 구현했습니다.
- 최초 기본 채널은 `PM/PO` 하나만 노출됩니다.
- 채널 관리를 통해 18개 직군 채널을 추가/삭제할 수 있습니다.
- 공고 피드에는 중복 인트로, JSON 원문, 채용공고 표/카드 UI를 노출하지 않습니다.
- 공고마다 dummy sender 이름과 프로필 이미지를 부여해, 여러 사람이 Slack에 공유하는 느낌을 만듭니다.
- 공고 메시지는 OpenAI 또는 로컬 fallback으로 생성되며, 공고마다 말투/길이/이모지가 달라지도록 구성했습니다.

### JobKorea 크롤링 및 공고 변환

- `/api/jobs?channel=pm`으로 채널별 JobKorea 검색 결과를 가져옵니다.
- JobKorea Search 페이지의 Next.js hydration JSON에서 공고 배열을 추출합니다.
- 공고는 내부적으로 `raw`, `job_profile`, `slack_messages` 구조로 정규화됩니다.
- OpenAI Responses API가 사용 가능하면 공고별 Slack 본문과 thread comment를 생성합니다.
- Vercel 기본값에서는 초기 속도를 위해 공고 Slack 메시지 변환을 로컬 fallback 중심으로 처리합니다.
- OpenAI 공고 변환은 `OPENAI_JOB_MESSAGE_LIMIT`, `OPENAI_JOB_MESSAGE_WORKERS`, `OPENAI_JOB_MESSAGE_TIMEOUT`으로 제어합니다.

### Progressive Loading

- 채널 진입 시 모든 공고 분석이 끝날 때까지 기다리지 않습니다.
- 먼저 보이는 공고부터 표시하고, 이후 결과를 background에서 이어서 채웁니다.
- 로딩 중에는 Slack message skeleton과 progress bar를 보여줍니다.
- 채널 추가/삭제도 UI를 먼저 반영한 뒤 데이터 로딩을 진행합니다.

### Thread

공고를 클릭하면 오른쪽 Thread가 열립니다.

- Thread 첫 메시지는 채널에 노출된 공고 메시지와 동일합니다.
- 첫 번째 댓글은 공고 상세 브리핑입니다.
- PDF 프로필 분석 데이터가 있으면 두 번째 댓글로 매칭 분석이 표시됩니다.
- 매칭 댓글은 해당 공고 sender 이름/프로필 이미지와 동일하게 표시됩니다.
- 매칭 코멘트는 긴 한 문장으로 붙지 않도록 문단과 리스트 줄바꿈을 보정합니다.

### 공고별 DM

공고 sender의 프로필 사진이나 이름을 누르면 공고별 DM이 열립니다.

- DM title은 해당 dummy sender 이름입니다.
- DM subtitle은 회사명과 공고명 기반 메모 맥락입니다.
- 자동으로 아래 메시지가 들어옵니다.
  - 원래 공고 공유 메시지
  - 공고 브리핑
  - 검토 가이드
  - JobKorea 원문 URL
  - AI 매칭 또는 프로필 업로드 안내
  - 내 메모 영역
- `공고분석이`, `메모도우미` 같은 별도 봇 이름은 사용하지 않습니다.
- 공고 브리핑/가이드/URL 메시지도 모두 해당 DM sender 이름으로 표시됩니다.
- 메모가 없을 때는 `이 공고에 대한 메모를 기록하세요.` 문구만 노출합니다.

### Direct Messages

- `Search`: 자연어로 원하는 회사/직무/지역을 입력하면 JobKorea 검색어로 바꾸고 결과를 Slack 메시지처럼 보여줍니다.
- `Analyze Job Posting`: JobKorea 공고 또는 회사 채용 페이지 URL을 붙여넣으면 서버가 직접 파싱해 DM 답장으로 요약합니다.
- `Resume & Portfolio`: PDF 이력서/포트폴리오를 업로드하고, OpenAI 분석 결과를 Slack 메모처럼 확인합니다.
- 공고별 DM: 개별 공고에 대한 개인 메모와 매칭 결과를 관리합니다.

### URL Direct Parsing

- `/api/parse?url=...` 또는 `Analyze Job Posting` DM을 통해 URL을 직접 분석할 수 있습니다.
- JobKorea에 검색되지 않은 회사 채용 페이지도 가능한 범위에서 title, company, career, location, period, keywords, responsibilities를 추론합니다.
- 분석 결과는 Slack 메시지형 공고로 변환되어 스레드/DM/메모 흐름에 연결됩니다.

### Resume & Portfolio PDF 분석

PDF 분석은 실제 PDF 텍스트 추출과 OpenAI 분석을 사용합니다. 다만 데모 UX를 위해 큰 스키마/긴 타임아웃을 제거하고 경량 분석으로 최적화했습니다.

현재 흐름:

1. PDF 확장자, MIME, `%PDF-` 헤더를 검증합니다.
2. 최대 업로드 크기는 40MB입니다.
3. `pypdf`로 앞쪽 최대 5페이지 텍스트를 빠르게 추출합니다.
4. 텍스트가 부족하면 PDF 내부 문자열 fallback 추출을 시도합니다.
5. 추출 텍스트 중 최대 18,000자만 OpenAI에 전달합니다.
6. OpenAI는 작은 JSON schema로 이름, 헤드라인, 요약, 경력, 희망 역할, 스킬, 툴, 프로젝트, 강점, 보완점, 추천 역할, 근거 문구만 반환합니다.
7. 서버가 이 경량 결과를 기존 매칭 엔진이 쓰는 `candidate_profile`, `matching_profile`, `ai_analysis_result` 구조로 변환합니다.
8. 브라우저는 분석 결과를 `localStorage`에 저장하고 공고별 매칭에 사용합니다.

최적화 포인트:

- 기존 대형 profile schema 대신 `PROFILE_FAST_ANALYSIS_SCHEMA` 사용
- OpenAI 입력 최대 18,000자
- OpenAI 출력 최대 2,200 tokens
- OpenAI timeout 기본 18초
- 기본 업로드 흐름에서는 OCR을 실행하지 않아 PDF 분석 지연을 줄임
- Dockerfile에는 Poppler/Tesseract 설치가 포함되어 있어 OCR 실험 환경을 따로 만들 수 있음

### AI 매칭

- `/api/match`가 공고 JSON과 브라우저에 저장된 프로필 분석 JSON을 비교합니다.
- 프로필 분석이 있으면 OpenAI Responses API로 Slack 댓글형 매칭 코멘트를 생성합니다.
- OpenAI 키가 없거나 호출 실패 시 로컬 키워드 기반 매칭으로 fallback합니다.
- 매칭 결과는 점수, 요약, 강점, 리스크, 다음 액션, 추천 방향을 포함합니다.
- UI에서는 딱딱한 표가 아니라 실제 사람이 댓글을 남기는 형태로 표시됩니다.

### Later

- 공고에는 세 가지 reaction을 붙일 수 있습니다.
  - 👀 관심 있음
  - ⭐ 지원 후보
  - 💰 연봉 좋음
- 저장한 공고는 Later 화면에서 reaction 그룹별로 모아봅니다.
- Later rail은 Home과 같은 UI 톤으로 유지됩니다.

## 데이터 저장 정책

개인 데이터는 서버 DB에 저장하지 않습니다.

```text
localStorage key: slezzuk_local_state_v1
```

브라우저에 저장되는 값:

- 활성 채널 목록
- 사용자 추가 채널
- 공고 reaction 분류
- Later 저장 공고
- 공고별 노트
- 공고별 DM 목록
- URL 직접 파싱 공고
- 자연어 검색 이력
- Resume & Portfolio PDF 분석 결과
- 공고별 매칭 cache

Vercel 배포 환경에서도 개인화 상태는 각 사용자의 브라우저에만 저장됩니다. 다른 브라우저나 다른 기기에서는 상태가 이어지지 않습니다.

## API

`server.py`의 `Handler`가 로컬 서버와 Vercel Python Function 양쪽에서 같은 API를 제공합니다.

| Method | Path | 설명 |
| --- | --- | --- |
| `GET` | `/api/channels` | 직군 카탈로그와 기본 채널 상태 조회 |
| `GET` | `/api/jobs?channel=pm` | 채널 query 기준 JobKorea 공고 검색 후 Slack 메시지 구조 반환 |
| `GET` | `/api/search?q=NC` | 키워드 기반 JobKorea 검색 결과 반환 |
| `GET` | `/api/parse?url=...` | 채용공고 URL 직접 파싱 |
| `GET` | `/api/state` | 레거시 호환 기본 상태 반환 |
| `GET` | `/api/docs` | 대시보드용 기능/API/런타임 메타데이터 |
| `POST` | `/api/profile/analyze-pdf` | PDF 업로드, 텍스트 추출, OpenAI 경량 분석 JSON 반환 |
| `POST` | `/api/match` | 공고와 프로필 분석 결과 기반 매칭 코멘트 반환 |
| `POST` | `/api/parse-url` | JSON body 기반 URL 직접 파싱 |
| `POST` | `/api/ai-search` | 자연어 입력을 JobKorea 검색 의도로 해석하고 결과 반환 |
| `POST` | `/api/classify` | 레거시 호환. 실제 저장은 브라우저 localStorage |
| `POST` | `/api/note` | 레거시 호환. 실제 저장은 브라우저 localStorage |
| `POST` | `/api/profile` | 레거시 호환. 실제 저장은 브라우저 localStorage |
| `POST` | `/api/channels` | 레거시 호환. 실제 저장은 브라우저 localStorage |

## 환경 변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `OPENAI_API_KEY` | 없음 | OpenAI Responses API 호출용 키 |
| `CHATGPT_API_KEY` | 없음 | `OPENAI_API_KEY`가 없을 때 사용하는 대체 키 |
| `OPENAI_MODEL` | `gpt-4o-mini` | 공고 메시지 변환, PDF 분석, 매칭 코멘트 모델 |
| `OPENAI_JOB_MESSAGE_LIMIT` | local `10`, Vercel `0` | 공고 리스트 응답 1회에서 OpenAI로 Slack 메시지를 변환할 최대 공고 수 |
| `OPENAI_JOB_MESSAGE_WORKERS` | `4` | 공고 메시지 OpenAI 병렬 작업 수 |
| `OPENAI_JOB_MESSAGE_TIMEOUT` | `8` | 공고 메시지 OpenAI 호출 timeout |
| `PROFILE_FAST_MAX_PAGES` | `5` | PDF 프로필 분석 시 pypdf로 읽을 최대 페이지 수 |
| `PROFILE_OPENAI_TIMEOUT` | `18` | PDF 프로필 OpenAI 경량 분석 timeout |
| `OCR_MAX_PAGES` | `20` | OCR 실험 경로에서 사용할 최대 페이지 수 |
| `OCR_DPI` | `160` | OCR 실험 경로의 PDF 이미지 변환 DPI |
| `TESSERACT_LANGS` | `kor+eng` | Tesseract OCR 언어 설정 |
| `TESSERACT_PSM` | `6` | Tesseract page segmentation mode |
| `PDFTOPPM_BIN` | 자동 탐색 | `pdftoppm` 경로 override |
| `TESSERACT_BIN` | 자동 탐색 | `tesseract` 경로 override |
| `HOST` | `127.0.0.1` | 로컬 서버 host |
| `PORT` | `5174` | 로컬 서버 port |
| `STATE_DIR` | local `data`, Vercel `/tmp/jobkorea-vibe-state` | 레거시 상태 파일 디렉터리 |
| `STATE_PATH` | `STATE_DIR/state.json` | 레거시 상태 파일 경로 |

## 로컬 실행

```bash
./scripts/start_server.sh
```

기본 주소:

```text
http://127.0.0.1:5174
```

포트를 바꿔 실행:

```bash
PORT=5175 ./scripts/start_server.sh
```

OpenAI 기능까지 확인:

```bash
OPENAI_API_KEY=sk-... ./scripts/start_server.sh
```

`scripts/start_server.sh`는 `.venv`를 준비하고 `requirements.txt`를 설치한 뒤 `server.py`를 실행합니다.

## Vercel 배포

이 프로젝트는 Vercel 배포에 맞춰 정리되어 있습니다.

- 정적 UI: 루트 `index.html`, `dashboard.html`, `public/*`
- API: `api/index.py`
- 서버 로직: `server.py`
- 라우팅: `vercel.json`의 `/api/(.*)` rewrite
- Function 제한: `maxDuration: 60`

배포 절차:

1. Vercel에서 GitHub repository를 Import합니다.
2. Framework Preset은 `Other`로 둡니다.
3. Build Command는 비워둡니다.
4. Output Directory도 비워둡니다.
5. Environment Variables에 `OPENAI_API_KEY`를 등록합니다.
6. `main` 브랜치에 push하면 Vercel이 자동 배포합니다.

현재 운영 URL:

```text
https://0704-job-korea-vibeathon.vercel.app/
https://0704-job-korea-vibeathon.vercel.app/dashboard.html
https://0704-job-korea-vibeathon.vercel.app/api/channels
```

## Docker 실행

OCR 바이너리까지 포함한 환경으로 확인하고 싶을 때 사용합니다.

```bash
docker build -t jobkorea-vibe .
docker run --rm -p 8080:8080 -e OPENAI_API_KEY=sk-... jobkorea-vibe
```

접속:

```text
http://127.0.0.1:8080
```

## ngrok 공유

로컬 서버를 외부에 임시 공유할 때 사용합니다.

```bash
./scripts/start_ngrok.sh
```

처음 사용하는 경우:

```bash
ngrok config add-authtoken <your-token>
```

ngrok URL을 받은 사람은 로컬 서버에 접근할 수 있으므로 공유 범위를 관리해야 합니다.

## 프로젝트 구조

```text
.
├── api/
│   └── index.py                  # Vercel Python Function entry
├── data/
│   ├── job_roles.json            # 18개 직군 채널 카탈로그
│   └── state.json                # 레거시/로컬 기본 상태
├── docs/
│   ├── PRD_Slezzuk.md
│   ├── SPEC_Slezzuk.md
│   ├── GUIDE_Slezzuk_API_Deploy_Privacy.md
│   ├── VERCEL_HANDOFF.md
│   └── simple/
├── public/
│   ├── index.html                # 로컬 정적 UI
│   ├── app.js                    # SPA 상태/렌더링/API 호출/localStorage
│   ├── styles.css                # Slack형 UI 스타일
│   ├── dashboard.html
│   ├── dashboard.js
│   └── dashboard.css
├── scripts/
│   ├── python_env.sh
│   ├── start_server.sh
│   └── start_ngrok.sh
├── Dockerfile
├── README.md
├── dashboard.html                # Vercel dashboard entry
├── index.html                    # Vercel root entry
├── requirements.txt
├── server.py                     # API, JobKorea parser, PDF/OpenAI analysis
└── vercel.json
```

## 구현 메모

- `OPENAI_JOB_MESSAGE_LIMIT`는 Vercel 기본값이 `0`입니다. 배포 환경에서 초기 피드 속도를 우선하기 위해 공고 메시지는 로컬 fallback을 기본 사용합니다.
- PDF 분석과 공고 매칭은 OpenAI API를 계속 사용합니다. 단, PDF 분석은 작은 schema와 짧은 timeout으로 최적화했습니다.
- 공고 UI는 최종적으로 표/카드형 요약을 제거했고, Slack 메시지와 Thread/DM 중심으로만 구성했습니다.
- JobKorea HTML 구조가 바뀌면 hydration JSON 파서 수정이 필요할 수 있습니다.
- 크롤링은 대상 사이트 정책과 요청 빈도 제한을 고려해야 합니다.
- 브라우저 localStorage 기반이라 별도 DB 없이 데모/해커톤 운영에 적합하지만, 사용자 계정 간 동기화는 제공하지 않습니다.

## 최종 배포 전 체크리스트

- `OPENAI_API_KEY`가 Vercel Environment Variables에 등록되어 있는지 확인
- `/api/channels`가 200 응답을 반환하는지 확인
- 기본 `PM/PO` 채널에서 공고 메시지가 표시되는지 확인
- 공고 클릭 시 Thread가 열리고 상세 댓글이 보이는지 확인
- 공고 sender 클릭 시 공고별 DM이 열리고 JobKorea URL이 표시되는지 확인
- `Resume & Portfolio` DM에서 PDF 업로드 후 분석 결과가 수 초 내 표시되는지 확인
- `Analyze Job Posting` DM에서 URL direct parsing이 동작하는지 확인
- `Search` DM에서 자연어 검색과 progress bar가 동작하는지 확인
