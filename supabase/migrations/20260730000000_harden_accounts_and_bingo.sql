-- Security and consistency hardening. Apply this migration before deploying
-- the matching application release.

create extension if not exists pgcrypto;

-- Never keep a reusable browser bearer token in plaintext. Existing sessions
-- are migrated to hashes and keep their normal 30-day expiry.
alter table users add column if not exists token_hash text;
alter table users add column if not exists token_expires_at timestamptz;
alter table users add column if not exists failed_pin_attempts integer not null default 0;
alter table users add column if not exists pin_locked_at timestamptz;
alter table users add column if not exists redraw_used boolean not null default false;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'token'
  ) then
    execute $sql$
      update users
      set token_hash = encode(digest(token, 'sha256'), 'hex'),
          token_expires_at = now() + interval '30 days'
      where token_hash is null and token is not null
    $sql$;
  end if;
end;
$$;

alter table users alter column token_hash set not null;
alter table users alter column token_expires_at set not null;
alter table users alter column token_expires_at set default (now() + interval '30 days');
alter table users drop constraint if exists users_token_key;
drop index if exists users_token_key;
create unique index if not exists users_token_hash_key on users (token_hash);
alter table users drop column if exists token;

-- Persistent, cross-instance request throttling. The app hashes the bucket
-- before calling this function, so an IP/nickname pair is not stored directly.
create table if not exists auth_rate_limits (
  bucket text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table auth_rate_limits enable row level security;

create or replace function take_auth_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
begin
  insert into auth_rate_limits (bucket, window_started_at, attempts, updated_at)
  values (p_bucket, now(), 1, now())
  on conflict (bucket) do update set
    attempts = case
      when auth_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then 1
      else auth_rate_limits.attempts + 1
    end,
    window_started_at = case
      when auth_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then now()
      else auth_rate_limits.window_started_at
    end,
    updated_at = now()
  returning attempts into v_attempts;

  return v_attempts <= p_limit;
end;
$$;

-- Incrementing failed PIN attempts must be atomic: two simultaneous requests
-- cannot both observe the same old count and bypass the tenth-attempt lock.
create or replace function record_pin_failure(p_user_id uuid)
returns table (failed_pin_attempts integer, pin_locked_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  update users as u
  set failed_pin_attempts = least(u.failed_pin_attempts + 1, 10),
      pin_locked_at = case
        when u.failed_pin_attempts + 1 >= 10 then coalesce(u.pin_locked_at, now())
        else null
      end
  where u.id = p_user_id
  returning u.failed_pin_attempts, u.pin_locked_at
  into failed_pin_attempts, pin_locked_at;

  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0001';
  end if;
  return next;
end;
$$;

-- The upload date is stored in KST so the daily rule is indexable and does
-- not depend on a database/session timezone.
alter table cells add column if not exists uploaded_date date;
update cells
set uploaded_date = (uploaded_at at time zone 'Asia/Seoul')::date
where uploaded_at is not null and uploaded_date is null;
create index if not exists cells_user_upload_date_idx
  on cells (user_id, uploaded_date)
  where photo_path is not null;

-- Some early production databases predate the slot column. Absorb that old
-- migration here so this hardening migration can be applied safely by itself.
alter table lotto_entries add column if not exists slot integer;

with ranked as (
  select id, row_number() over (partition by user_id order by created_at, id) as slot_number
  from lotto_entries
)
update lotto_entries as entries
set slot = ranked.slot_number
from ranked
where entries.id = ranked.id
  and entries.slot is null
  and ranked.slot_number between 1 and 2;

alter table lotto_entries drop constraint if exists lotto_entries_slot_check;
alter table lotto_entries add constraint lotto_entries_slot_check check (slot is null or slot between 1 and 2);
create unique index if not exists lotto_entries_user_slot_idx
  on lotto_entries (user_id, slot)
  where slot is not null;

-- The old migration preserved over-limit historical rows as NULL. On normal
-- databases there are none, so restore the stronger NOT NULL rule; otherwise
-- preserve the legacy records rather than deleting them silently.
do $$
begin
  if not exists (select 1 from lotto_entries where slot is null) then
    alter table lotto_entries alter column slot set not null;
  end if;
end;
$$;

-- Storage and Postgres cannot share one transaction. Keep a durable outbox so
-- a failed Storage delete is retried by the next mutation instead of silently
-- leaving an orphaned private photo forever.
create table if not exists storage_cleanup_tasks (
  path text primary key,
  created_at timestamptz not null default now(),
  last_error text,
  attempts integer not null default 0
);
alter table storage_cleanup_tasks enable row level security;

-- Atomically claims a bingo cell while enforcing: at most three cells per
-- KST day and at most one cell per category per KST day. Replacing a photo
-- already submitted today does not consume another allowance.
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

-- Board redraw consumes its single allowance and replaces cells in one DB
-- transaction, so an interruption cannot leave an account without a board.
create or replace function create_or_redraw_bingo_board(
  p_user_id uuid,
  p_item_ids integer[],
  p_redraw boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_board boolean;
  v_has_photo boolean;
  v_redraw_used boolean;
begin
  if coalesce(array_length(p_item_ids, 1), 0) <> 16
     or (select count(distinct item_id) from unnest(p_item_ids) as item_id) <> 16 then
    raise exception 'INVALID_BINGO_BOARD' using errcode = 'P0001';
  end if;

  select redraw_used into v_redraw_used from users where id = p_user_id for update;
  if not found then raise exception 'USER_NOT_FOUND' using errcode = 'P0001'; end if;

  select exists(select 1 from cells where user_id = p_user_id),
         exists(select 1 from cells where user_id = p_user_id and photo_path is not null)
  into v_has_board, v_has_photo;

  if v_has_board and not p_redraw then
    raise exception 'BINGO_BOARD_EXISTS' using errcode = 'P0001';
  end if;
  if v_has_board and p_redraw then
    if v_redraw_used then raise exception 'BINGO_REDRAW_USED' using errcode = 'P0001'; end if;
    if v_has_photo then raise exception 'BINGO_REDRAW_AFTER_UPLOAD' using errcode = 'P0001'; end if;
    delete from cells where user_id = p_user_id;
    update users set redraw_used = true where id = p_user_id;
  end if;

  insert into cells (user_id, position, item_id)
  select p_user_id, numbered.ordinality - 1, numbered.item_id
  from unnest(p_item_ids) with ordinality as numbered(item_id, ordinality);
end;
$$;

-- Admin updates that must change together are also a single transaction.
create or replace function set_upload_period(p_start text, p_end text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := p_start::timestamptz;
  v_end timestamptz := p_end::timestamptz;
begin
  if v_start >= v_end then
    raise exception 'INVALID_UPLOAD_PERIOD' using errcode = 'P0001';
  end if;
  insert into settings(key, value) values
    ('upload_start', p_start), ('upload_end', p_end)
  on conflict (key) do update set value = excluded.value;
end;
$$;

create or replace function append_winning_number(p_digit text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
begin
  if p_digit !~ '^[0-9]$' then raise exception 'INVALID_DRAW_DIGIT' using errcode = 'P0001'; end if;
  insert into settings(key, value) values ('winning_numbers', '') on conflict do nothing;
  select value into v_current from settings where key = 'winning_numbers' for update;
  if length(v_current) >= 3 then raise exception 'DRAW_COMPLETE' using errcode = 'P0001'; end if;
  v_current := v_current || p_digit;
  update settings set value = v_current where key = 'winning_numbers';
  return v_current;
end;
$$;

create or replace function admin_reset_bingo_board(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from users where id = p_user_id for update;
  if not found then raise exception 'USER_NOT_FOUND' using errcode = 'P0001'; end if;
  delete from cells where user_id = p_user_id;
  update users set redraw_used = false where id = p_user_id;
end;
$$;

-- The old per-user setting is now a typed account field. Preserve a consumed
-- redraw allowance before removing the untyped settings rows.
update users as u
set redraw_used = true
where exists (
  select 1 from settings s where s.key = 'redraw:' || u.id::text
);
delete from settings where key like 'redraw:%';
delete from settings where key = 'max_lotto_entries';

-- Upgrade only the old seed that had no editable event date. Existing
-- administrator-authored guides are preserved.
update settings
set value = '{"date":"2026-08-15","hours":"오전 9시 ~ 오후 1시","venue":"양주 문화체육센터","parkingInfo":"건물 하부 공터에 주차 가능합니다. 자세한 위치는 사진으로 추후 안내할게요.","mapUrl":"https://naver.me/59vQDKHt","lat":null,"lng":null,"timeline":[{"id":"freerun","time":"05:00 ~ 06:00","title":"8.15 러닝 (프리런)","activities":["장소: 양주 문화체육센터","8.15km 인증 도전 · 자신이 뛸 수 있는 만큼 자유 참여"]},{"id":"kickoff","time":"08:30","title":"공식 일정 시작","activities":[]},{"id":"indoor","time":"09:00 ~ 12:30","title":"실내 레크레이션","activities":[]},{"id":"wrapup","time":"12:30 ~ 13:00","title":"마무리 정리","activities":[]}]}'
where key = 'event_guide'
  and coalesce(value::jsonb ->> 'date', '') = '';

update settings
set value = jsonb_set(
  value::jsonb,
  '{timeline,0,activities,0}',
  to_jsonb('장소: 양주 문화체육센터'::text),
  false
)::text
where key = 'event_guide'
  and value::jsonb #>> '{timeline,0,activities,0}' = '장소: 남양산역 2번 출구 옆, 물금 IC 측 100m 지점 운동기구가 있는 정자';

-- These RPCs are called only with the service-role key from server routes.
-- Security-definer functions must never remain callable by browser roles.
revoke all on function take_auth_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function record_pin_failure(uuid) from public, anon, authenticated;
revoke all on function claim_bingo_photo(uuid, integer, text, timestamptz) from public, anon, authenticated;
revoke all on function create_or_redraw_bingo_board(uuid, integer[], boolean) from public, anon, authenticated;
revoke all on function set_upload_period(text, text) from public, anon, authenticated;
revoke all on function append_winning_number(text) from public, anon, authenticated;
revoke all on function admin_reset_bingo_board(uuid) from public, anon, authenticated;
grant execute on function take_auth_rate_limit(text, integer, integer) to service_role;
grant execute on function record_pin_failure(uuid) to service_role;
grant execute on function claim_bingo_photo(uuid, integer, text, timestamptz) to service_role;
grant execute on function create_or_redraw_bingo_board(uuid, integer[], boolean) to service_role;
grant execute on function set_upload_period(text, text) to service_role;
grant execute on function append_winning_number(text) to service_role;
grant execute on function admin_reset_bingo_board(uuid) to service_role;
