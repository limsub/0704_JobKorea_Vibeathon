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

## 외부 공유

같은 Wi-Fi 접속을 전제로 하지 않고 public tunnel URL로 공유합니다.

Cloudflare quick tunnel:

```bash
./scripts/start_cloudflared.sh
```

터미널에 표시되는 `trycloudflare.com` URL을 다른 팀에 공유하면 됩니다.

ngrok:

```bash
./scripts/start_ngrok.sh
```

ngrok 터미널에 표시되는 `Forwarding` URL을 공유하면 됩니다. ngrok이 처음이면 먼저 ngrok 설치와 로그인 토큰 설정이 필요합니다.

```bash
ngrok config add-authtoken <your-token>
```

## 현재 구현

- `server.py`: Python 표준 라이브러리 기반 웹 서버와 API
- `index.html`, `styles.css`, `app.js`: Slack 스타일 단일 페이지 앱
- `data/job_roles.json`: 로컬 직군 채널 카탈로그
- `data/state.json`: 채널 표시 상태, 메모, 분류, 프로필 저장
- `dashboard.html`: 구현 상태 대시보드
- `requirements.txt`: PDF 텍스트 추출용 `pypdf`

Resume & Portfolio DM은 PDF 파일만 업로드할 수 있고, OpenAI Responses API 분석은 상태 파일 기준 1회만 시도합니다. 자연어 검색은 로컬 키워드 파서로 검색어를 만들고, JobKorea 검색 결과 HTML을 크롤링합니다.
