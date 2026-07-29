# 🏃 러닝크루 온라인 위크

2주 이벤트용 웹앱 — **빙고 인증** + **달리기 로또**.
Next.js (Vercel) + Supabase (DB/Storage).

- 이벤트 기간: **2026-08-01 06:00 ~ 08-14 18:00** (사진 업로드·로또 응모) · **08-15 추첨**
  - 이 기간 밖에는 빙고판·응모 내역을 **보기만** 가능하고, 업로드·응모·취소는 서버에서 거부됩니다.
- 닉네임 + 숫자 4자리로 가입, 같은 기기 재방문 시 자동 입장. PIN을 10회 틀리면 잠기며 관리자가 `0000`으로만 초기화할 수 있습니다.
- 빙고: 24개 항목 중 카테고리별 ①4 / ②6 / ③6개(합 16개) 랜덤 → 4×4 빙고판 확정 → 칸별 사진 인증 (다시 뽑기 1인 1회, 하루 최대 3칸·카테고리별 1칸)
- 로또: 러닝 기록 `xx.xx km` 4자리 + 인증 사진으로 응모 → 추첨 시 자리별 일치 수로 당첨
- 사진은 브라우저에서 리사이즈(긴 변 1200px, 4MB 이하) 후 업로드, 비공개 버킷 + 서명 URL로만 노출

## 1. Supabase 셋업 (약 5분)

1. https://supabase.com 에서 새 프로젝트 생성
2. **SQL Editor** → `supabase/schema.sql` 내용 붙여넣고 실행 (테이블 + 빙고 항목 + 기본 설정 생성)
3. 이어서 `supabase/migrations/`의 SQL 파일을 파일명 순서대로 실행합니다. 기존 운영 DB는 아직 적용하지 않은 migration만 실행하세요. 특히 `20260730000000_harden_accounts_and_bingo.sql`은 PIN 잠금, 세션 해시, 일일 빙고 제한과 원자적 재추첨을 추가하므로 **앱 배포 전에 반드시 적용**해야 합니다.
   - 이 migration은 기존 로그인 토큰을 안전한 해시로 이관하며, 최대 30일의 기존 세션은 유지됩니다.
   - migration 실행 계정에는 `pgcrypto` 확장 생성 권한이 필요합니다.
4. **Storage** → New bucket → 이름 `photos`, **Public 체크 해제** (비공개)
5. **Project Settings → API** 에서 복사:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ 절대 공개 금지)

## 2. 로컬 실행

```bash
cp .env.example .env.local   # 값 채우기 (Windows: copy .env.example .env.local)
npm install
npm run dev                  # http://localhost:3000
```

### Supabase 없이 UI만 확인하기

Supabase 프로젝트를 연결하지 않고 화면 흐름을 확인하려면 `.env.local`에 아래처럼 설정하세요.

```env
DEMO_MODE=true
ADMIN_PASSWORD=demo
```

데모 모드에서는 가입, 빙고판 뽑기·사진 인증, 로또 2장 응모, 피드와 관리자 화면을 메모리 데이터로 사용할 수 있습니다. 데이터는 개발 서버를 재시작하면 초기화되며, 운영 환경에서는 반드시 `DEMO_MODE=false`로 설정해야 합니다.

업로드·응모 기간 제한은 데모 모드에서도 똑같이 적용됩니다. 기간 밖 화면(보기 전용)이 아니라 업로드 흐름을 확인하려면 `/admin`의 기간 편집에서 시작·마감 시각을 함께 현재 시각이 포함되도록 바꾸세요. 데모 관리자 비밀번호는 `demo`입니다.

## 3. Vercel 배포

1. 이 폴더를 GitHub 저장소로 푸시
2. https://vercel.com → New Project → 저장소 선택
3. **Environment Variables** 3개 등록:
   | 이름 | 값 |
   |---|---|
   | `SUPABASE_URL` | Supabase Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 |
   | `ADMIN_PASSWORD` | 관리자 페이지 비밀번호 (직접 정하기) |
4. Deploy → 나온 주소를 단톡방에 공유

## 4. 운영 방법

- **관리자 페이지**: `/admin` (URL 직접 입력) → `ADMIN_PASSWORD` 로 입장
  - 회원별 빙고판·로또 사진 열람, 부적절한 사진 삭제, 빙고판 초기화, PIN `0000` 초기화
  - 공지 배너, 업로드 기간, 행사 안내와 장소·지도 링크 편집
  - **8/15 추첨**: "당첨 번호 추첨하기" 버튼 → 자리별 0~9 랜덤. 추첨 즉시 모든 회원의 로또 탭이 결과 화면으로 바뀜
- **기간 변경**: 관리자 화면에서 시작·마감 시각을 함께 저장합니다. 직접 DB 수정은 비상 상황에서만 사용하세요.
- **빙고 항목 수정**: 이벤트 시작 전이라면 `bingo_items` 테이블에서 수정 (시작 후 수정하면 이미 뽑은 사람과 항목이 어긋나므로 금지)

## 5. 규칙 (앱에 안내됨)

- 하루에 각 카테고리에서 1개씩, 최대 3개까지 인증 가능 (서버와 DB에서 강제)
- 로또 기록이 10km 미만이면 앞자리 0 (5.24km → `05.24`)
- 로또는 거리의 1의 자리와 소수점 두 자리를 추첨하며, 세 자리 모두 일치하면 1등
- 업로드/응모/취소는 기간 내에만 가능 (서버에서 차단, 화면에서도 버튼 잠금)

## 구조

```
app/
  page.js          입장 (가입/로그인, 자동 입장)
  draw/            빙고 뽑기 (최초 1회)
  board/           내 빙고판 + 사진 업로드
  lotto/           로또 응모 / 추첨 결과
  feed/            진행률 랭킹 + 최근 활동
  admin/           관리자
  api/             서버 라우트 (Supabase는 여기서만 접근)
lib/               db·auth·bingo·settings·클라이언트 유틸
supabase/schema.sql  DB 스키마 + 시딩
supabase/migrations/ 운영 DB 변경 이력
```

## 검증

```bash
npm run check       # 단위 테스트 + 프로덕션 빌드
npm run audit:prod  # 운영 의존성 취약점 검사
```

GitHub Actions도 `main` 푸시와 PR마다 같은 검증을 수행합니다.
