# Vercel 전환 인수인계

최종 업데이트: 2026-07-04

## 현재 운영 URL

- 앱: https://0704-job-korea-vibeathon.vercel.app/
- 대시보드: https://0704-job-korea-vibeathon.vercel.app/dashboard.html
- API 확인: https://0704-job-korea-vibeathon.vercel.app/api/channels
- GitHub: https://github.com/limsub/0704_JobKorea_Vibeathon

## 이번 대화에서 완료한 일

기존 Cloudflare quick tunnel 중심 구조를 Vercel 배포 구조로 전환했다.

- 정적 파일을 `public/`로 이동했다.
- Vercel Python Serverless Function 엔트리포인트 `api/index.py`를 추가했다.
- `/api/*` 요청을 Python 함수로 보내는 `vercel.json`을 추가했다.
- `server.py`를 로컬 HTTP 서버와 Vercel 함수에서 같이 쓸 수 있게 조정했다.
- Vercel에서는 상태 파일을 `/tmp/jobkorea-vibe-state/state.json`에 임시 저장하도록 했다.
- Cloudflare quick tunnel 스크립트 `scripts/start_cloudflared.sh`를 삭제했다.
- README와 개발 문서를 Vercel 기준으로 갱신했다.
- Vercel 배포 후 루트 `/`에서 Directory Listing이 보이던 문제를 루트 `index.html` 추가로 해결했다.
- CSS/JS가 안 먹어서 Slack UI가 깨져 보이던 문제를 `/styles.css`, `/app.js` 경로로 수정해 해결했다.

## 현재 배포 구조

```text
.
├── index.html                 # Vercel 루트 진입 파일
├── dashboard.html             # Vercel 루트 대시보드 진입 파일
├── public/
│   ├── index.html             # 로컬 서버 정적 진입 파일
│   ├── dashboard.html
│   ├── styles.css
│   ├── app.js
│   ├── dashboard.css
│   └── dashboard.js
├── api/
│   └── index.py               # Vercel Python Function 엔트리포인트
├── server.py                  # API/로컬 서버 공용 구현
├── vercel.json                # Vercel 라우팅 설정
├── requirements.txt
└── data/
    ├── job_roles.json
    └── state.json             # 로컬 상태 저장
```

## 중요한 경로 규칙

Vercel에서는 `public/` 안 파일이 URL 루트로 서빙된다.

- `public/styles.css` -> `/styles.css`
- `public/app.js` -> `/app.js`
- `public/dashboard.css` -> `/dashboard.css`
- `public/dashboard.js` -> `/dashboard.js`

따라서 루트 `index.html`은 반드시 아래처럼 참조해야 한다.

```html
<link rel="stylesheet" href="/styles.css" />
<script src="/app.js"></script>
```

`/public/styles.css`처럼 참조하면 Vercel에서 404가 나고, Slack UI가 스타일 없는 HTML처럼 보인다.

## 배포 방식

GitHub `main` 브랜치에 push하면 Vercel이 자동으로 재배포한다.

```bash
git add .
git commit -m "작업 내용"
git push origin main
```

배포 후 확인할 URL:

```text
https://0704-job-korea-vibeathon.vercel.app/
https://0704-job-korea-vibeathon.vercel.app/api/channels
```

## 로컬 실행

로컬 확인은 그대로 가능하다.

```bash
./scripts/start_server.sh
```

기본 주소:

```text
http://127.0.0.1:5174
```

기본 포트가 사용 중이면 다른 포트를 지정한다.

```bash
PORT=5184 ./scripts/start_server.sh
```

## 검증 기록

확인 완료:

- `python3 -m py_compile server.py api/index.py`
- `public/app.js` JS 문법 검사
- `public/dashboard.js` JS 문법 검사
- Vercel `/` HTML 정상 응답
- Vercel `/styles.css` 200 응답
- Vercel `/app.js` 200 응답
- Vercel `/api/channels` JSON 정상 응답
- 브라우저 렌더링에서 Slack UI 정상 표시 확인

## 현재 한계

Vercel 서버리스 환경은 배포 파일 시스템을 영구 저장소처럼 쓰기 어렵다.

- 로컬: `data/state.json`에 상태 저장
- Vercel: `/tmp/jobkorea-vibe-state/state.json`에 임시 저장

따라서 Vercel에서는 메모, 분류, 프로필, PDF 분석 결과가 콜드 스타트나 재배포 후 초기화될 수 있다. 실제 서비스처럼 영구 저장하려면 Vercel KV, Vercel Postgres, Supabase 같은 외부 DB를 붙여야 한다.

## 다음 구현 채팅에서 지켜야 할 것

- 앞으로 구현은 Vercel 앱 기준으로 한다.
- UI 수정 시 로컬과 Vercel 양쪽에서 CSS/JS 경로가 깨지지 않는지 확인한다.
- API 수정 시 `/api/*`가 `api/index.py`를 통해 `server.py` 핸들러로 들어간다는 점을 유지한다.
- 정적 앱 파일을 수정하면 `public/` 안 파일을 먼저 고친다.
- 루트 `index.html`, `dashboard.html`은 Vercel 루트 진입용이므로 경로만 조심해서 유지한다.
- 영구 저장 기능을 요구받으면 먼저 DB 선택부터 정해야 한다.

