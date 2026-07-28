-- 온라인 위크 오픈/마감 시각을 확정한다.
-- 오픈: 2026-08-01 06:00 KST, 입력 마감: 2026-08-14 18:00 KST
-- 이 기간 밖에서는 빙고 인증 사진 업로드와 로또 응모가 서버에서 거부된다.
-- (20260728000002가 이미 적용된 프로젝트에서도 같은 값이 되도록 upsert 한다)
insert into settings (key, value) values
  ('upload_start', '2026-08-01T06:00:00+09:00'),
  ('upload_end',   '2026-08-14T18:00:00+09:00')
on conflict (key) do update set value = excluded.value;
