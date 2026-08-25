# VocabWalk BUILD 084 — D1 서버 사용량 제한 설정

이 설정은 선택사항이지만, 테스터가 여러 명이면 강력 추천.

## Cloudflare 대시보드

1. Cloudflare → Compute → D1
2. Create database
3. 이름: `vocabwalk-usage`
4. 생성 후 `Workers & Pages` → `vocabwalkai`
5. 위쪽 `Bindings`
6. `Add binding`
7. `D1 database`
8. Variable name: `USAGE_DB`
9. Database: `vocabwalk-usage`
10. 저장 / Deploy

별도 SQL 입력은 필요 없음.
BUILD 084 Worker가 첫 요청 때 필요한 `monthly_usage` 테이블을 자동 생성함.

## 선택 변수

Worker → Settings → Runtime variables:

- `MONTHLY_PHOTO_LIMIT` = `150`
- `MAX_OPENAI_CONCURRENCY` = `4`
- `USAGE_TIMEZONE` = `Asia/Seoul`

위 값은 안 넣어도 기본값이 각각 150 / 4 / Asia/Seoul임.

## 확인

Worker 주소를 브라우저로 열었을 때:

```json
{
  "build": 84,
  "durable_quota_configured": true,
  "soft_openai_concurrency": 4,
  "monthly_photo_limit": 150
}
```

`durable_quota_configured: true`이면 서버 제한 활성화 완료.
