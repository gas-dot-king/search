-- 방명록을 한 사람당 하나에서 여러 개로 바꾼다.
-- 앞선 마이그레이션을 아직 돌리지 않았어도 안전하도록 if exists / if not exists로 쓴다.
alter table guestbook_entries
  drop constraint if exists guestbook_entries_user_id_key;

-- 저장 전에 내가 쓴 개수를 세므로 user_id 인덱스를 둔다
create index if not exists guestbook_entries_user_id_idx
  on guestbook_entries (user_id);
