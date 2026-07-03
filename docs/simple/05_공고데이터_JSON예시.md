# 공고 데이터 JSON 예시

## PROMPT

### PROMPT_1 공고 정보 -> 슬랙 메세지 변환

현재 MVP에서는 ChatGPT API를 사용하지 않는다.

따라서 `PROMPT_1`은 구현 필요 항목으로만 기록하고, 실제 응답 JSON의 `slack_messages` 값은 빈 문자열로 둔다.

## JSON_1 공고 정보

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
    "message_title": "",
    "message_body": ""
  }
}
```

## 현재 화면 표시 기준

- 채널을 누르면 해당 직군의 JobKorea 공고 리스트를 가져온다.
- 개발 단계에서는 각 공고 셀에 `JSON_1 공고 정보`를 그대로 보여준다.
- `slack_messages.message_title`과 `slack_messages.message_body`는 ChatGPT API 연동 전까지 빈 값으로 보여야 한다.

## 추후 구현 필요 항목

- ChatGPT API Key 설정
- `PROMPT_1` 작성 및 서버 호출 함수 추가
- 공고 JSON 입력 -> Slack message JSON 출력
- 출력값을 `slack_messages.message_title`, `slack_messages.message_body`에 저장
