-- 오프라인 행사 방명록.
-- 한 사람이 글 하나를 남기고 고쳐 쓰는 형태라 user_id에 unique를 건다.
create table if not exists guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- 목록은 항상 최신순으로 통째로 읽는다
create index if not exists guestbook_entries_created_at_idx
  on guestbook_entries (created_at desc);

-- 다른 표와 같이 서버(service role)로만 접근한다
alter table guestbook_entries enable row level security;
