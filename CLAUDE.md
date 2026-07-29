# YSRC SUMMER FEST 2026 — 온라인 위크 이벤트

양산 러닝크루(YSRC)의 **2026년 8월 여름 이벤트 전용** 웹앱입니다.
Next.js 15 (App Router) + Supabase + Vercel.

## ⛔ 이 레포의 범위 (중요)

이 레포는 **여름 이벤트 한 건**만 담당합니다. 아래 기능은 **이 레포에 속하지 않습니다.**

- 대회(마라톤 등) 참가 신청·참가 여부 관리
- 대회 기록·개인 기록 저장 및 조회
- 대회 추천·건의 접수
- 그 밖에 이벤트 기간과 무관하게 상시 운영되는 크루 관리 기능

위 기능들은 **별도 레포(크루 대회/기록 관리 웹)**의 소관입니다.
과거에 `race_suggestions` 테이블과 대회 건의 API·UI가 실수로 이 레포에 추가되어
되돌린 이력이 있습니다.

**이런 작업 요청을 받으면 코드를 수정하지 말고, 먼저 레포를 잘못 찾은 것이 아닌지
사용자에게 확인하세요.** 사용자가 "이 레포가 맞다"고 명시적으로 확인한 경우에만 진행합니다.

이 레포가 다루는 것: 빙고 인증, 달리기 로또, 28일 챌린지 **안내**, 8/15 오프라인 행사 안내, 관리자 운영 화면.

## 구조

```
app/
  page.js        입장 (닉네임 + PIN 4자리, 토큰 localStorage)
  draw/          빙고판 뽑기 (1인 1회 다시 뽑기)
  board/         내 빙고판 + 사진 인증
  lotto/         로또 응모 / 추첨 결과
  feed/          진행률 랭킹 + 최근 활동
  hall/          명예의 전당 (후원자·빙고 달성·로또 당첨·챌린지 수상자)
  admin/draw/    행사장용 추첨 화면 (릴 애니메이션, 1등 없으면 다음 차수)
  challenge/     28일 챌린지 안내 (정적)
  event/         오프라인 행사 안내 + 네이버 지도
  admin/         관리자
  api/           서버 라우트 — Supabase는 여기서만 접근
lib/             db·auth·bingo·lotto·settings·event·hall·demo 유틸
                 (후원자·챌린지 수상자 명단은 lib/hall.js에 하드코딩)
supabase/        schema.sql + migrations/
tests/           vitest (lib 순수 함수만)
```

## 개발

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # vitest
npm run build
```

`.env.local`에 `DEMO_MODE=true`를 넣으면 Supabase 없이 메모리 데이터로 전체 흐름을
확인할 수 있습니다. 모든 API 라우트가 데모 분기를 먼저 탑니다.

## 작업 시 주의

- **Supabase service role 키는 서버 전용**입니다. `lib/db.js`의 `sb()` 밖에서 쓰지 마세요.
- 사진은 비공개 버킷 + 서명 URL로만 노출합니다. 공개 URL을 만들지 마세요.
- 캐시 계층이 여러 개입니다: 설정 5초(`lib/settings.js`), 서명 URL 55분(`lib/db.js`),
  클라이언트 API 20초(`lib/hooks.js`). 인증 토큰은 폐기가 즉시 반영되도록 캐시하지 않습니다.
  설정을 바꾸는 관리자 동작 뒤에는 `invalidateSettingsCache()`를 호출하세요.
- API 라우트에는 테스트가 없습니다. 검증은 `DEMO_MODE=true`로 `next start` 후
  curl로 실제 호출해 확인하는 방식을 씁니다.
- `NEXT_PUBLIC_*` 값은 빌드 시점에 인라인됩니다. 바꾼 뒤에는 재빌드가 필요합니다.
