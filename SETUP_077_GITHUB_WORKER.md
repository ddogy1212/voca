# VocabWalk BUILD 077 — GitHub Pages + 최소 서버 설정

이 버전은 **기존 GitHub Pages를 그대로 사용**하고, OpenAI API 키만 Cloudflare Worker 한 개에 숨깁니다.

## 한 번만 하면 되는 서버 설정

### 1) GitHub
`vocabwalk_077_github_update.zip` 안의 웹 파일을 기존 저장소에 덮어쓰고 Commit합니다.
`worker.js`는 GitHub에 있어도 API 키가 들어 있지 않아서 안전하지만, 실제 서버 코드는 Cloudflare에 한 번 붙여넣어야 합니다.

### 2) Cloudflare Worker 만들기
1. Cloudflare 가입/로그인
2. **Workers & Pages → Create application → Hello World(또는 기본 Worker) → Deploy**
3. 생성된 Worker에서 **Edit code**
4. 기본 코드를 전부 지우고 이 폴더의 `worker.js` 전체를 붙여넣기
5. **Deploy**

그러면 주소가 이런 형태로 생깁니다.
`https://vocabwalk-beta.내계정.workers.dev`

### 3) Secret 2개만 넣기
Worker → **Settings → Variables and Secrets → Add**

첫 번째:
- Type: **Secret**
- Name: `OPENAI_API_KEY`
- Value: VocabWalk 전용 OpenAI API 키

두 번째:
- Type: **Secret**
- Name: `BETA_INVITE_CODES`
- Value 예시:
`owner:ME-7291,friend1:A4M8-XQ2,friend2:C9P3-KL7`

저장/Deploy.

`ALLOWED_ORIGIN`은 선택사항입니다. 더 잠그고 싶다면 일반 Text 변수로 GitHub Pages 원본(origin), 예를 들어 `https://아이디.github.io` 를 넣으세요. 저장소 경로(`/vocabwalk`)는 넣지 않습니다.

### 4) 네 폰에서 연결
기존 GitHub Pages 사이트를 열고 상단 AI 버튼 →
- AI 서버 주소: 방금 받은 `https://...workers.dev`
- 초대코드: owner 코드
- `초대코드 연결`

정상 연결되면 **🔗 친구용 서버 연결 링크 복사**를 누릅니다.

### 5) 친구에게 보내기
친구에게는
1. 방금 복사한 링크
2. 친구용 초대코드 하나
만 보내면 됩니다.

복사 링크에는 Worker 주소만 들어 있고 **OpenAI 키와 초대코드는 들어 있지 않습니다.** 친구가 링크를 열면 Worker 주소는 자동 저장되고, 초대코드만 입력하면 됩니다.

## 비용 안전장치
- 자동 AI: `gpt-5.6-luna`만 사용
- Sol: Worker 코드상 선택 불가능
- Terra: 앱에서 사용자가 `정밀 재검사`를 직접 누른 경우만
- 자동 재시도: 0회
- 한 기기 월 사진 150장
- 같은 사진 캐시: 사진 한도 차감 0
- Worker 간단 burst 제한: 초대코드별 최대 약 40 요청/분

## 주의
친구 2~3명 무료 베타 기준입니다. 월 150장 제한은 아직 각 기기 localStorage 기준이라 브라우저 데이터를 지우면 초기화할 수 있습니다. 돈을 받는 공개 서비스로 갈 때는 서버 DB 한도로 바꿔야 합니다.
