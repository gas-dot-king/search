-- =====================================================
-- 러닝크루 온라인 위크 스키마
-- Supabase SQL Editor에 붙여넣고 실행하세요.
-- 실행 후 Storage에서 비공개 버킷 "photos"를 만드세요.
-- =====================================================

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  nickname text unique not null,
  pin_hash text not null,
  token text unique not null,
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
  unique (user_id, position)
);

create table if not exists lotto_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  slot int not null check (slot between 1 and 2),
  digits char(4) not null,        -- "05.24" → "0524"
  photo_path text not null,
  created_at timestamptz not null default now(),
  unique (user_id, slot)
);

create table if not exists settings (
  key text primary key,
  value text not null default ''
);

-- 사용자별 로또 목록 조회·개수 확인·생성일 정렬을 위한 복합 인덱스
create index if not exists lotto_entries_user_created_at_idx
  on lotto_entries (user_id, created_at);

-- 모든 접근이 서버(service role)를 통해서만 이루어지므로 RLS로 외부 접근 차단
alter table users enable row level security;
alter table bingo_items enable row level security;
alter table cells enable row level security;
alter table lotto_entries enable row level security;
alter table settings enable row level security;

-- =====================================================
-- 기본 설정
-- 업로드·응모 기간: 2026-08-01 06:00 ~ 08-14 18:00 (KST), 추첨 08-15
-- 이 기간 밖에서는 서버가 업로드·응모를 거부하고, 화면은 보기 전용이 된다.
-- =====================================================
insert into settings (key, value) values
  ('upload_start', '2026-08-01T06:00:00+09:00'),
  ('upload_end',   '2026-08-14T18:00:00+09:00'),
  ('draw_date',    '2026-08-15'),
  ('max_lotto_entries', '2'),
  ('winning_numbers', ''),
  ('notice', ''),
  ('event_guide', '{"hours":"오전 7시 ~ 오후 1시","venue":"양주 문화체육센터","timeline":[{"id":"running","time":"07:00 ~ 08:00","title":"간단한 러닝","activities":[]},{"id":"breakfast","time":"08:00 ~ 09:00","title":"아침 식사","activities":[]},{"id":"indoor","time":"09:00 ~ 13:00","title":"실내 레크레이션","activities":[]}]}')
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
