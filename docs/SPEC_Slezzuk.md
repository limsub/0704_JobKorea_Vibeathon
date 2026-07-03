# 슬쩍 구현 SPEC

- 기준 폴더: `main_project/`
- 서버: Python 표준 라이브러리 HTTP server
- 프론트엔드: 정적 HTML/CSS/JS 단일 페이지 앱
- 외부 공유: Cloudflare quick tunnel 또는 ngrok public URL
- AI/GPT/Codex: 현재 MVP에서는 사용하지 않음

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

팀 공유, Cloudflare quick tunnel:

```bash
./scripts/start_cloudflared.sh
```

터미널에 표시되는 `trycloudflare.com` URL을 팀원에게 공유한다.

팀 공유, ngrok:

```bash
./scripts/start_ngrok.sh
```

ngrok이 출력하는 `Forwarding` URL도 사용할 수 있다.

## 2. 주요 파일

- `index.html`: Slack 스타일 메인 UI
- `styles.css`: Slack 스타일 레이아웃과 채널 관리 모달 스타일
- `app.js`: 채널, DM, 스레드, 검색, 메모, 프로필, 로컬 매칭 렌더링
- `server.py`: API 서버, JobKorea 크롤링, URL 파싱, 상태 저장
- `data/job_roles.json`: 로컬 직군 채널 카탈로그
- `data/state.json`: 채널 표시 상태, 사용자 채널, 메모, 분류, 프로필 저장
- `scripts/start_server.sh`: 로컬 서버 실행
- `scripts/start_cloudflared.sh`: 로컬 서버 실행 후 Cloudflare quick tunnel 실행
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
11. 프로필/공고 키워드 기반 로컬 매칭
12. public tunnel URL 공유

## 4. 채널 스펙

서버는 `data/job_roles.json`의 직군 카탈로그와 `data/state.json`의 `enabledChannelIds`, `customChannels`를 합쳐 활성 채널을 만든다.

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
| GET | `/api/channels` | 직군 카탈로그, 활성 채널, 사용자 채널 조회 |
| POST | `/api/channels` | 채널 표시/숨김, 사용자 채널 추가/삭제 |
| GET | `/api/jobs?channel=pm` | 채널 검색어로 JobKorea 공고 조회 |
| GET | `/api/search?q=...` | 키워드 기반 JobKorea 검색 |
| GET | `/api/parse?url=...` | 채용공고 URL 파싱 후 direct 채널에 저장 |
| GET | `/api/state` | 로컬 상태 조회 |
| GET | `/api/docs` | 대시보드 메타데이터 조회 |
| POST | `/api/classify` | 공고 이모지 분류 저장 |
| POST | `/api/note` | 공고별 메모 저장 |
| POST | `/api/profile` | 프로필 텍스트 저장 |
| POST | `/api/match` | 공고와 프로필의 로컬 매칭 계산 |
| POST | `/api/ai-search` | 기존 프론트 호환용 이름. 실제 동작은 로컬 검색 봇 |

## 6. 데이터 스펙

`data/state.json`:

```json
{
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
  "customChannels": []
}
```

## 7. 비사용 항목

현재 MVP에서는 아래를 사용하지 않는다.

- GPT API Key
- OpenAI API 호출
- 로컬 Codex CLI 호출
- 같은 Wi-Fi 또는 로컬 IP 기반 팀 접속 전제

## 8. 검증 기준

1. `python3 -m py_compile server.py`가 통과한다.
2. `app.js`, `dashboard.js`의 JS 문법 검사가 통과한다.
3. `/api/channels`가 활성 채널과 직군 카탈로그를 반환한다.
4. `/api/jobs?channel=pm`이 JobKorea 검색 결과 또는 fallback을 반환한다.
5. 채널 관리 모달에서 직군 채널을 표시/숨김할 수 있다.
6. 사용자 채널을 추가/삭제할 수 있다.
7. cloudflared 설치 환경에서 `./scripts/start_cloudflared.sh`가 public URL을 출력한다.
8. ngrok 설치 환경에서 `./scripts/start_ngrok.sh`도 public URL을 출력한다.
