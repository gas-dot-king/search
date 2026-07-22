# 🏃 러닝크루 온라인 위크

2주 이벤트용 웹앱 — **빙고 인증** + **달리기 로또**.
Next.js (Vercel) + Supabase (DB/Storage).

- 이벤트 기간: **2026-08-01 ~ 08-13** (사진 업로드) · **08-15 추첨**
- 닉네임 + 숫자 4자리로 가입, 같은 기기 재방문 시 자동 입장
- 빙고: 24개 항목 중 카테고리별 5~6개(합 16개) 랜덤 → 4×4 빙고판 확정 → 칸별 사진 인증
- 로또: 러닝 기록 `xx.xx km` 4자리 + 인증 사진으로 응모 → 추첨 시 자리별 일치 수로 당첨
- 사진은 브라우저에서 리사이즈(긴 변 1080px) 후 업로드, 비공개 버킷 + 서명 URL로만 노출

## 1. Supabase 셋업 (약 5분)

1. https://supabase.com 에서 새 프로젝트 생성
2. **SQL Editor** → `supabase/schema.sql` 내용 붙여넣고 실행 (테이블 + 빙고 항목 + 기본 설정 생성)
3. **Storage** → New bucket → 이름 `photos`, **Public 체크 해제** (비공개)
4. **Project Settings → API** 에서 복사:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ 절대 공개 금지)

## 2. 로컬 실행

```bash
cp .env.example .env.local   # 값 채우기 (Windows: copy .env.example .env.local)
npm install
npm run dev                  # http://localhost:3000
```

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
  - 회원별 빙고판·로또 사진 열람, 부적절한 사진 삭제
  - 공지 배너, 로또 최대 응모 장수(1~3장) 변경
  - **8/15 추첨**: "당첨 번호 추첨하기" 버튼 → 자리별 0~9 랜덤. 추첨 즉시 모든 회원의 로또 탭이 결과 화면으로 바뀜
- **기간 변경**: Supabase `settings` 테이블에서 `upload_start`/`upload_end` 수정 (ISO 형식, +09:00)
- **빙고 항목 수정**: 이벤트 시작 전이라면 `bingo_items` 테이블에서 수정 (시작 후 수정하면 이미 뽑은 사람과 항목이 어긋나므로 금지)

## 5. 규칙 (앱에 안내됨)

- 같은 날 기록은 ①기록 달성 카테고리에서 가장 높은 항목 1개만 인정 (수동 확인)
- 로또 기록이 10km 미만이면 앞자리 0 (5.24km → `05.24`)
- 로또는 1인 최고 일치 1장만 인정, 2개 이상 일치 시 당첨
- 업로드/응모는 기간 내에만 가능 (서버에서 차단)

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
```
