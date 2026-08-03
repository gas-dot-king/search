-- 8/4 하루짜리 긴급 복구 컨셉 이벤트.
-- 일반 빙고·로또 기록과 분리해 진행도와 추첨 결과에 영향을 주지 않는다.
create table if not exists recovery_entries (
  ticket_no bigint generated always as identity primary key,
  event_key text not null,
  user_id uuid not null references users(id) on delete cascade,
  photo_path text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (event_key, user_id)
);

create index if not exists recovery_entries_event_created_idx
  on recovery_entries (event_key, created_at desc);

alter table recovery_entries enable row level security;

insert into settings (key, value) values
  ('recovery_event', '{"key":"server-overload-20260804","noticeAt":"2026-08-03T18:00:00+09:00","startAt":"2026-08-04T00:00:00+09:00","endAt":"2026-08-05T00:00:00+09:00","enabled":true,"winningDigit":"","prizeText":"서버 복구 공로상"}')
on conflict (key) do nothing;

