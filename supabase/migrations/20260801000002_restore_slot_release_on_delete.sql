-- 사진을 지우면 그날의 인증도 취소되는 원래 방식으로 되돌린다.
--
-- 20260801000001에서 "지운 칸도 하루 자리를 계속 차지한다"로 바꿨다가 되돌린다.
-- 그 마이그레이션을 실행하지 않았다면 이 파일은 원래 함수를 그대로 다시 만들 뿐이라
-- 아무것도 달라지지 않는다. 실행했다면 이 파일이 되돌려 준다.
--
-- 규칙: 하루 3칸, 카테고리당 1칸. 사진을 지우면 그 자리는 다시 비어,
-- 같은 날 다른 칸(같은 카테고리 포함)에 쓸 수 있다.
create or replace function claim_bingo_photo(
  p_user_id uuid,
  p_position integer,
  p_photo_path text,
  p_uploaded_at timestamptz default now()
)
returns table (old_path text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cell_id uuid;
  v_old_path text;
  v_old_date date;
  v_category integer;
  v_day date := (p_uploaded_at at time zone 'Asia/Seoul')::date;
  v_daily_count integer;
  v_category_count integer;
begin
  -- Serialize claims for one account, including claims for different cells.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select c.id, c.photo_path, c.uploaded_date, b.category
  into v_cell_id, v_old_path, v_old_date, v_category
  from cells c
  join bingo_items b on b.id = c.item_id
  where c.user_id = p_user_id and c.position = p_position
  for update;

  if not found then
    raise exception 'BINGO_CELL_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_old_path is null or v_old_date is distinct from v_day then
    select count(*) into v_daily_count
    from cells
    where user_id = p_user_id
      and id <> v_cell_id
      and photo_path is not null
      and uploaded_date = v_day;
    if v_daily_count >= 3 then
      raise exception 'BINGO_DAILY_LIMIT' using errcode = 'P0001';
    end if;

    select count(*) into v_category_count
    from cells c
    join bingo_items b on b.id = c.item_id
    where c.user_id = p_user_id
      and c.id <> v_cell_id
      and c.photo_path is not null
      and c.uploaded_date = v_day
      and b.category = v_category;
    if v_category_count >= 1 then
      raise exception 'BINGO_CATEGORY_DAILY_LIMIT' using errcode = 'P0001';
    end if;
  end if;

  update cells
  set photo_path = p_photo_path,
      uploaded_at = p_uploaded_at,
      uploaded_date = v_day
  where id = v_cell_id;

  old_path := v_old_path;
  return next;
end;
$$;

-- 자리를 유지하던 동안 지워진 칸에는 uploaded_date만 남아 있을 수 있다.
-- 사진 없는 칸은 인증이 취소된 상태이므로 날짜도 비워 상태를 맞춘다.
update cells set uploaded_date = null where photo_path is null and uploaded_date is not null;

revoke all on function claim_bingo_photo(uuid, integer, text, timestamptz) from public, anon, authenticated;
grant execute on function claim_bingo_photo(uuid, integer, text, timestamptz) to service_role;
