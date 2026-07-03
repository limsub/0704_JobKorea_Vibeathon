# 공고 데이터 JSON 예시

## 1. 저장 원칙

잡코리아에서 가져온 공고는 아래 3가지를 분리해서 저장한다.

1. `raw`
   - 크롤링해서 가져온 원본 데이터
   - 최대한 원문에 가깝게 보관

2. `job_profile`
   - AI가 분석한 구조화 데이터
   - 매칭 분석에 사용

3. `slack_messages`
   - 실제 화면에 보여줄 Slack 말투 문장
   - 톤별로 저장

즉, 화면에는 `raw`를 그대로 보여주지 않고 `slack_messages`를 보여준다.

## 2. 추천 JSON 구조

```json
{
  "id": "jobkorea_49435790",
  "source": "jobkorea",
  "source_job_id": "49435790",
  "source_url": "https://www.jobkorea.co.kr/Recruit/GI_Read/49435790",
  "crawled_at": "2026-07-03T15:30:00+09:00",

  "raw": {
    "title": "2026년 3분기 현대오토에버 신입사원 모집",
    "company_name": "현대오토에버㈜",
    "career": "신입",
    "education": "대졸이상",
    "employment_type": "정규직",
    "location": "서울",
    "salary": "회사 내규에 따름",
    "period": "2026.06.24 ~ 2026.07.13 13:00",
    "keywords": ["AI", "SW", "서비스기획"],
    "raw_text": "현대오토에버㈜ 2026년 3분기 현대오토에버 신입사원 모집 ... 자소서 항목 ...",
    "raw_html_saved": false
  },

  "job_profile": {
    "company_name": "현대오토에버㈜",
    "job_title": "2026년 3분기 신입사원 모집",
    "industry": "IT 서비스",
    "location": "서울",
    "employment_type": "정규직",
    "salary": "회사 내규에 따름",
    "experience": "신입",
    "responsibilities": [
      "AI 및 SW 관련 직무 수행",
      "서비스/플랫폼 개발 또는 기획 업무"
    ],
    "required_skills": [
      "직무 관련 전공 또는 프로젝트 경험"
    ],
    "preferred_skills": [
      "AI 관련 프로젝트 경험",
      "서비스 기획 또는 개발 경험"
    ],
    "tools": [],
    "culture_keywords": [
      "대기업",
      "모빌리티",
      "IT 서비스"
    ],
    "benefits": [],
    "cover_letter_questions": [
      "현대오토에버의 해당 직무에 지원한 이유와 앞으로 현대오토에버에서 키워 나갈 커리어 계획을 작성해 주시기 바랍니다.",
      "지원 직무와 관련하여 어떠한 역량을 강점으로 가지고 있는지, 그 역량을 갖추기 위해 무슨 노력과 경험을 했는지 작성해 주시기 바랍니다."
    ],
    "deadline": "2026-07-13T13:00:00+09:00"
  },

  "slack_messages": {
    "raw": {
      "message_title": "2026년 3분기 현대오토에버 신입사원 모집",
      "message_body": "현대오토에버㈜ · 신입 · 서울 · 정규직 · 마감 2026.07.13 13:00",
      "thread_summary": "잡코리아 원문 기준으로 표시한 공고입니다."
    },
    "business": {
      "message_title": "현대오토에버 신입 공고 공유드립니다",
      "message_body": "현대오토에버에서 신입 정규직 채용을 진행 중입니다. 서울 근무이며, AI/SW 관련 경험이 있는 분에게 적합해 보입니다. 마감은 7월 13일 13시입니다.",
      "thread_summary": "주요 포인트는 신입 채용, AI/SW 직무, 자소서 문항 2개입니다."
    },
    "friendly": {
      "message_title": "현대오토에버 신입 공고 하나 괜찮아 보여요",
      "message_body": "서울 근무 신입 공고고, AI/SW 쪽 경험 있으면 한 번 볼 만해요. 자소서 문항도 직무 지원 이유랑 관련 경험 중심이라 준비 방향은 꽤 명확한 편입니다.",
      "thread_summary": "관심 있으면 ⭐ 찍어두고 자소서 초안부터 써보면 좋을 듯해요."
    }
  },

  "ui": {
    "channel_ids": ["ai_developer", "pm"],
    "default_tone": "business",
    "display_company": "현대오토에버㈜",
    "display_avatar_text": "현",
    "display_color": "#1264a3"
  },

  "status": {
    "parse_status": "success",
    "ai_profile_status": "success",
    "slack_message_status": "success",
    "last_error": null
  }
}
```

## 3. 화면에서 쓰는 값

채널 메시지에는 아래 값을 사용한다.

```json
{
  "company": "현대오토에버㈜",
  "title": "현대오토에버 신입 공고 공유드립니다",
  "body": "현대오토에버에서 신입 정규직 채용을 진행 중입니다. 서울 근무이며, AI/SW 관련 경험이 있는 분에게 적합해 보입니다. 마감은 7월 13일 13시입니다.",
  "source_url": "https://www.jobkorea.co.kr/Recruit/GI_Read/49435790"
}
```

이 값은 현재 선택된 톤에 따라 달라진다.

```js
const tone = "business";
const message = job.slack_messages[tone];
```

## 4. 왜 이렇게 나누는가

- `raw`는 원본 확인용
- `job_profile`은 로컬 매칭용
- `slack_messages`는 화면 표시용

이렇게 나눠야 원본 데이터는 유지하면서도, 화면에서는 Slack처럼 자연스럽게 보여줄 수 있다.
