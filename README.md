# VocabWalk AI v0.5 SPEED — GitHub Pages / PWA

## 가장 간단한 배포

1. 이 폴더 안의 **파일 전부**를 새 GitHub 저장소의 `main` 브랜치에 업로드합니다.
2. GitHub 저장소 → **Settings → Pages**.
3. `Build and deployment`의 `Source`를 **GitHub Actions**로 선택합니다.
4. Actions의 `Deploy VocabWalk to GitHub Pages`가 끝나면 Pages 주소가 생깁니다.
5. 그 주소를 휴대폰에서 엽니다.
6. 앱 상단 **📲 설치**를 누르거나 브라우저 메뉴에서 **홈 화면에 추가 / 앱 설치**를 선택합니다.

GitHub Pages 주소 형태:
`https://사용자명.github.io/저장소이름/`

## AI 연결

GitHub Pages는 정적 사이트이므로 OpenAI API 키를 저장소 코드에 넣으면 안 됩니다.

현재 개인 테스트판은:
- 앱에서 처음 한 번 API 키 입력
- 해당 브라우저 localStorage에 저장
- 다음 실행부터 자동 연결

즉 **GitHub 저장소나 HTML/JS 파일에는 API 키가 들어가지 않습니다.**

공개 서비스로 다른 사용자에게 배포할 단계가 오면 OpenAI 키는 Cloudflare Worker / 서버 / 서버리스 함수 등 서버측 비밀 환경변수로 옮겨야 합니다.

## v0.5 SPEED 기능

- 한 번에 이미지 최대 8장 선택
- 데스크톱 드래그앤드롭
- 사이트 OCR 없이 원본 이미지를 OpenAI 이미지 입력으로 직접 분석
- 1차 사진 인식 후 OpenAI Web Search를 강제로 호출해 철자/뜻 검증
- 웹 검증 성공한 결과만 단어장 저장 가능
- 메인 화면의 사진 추가 카드를 제거하고 `오늘의 단어`로 교체
- 오늘의 단어:
  - 현재 단어장과 중복 회피
  - 현재 학습 단어와 연결되는 어휘
  - 한국 수능/모의고사 독해에 유용한 어휘
  - 웹 검색 확인
  - 5개씩 계속 추가 생성
- 즐겨찾기 단어만 시험
- 걷기 암기에서 `앎` 2회 → 자동 시험 졸업
- 보관함에서 `시험 넣기`로 언제든 복귀
- 의미 기반 AI 채점
- 백업/복원
- PWA / 홈 화면 설치
- GitHub Actions 자동 Pages 배포

## 비용 주의

사진 1회 분석은 기본적으로:
1. 이미지 분석 API 호출
2. 웹 검색 검증 API 호출

두 단계이므로 단순 1회 분석보다 API 사용량이 더 큽니다.
`오늘의 단어`도 5개를 새로 가져올 때 웹 검색 도구를 사용합니다.

## 파일 구조

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `service-worker.js`
- `.nojekyll`
- `icons/`
- `.github/workflows/pages.yml`

별도 npm / Node.js / 빌드 과정은 없습니다.


## v0.5 SPEED 변경점

- 사진 분석 2회 API 호출 → **이미지 인식 + 웹 검색 검증을 1회 Responses 요청으로 통합**
- `gpt-5.6`(Sol) 대신 사진 작업은 `gpt-5.6-terra`, 추천/채점은 `gpt-5.6-luna` 우선
- 큰 사진은 전송 지연을 줄이기 위해 최대 2,048px / 약 2.5MP 수준을 목표로 선명하게 최적화
  - OCR을 사이트에서 하는 것이 아니라, 전송 크기만 줄인 뒤 AI가 이미지를 직접 읽습니다.
- 429 / 5xx / 네트워크 오류에 자동 재시도 + 지수 백오프
- 요청 시간 제한 추가
- 사진 분석과 오늘의 단어에 **예상 진행률 0~100% 표시**
- 오늘의 단어는 웹 검색 1회로 최대 15개를 미리 받아 캐시하고, 사용자에게 5개씩 보여줌
  - 첫 호출 뒤 `5개 더`는 캐시가 남아 있으면 즉시 표시
- Service Worker 캐시를 v5로 갱신하고 즉시 활성화

### 이미 v0.4를 GitHub Pages에 올린 경우
새 ZIP의 파일들을 기존 저장소에 덮어쓰면 됩니다.
특히 아래 4개는 반드시 교체:
- `index.html`
- `app.js`
- `styles.css`
- `service-worker.js`

GitHub Actions 배포 완료 후 설치된 앱을 완전히 닫았다가 다시 열어주세요.
