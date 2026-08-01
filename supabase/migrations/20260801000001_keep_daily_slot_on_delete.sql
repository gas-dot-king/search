-- 사진을 지운 칸에 다시 올릴 때 하루 제한에 막히지 않게 한다.
--
-- 전에는 삭제하면서 uploaded_date까지 지워, 그 칸이 "오늘 쓰지 않은 칸"이 됐다.
-- 그래서 지운 자리를 같은 카테고리의 다른 칸에 쓰고 나면 원래 칸으로 되돌아갈 수 없었다.
--
-- 이제 uploaded_date는 "그 칸이 오늘 자리를 썼다"는 표시로 남긴다.
--  · 오늘 자리를 쓴 칸에는 지웠든 아니든 언제든 다시 올릴 수 있다.
--  · 자리는 사진 유무가 아니라 uploaded_date로 세므로, 지웠다고 다른 칸이
--    자리를 하나 더 얻지는 않는다. 하루 3칸·카테고리당 1칸 규칙은 그대로다.
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

  -- 오늘 이미 자리를 쓴 칸이면(사진을 지웠더라도) 제한을 다시 보지 않는다.
  if v_old_date is distinct from v_day then
    select count(*) into v_daily_count
    from cells
    where user_id = p_user_id
      and id <> v_cell_id
      and uploaded_date = v_day;
    if v_daily_count >= 3 then
      raise exception 'BINGO_DAILY_LIMIT' using errcode = 'P0001';
    end if;

    select count(*) into v_category_count
    from cells c
    join bingo_items b on b.id = c.item_id
    where c.user_id = p_user_id
      and c.id <> v_cell_id
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

revoke all on function claim_bingo_photo(uuid, integer, text, timestamptz) from public, anon, authenticated;
grant execute on function claim_bingo_photo(uuid, integer, text, timestamptz) to service_role;
