-- 방명록 상한 확인과 INSERT를 한 트랜잭션으로 묶어 동시 요청 우회를 막는다.
create or replace function create_guestbook_entry(
  p_user_id uuid,
  p_message text,
  p_max_per_user integer
)
returns table (
  id uuid,
  user_id uuid,
  message text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 같은 회원의 요청만 직렬화한다. 서로 다른 회원의 방명록 등록은 병렬로 처리된다.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  if (select count(*) from guestbook_entries where guestbook_entries.user_id = p_user_id) >= p_max_per_user then
    raise exception 'GUESTBOOK_LIMIT' using errcode = 'P0001';
  end if;

  return query
    insert into guestbook_entries (user_id, message)
    values (p_user_id, p_message)
    returning guestbook_entries.id,
      guestbook_entries.user_id,
      guestbook_entries.message,
      guestbook_entries.created_at,
      guestbook_entries.updated_at;
end;
$$;

revoke all on function create_guestbook_entry(uuid, text, integer) from public, anon, authenticated;
grant execute on function create_guestbook_entry(uuid, text, integer) to service_role;
