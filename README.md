# JobKorea Vibe

Slack 스타일로 JobKorea 채용공고를 직군 채널별로 모아보고, 공고별 분류/메모/로컬 매칭을 할 수 있는 해커톤 웹앱입니다.

## 실행

```bash
./scripts/start_server.sh
```

로컬 확인 주소:

```text
http://127.0.0.1:5174
```

Resume & Portfolio PDF 분석을 사용하려면 서버 실행 전에 OpenAI API 키를 환경변수로 설정합니다.

```bash
OPENAI_API_KEY=... ./scripts/start_server.sh
```

## Vercel 배포

이 저장소는 Vercel Python Runtime에 맞춰져 있습니다.

1. Vercel에서 GitHub 저장소를 Import합니다.
2. Framework Preset은 `Other`로 둡니다.
3. Build Command는 비워둡니다.
4. Output Directory도 비워둡니다.
5. Resume & Portfolio PDF 분석을 사용할 경우 Environment Variables에 `OPENAI_API_KEY`를 추가합니다.
6. Deploy를 실행합니다.

배포 구조:

- `public/`: Vercel CDN으로 서빙되는 정적 파일
- `api/index.py`: Vercel Serverless Function 엔트리포인트
- `server.py`: 로컬 HTTP 서버와 Vercel API 핸들러 공용 구현
- `vercel.json`: `/api/*` 요청을 Python 함수로 연결
- `.python-version`: Vercel Python 3.12 지정

Vercel의 서버리스 파일 시스템은 영구 저장소가 아니므로 배포 환경의 메모/분류/프로필 상태는 `/tmp/jobkorea-vibe-state/state.json`에 임시 저장됩니다. 서비스 재시작, 콜드 스타트, 재배포 후에는 상태가 초기화될 수 있습니다. 영구 저장이 필요하면 Vercel KV, Postgres, Supabase 같은 외부 저장소로 `read_state`/`write_state`를 교체해야 합니다.

로컬에서 Vercel 라우팅을 확인하려면 Vercel CLI를 사용할 수 있습니다.

```bash
npm i -g vercel
vercel dev
```

## 외부 공유

로컬 서버를 임시 public URL로 공유해야 할 때는 ngrok을 사용할 수 있습니다.

```bash
./scripts/start_ngrok.sh
```

ngrok 터미널에 표시되는 `Forwarding` URL을 공유하면 됩니다. ngrok이 처음이면 먼저 ngrok 설치와 로그인 토큰 설정이 필요합니다.

```bash
ngrok config add-authtoken <your-token>
```

## 현재 구현

- `server.py`: Python 표준 라이브러리 기반 웹 서버와 API
- `public/index.html`, `public/styles.css`, `public/app.js`: Slack 스타일 단일 페이지 앱
- `data/job_roles.json`: 로컬 직군 채널 카탈로그
- `data/state.json`: 채널 표시 상태, 메모, 분류, 프로필 저장
- `public/dashboard.html`: 구현 상태 대시보드
- `requirements.txt`: PDF 텍스트 레이어 추출용 `pypdf`
- `Dockerfile`: Docker 배포용 Poppler + Tesseract OCR 런타임

Resume & Portfolio DM은 PDF 파일만 업로드할 수 있고, OpenAI Responses API 분석은 상태 파일 기준 1회만 시도합니다. 자연어 검색은 로컬 키워드 파서로 검색어를 만들고, JobKorea 검색 결과 HTML을 크롤링합니다.

## Docker 배포

Vercel이 아니라 컨테이너 서버로 배포해야 하는 경우 Docker를 사용할 수 있습니다.

```bash
docker build -t jobkorea-vibe .
docker run --rm -p 8080:8080 -e OPENAI_API_KEY=... jobkorea-vibe
```

배포용 OCR은 macOS Vision이 아니라 Linux 서버에서도 동작하는 Tesseract를 사용합니다. Dockerfile은 `poppler-utils`, `tesseract-ocr`, `tesseract-ocr-kor`를 설치합니다.
