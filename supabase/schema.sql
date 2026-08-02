-- =====================================================
-- 러닝크루 온라인 위크 스키마
-- Supabase SQL Editor에 붙여넣고 실행하세요.
-- 실행 후 Storage에서 비공개 버킷 "photos"를 만드세요.
-- =====================================================

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  nickname text unique not null,
  pin_hash text not null,
  token_hash text unique not null,
  token_expires_at timestamptz not null default (now() + interval '30 days'),
  failed_pin_attempts integer not null default 0,
  pin_locked_at timestamptz,
  redraw_used boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists bingo_items (
  id serial primary key,
  category int not null,          -- 1 기록달성 / 2 시간·장소 탐험 / 3 크루 소통·재미
  content text not null
);

-- 회원별 빙고판: user_id + position(0~15) 이 한 칸
create table if not exists cells (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  position int not null check (position between 0 and 15),
  item_id int not null references bingo_items(id),
  photo_path text,
  uploaded_at timestamptz,
  uploaded_date date,
  -- 인증 검토용 촬영 정보(EXIF). 스크린샷 등 EXIF가 없는 사진은 null이다.
  photo_meta jsonb,
  unique (user_id, position)
);

create table if not exists lotto_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  slot int not null check (slot between 1 and 2),
  digits char(4) not null,        -- "05.24" → "0524"
  photo_path text not null,
  -- 인증 검토용 촬영 정보(EXIF). 자기가 신고한 기록이라 빙고와 같은 기준으로 본다.
  photo_meta jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, slot)
);

-- 선물이 걸린 4줄 선착순 확정 명단.
-- 순위는 남아 있는 사진으로 매번 계산하는데, 확정한 사람은 그때의 달성 시각으로
-- 고정해 이후 사진이 바뀌어도 선물 명단이 뒤집히지 않게 한다.
create table if not exists four_line_awards (
  user_id uuid primary key references users(id) on delete cascade,
  achieved_at timestamptz not null,
  confirmed_at timestamptz not null default now(),
  note text
);

-- 오프라인 행사 방명록: 한 사람이 여러 개 남기고, 자기 글을 고치거나 지운다
create table if not exists guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value text not null default ''
);

create table if not exists storage_cleanup_tasks (
  path text primary key,
  created_at timestamptz not null default now(),
  last_error text,
  attempts integer not null default 0
);

-- 사용자별 로또 목록 조회·개수 확인·생성일 정렬을 위한 복합 인덱스
create index if not exists lotto_entries_user_created_at_idx
  on lotto_entries (user_id, created_at);

-- 방명록은 항상 최신순으로 통째로 읽고, 저장 전에 내가 쓴 개수를 센다
create index if not exists guestbook_entries_created_at_idx
  on guestbook_entries (created_at desc);
create index if not exists guestbook_entries_user_id_idx
  on guestbook_entries (user_id);

-- 4줄 확정 명단은 항상 달성 시각 순으로 읽는다
create index if not exists four_line_awards_achieved_at_idx
  on four_line_awards (achieved_at);

-- 관리자 검토 큐: 전 회원의 인증 사진을 올라온 순서대로 훑는다
create index if not exists cells_uploaded_at_idx
  on cells (uploaded_at desc)
  where photo_path is not null;

-- 모든 접근이 서버(service role)를 통해서만 이루어지므로 RLS로 외부 접근 차단
alter table users enable row level security;
alter table bingo_items enable row level security;
alter table cells enable row level security;
alter table lotto_entries enable row level security;
alter table guestbook_entries enable row level security;
alter table four_line_awards enable row level security;
alter table settings enable row level security;
alter table storage_cleanup_tasks enable row level security;

-- =====================================================
-- 기본 설정
-- 업로드·응모 기간: 2026-08-01 06:00 ~ 08-14 18:00 (KST), 추첨 08-15
-- 이 기간 밖에서는 서버가 업로드·응모를 거부하고, 화면은 보기 전용이 된다.
-- =====================================================
insert into settings (key, value) values
  ('upload_start', '2026-08-01T06:00:00+09:00'),
  ('upload_end',   '2026-08-14T18:00:00+09:00'),
  ('draw_date',    '2026-08-15'),
  ('winning_numbers', ''),
  -- 1등이 없어 넘어간 지난 차수 번호들. 예: ["010","473"]
  ('lotto_rounds', '[]'),
  ('notice', ''),
  ('event_guide', '{"date":"2026-08-15","hours":"오전 9시 ~ 오후 1시","venue":"양주 문화체육센터","parkingInfo":"건물 하부 공터에 주차 가능합니다. 자세한 위치는 사진으로 추후 안내할게요.","mapUrl":"https://naver.me/59vQDKHt","lat":null,"lng":null,"timeline":[{"id":"freerun","time":"05:00 ~ 06:00","title":"8.15 러닝 (프리런)","activities":["장소: 양주 문화체육센터","8.15km 인증 도전 · 자신이 뛸 수 있는 만큼 자유 참여"]},{"id":"kickoff","time":"08:30","title":"공식 일정 시작","activities":[]},{"id":"indoor","time":"09:00 ~ 12:30","title":"실내 레크레이션","activities":[]},{"id":"wrapup","time":"12:30 ~ 13:00","title":"마무리 정리","activities":[]}]}')
on conflict (key) do nothing;

-- =====================================================
-- 빙고 항목 24개
-- =====================================================
insert into bingo_items (category, content) values
  -- ① 러닝 기록·운동 달성 (7)
  (1, '2km 이상 달리기'),
  (1, '3km 이상 달리기'),
  (1, '5km 이상 달리기'),
  (1, '10km 이상 달리기'),
  (1, '30분 이상 달리기'),
  (1, '30분 이상 걷기'),
  (1, '60분 이상 걷기'),
  -- ② 시간·장소·러닝 탐험 (8)
  (2, '새벽 러닝 인증하기 (오전 6시 이전)'),
  (2, '아침 러닝 인증하기 (오전 6시~9시)'),
  (2, '저녁 러닝 인증하기 (오후 6시~9시)'),
  (2, '주말에 한 번 달리기'),
  (2, '양산이 아닌 곳에서 러닝'),
  (2, '양산 랜드마크와 인증사진 남기기'),
  (2, '달리면서 발견한 예쁜 풍경 찍기'),
  (2, '러닝 중 만난 강아지·고양이 인증하기'),
  -- ③ 크루 소통·재미 인증 (9)
  (3, '일정 또는 정기런 참석하기'),
  (3, '크루원 한 명 이상과 함께 인증사진 찍기'),
  (3, '크루원 러닝 인증글에 댓글 달기'),
  (3, '러닝 플레이리스트 한 곡 추천하기'),
  (3, '러닝화 사진 인증하기'),
  (3, '러닝 후 물 마시는 사진 인증하기'),
  (3, '러닝 후 먹은 음식 인증하기'),
  (3, '빨간색 물건과 인증사진 찍기'),
  (3, 'Y·S·R·C 중 한 글자가 보이게 인증사진 찍기');
