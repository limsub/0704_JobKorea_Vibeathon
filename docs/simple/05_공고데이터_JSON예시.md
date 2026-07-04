# 공고 데이터 JSON 예시

## PROMPT

### PROMPT_1 공고 정보 -> 슬랙 메세지 변환

현재 구현에서는 OpenAI Responses API를 사용해 공고 JSON을 Slack 메시지와 스레드 코멘트로 변환한다.

API 키가 없거나 호출에 실패하면 같은 JSON 필드를 로컬 fallback 문장으로 채운다.

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
    "message_title": "현대오토에버㈜ 2026년 3분기 신입사원 모집 공유해요",
    "message_body": "현대오토에버㈜ 관련 채용공고 하나 공유해요.\n\n서비스기획, 데이터분석 키워드가 같이 보이는 건이라,\n관련 직무 보시는 분들은 참고할 만해 보여요.\n\n세부 내용은 스레드에 정리해둘게요 :eyes:",
    "thread_comment": "현대오토에버㈜의 2026년 3분기 신입사원 모집 공고로 보여요.\n\n세부 내용 가볍게 정리해봤어요.\n\n- 관련 조직/회사: 현대오토에버㈜\n- 역할 성격: 서비스기획/PM\n- 주요 키워드: 서비스기획, 데이터분석\n- 경험 기준: 신입\n- 확인 기한: 2026-07-13T23:59:59+09:00\n- 급여: 회사 내규에 따름\n\n원문 확인 후 지원 방향을 잡으면 좋겠습니다.",
    "thread_summary": "현대오토에버㈜ / 서비스기획 / 신입",
    "key_points": ["역할 성격: 서비스기획/PM", "경험 기준: 신입", "확인 기한: 2026-07-13"],
    "ai_mode": "openai",
    "model": "gpt-4o-mini",
    "generated_at": "2026-07-04T14:00:00+09:00",
    "error": ""
  }
}
```

## 현재 화면 표시 기준

- 채널을 누르면 해당 직군의 JobKorea 공고 리스트를 가져온다.
- 각 공고 셀에는 `slack_messages.message_title`과 `message_body`를 Slack 본문처럼 보여준다.
- 원문 확인과 디버깅을 위해 `JSON_1 공고 정보`도 카드 안에 그대로 표시한다.
- 스레드에는 `slack_messages.thread_comment`를 첫 코멘트로 보여준다.

## 추후 구현 필요 항목

- 영구 서버 저장소가 필요하면 `slack_messages`를 Vercel KV/Postgres/Supabase 등에 저장
