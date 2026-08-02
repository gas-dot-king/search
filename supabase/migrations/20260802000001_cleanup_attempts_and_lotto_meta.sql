-- 1) 사진 정리 실패 횟수를 실제로 누적한다.
--
-- 지금까지는 실패할 때마다 attempts를 1로 "덮어써서", 50번 실패한 파일도 1로 보였다.
-- 몇 번째 실패인지 모르면 일시적인 오류와 영영 안 지워지는 파일을 구분할 수 없다.
create or replace function record_cleanup_failure(p_paths text[], p_error text)
returns void
language sql
security definer
set search_path = public
as $$
  update storage_cleanup_tasks
  set attempts = attempts + 1,
      last_error = p_error
  where path = any(p_paths);
$$;

revoke all on function record_cleanup_failure(text[], text) from public, anon, authenticated;
grant execute on function record_cleanup_failure(text[], text) to service_role;

-- 2) 로또 응모 사진에도 촬영 정보를 남긴다.
--
-- 로또는 회원이 직접 신고한 km 기록이라 검증 필요가 빙고보다 큰데,
-- 지금까지 촬영 정보는 빙고 인증에만 있었다. 같은 기준으로 검토할 수 있게 맞춘다.
-- 값의 모양은 cells.photo_meta와 같다.
alter table lotto_entries add column if not exists photo_meta jsonb;

-- 3) 좌표를 비워 둔 기기가 적어 보낸 0/0을 지운다.
--
-- GPS 태그는 만들고 값은 안 채우는 기기가 있어 0,0이 그대로 저장됐다.
-- 지도 링크가 아프리카 서쪽 바다를 열어 검토에 혼선만 준다. 좌표만 지우고
-- 촬영 시각·기기 정보는 남긴다.
update cells
set photo_meta = photo_meta - 'lat' - 'lng'
where photo_meta ? 'lat'
  and abs(coalesce((photo_meta ->> 'lat')::numeric, 0)) < 0.000001
  and abs(coalesce((photo_meta ->> 'lng')::numeric, 0)) < 0.000001;

-- 좌표만 있던 사진은 위에서 키를 지우면 빈 객체가 된다. 빈 객체는 null과 같은 뜻이라
-- 화면이 "촬영 정보 없음"으로 읽도록 아예 비운다.
update cells set photo_meta = null where photo_meta = '{}'::jsonb;

-- 4) 관리자 검토 큐용 인덱스.
-- 전 회원의 인증 사진을 올라온 순서대로 훑는 새 화면이 매번 쓰는 정렬이다.
create index if not exists cells_uploaded_at_idx
  on cells (uploaded_at desc)
  where photo_path is not null;

-- 5) 로또 응모 인덱스가 빠진 DB가 있어 함께 만든다.
-- (20260723000000 마이그레이션을 건너뛴 경우)
create index if not exists lotto_entries_user_created_at_idx
  on lotto_entries (user_id, created_at);
