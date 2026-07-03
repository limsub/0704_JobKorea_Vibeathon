# 슬쩍 ngrok 공유 및 개인정보 가이드

이 문서는 현재 MVP 기준의 실행, 공유, 데이터 취급 원칙을 정리한다.

## 1. 현재 운영 기준

- 웹앱은 `main_project/server.py`로 로컬에서 실행한다.
- 다른 팀에는 같은 Wi-Fi 주소가 아니라 ngrok public URL을 공유한다.
- GPT API Key, OpenAI API, 로컬 Codex CLI는 사용하지 않는다.
- JobKorea 공고 검색/파싱은 서버의 크롤러가 수행한다.
- 검색 의도와 매칭은 로컬 키워드 파서가 수행한다.

## 2. 실행

로컬 확인:

```bash
./scripts/start_server.sh
```

ngrok 공유:

```bash
./scripts/start_ngrok.sh
```

ngrok이 출력하는 `Forwarding` URL만 공유한다. 데모가 끝나면 터미널에서 프로세스를 종료해 터널을 닫는다.

## 3. 저장 데이터

현재 저장 위치:

```text
data/state.json
```

저장 항목:

- 채널 표시 상태
- 사용자 추가 채널
- 공고 이모지 분류
- 공고별 메모
- Resume & Portfolio 텍스트
- direct parsing으로 저장한 공고

해커톤 데모 중에는 실제 민감 개인정보를 입력하지 않는다. 이력서/포트폴리오에는 샘플 텍스트 또는 공개 가능한 요약만 넣는다.

## 4. 공유 주의사항

- ngrok URL을 받은 사람은 접속할 수 있다.
- URL은 발표/테스트 대상자에게만 공유한다.
- 데모 종료 후 ngrok 프로세스를 종료한다.
- 운영 서비스로 확장할 경우 데모 토큰, 인증, 입력 URL 제한, 크롤링 요청 제한을 추가한다.

## 5. 추후 보강

- `DEMO_TOKEN` 기반 접근 제한
- URL direct parsing의 SSRF 방어
- JobKorea 요청 캐싱과 rate limit
- 사용자별 상태 분리
- 서버 측 로그에서 개인정보 마스킹
