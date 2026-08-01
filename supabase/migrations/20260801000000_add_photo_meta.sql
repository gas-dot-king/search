-- 빙고 인증 사진의 촬영 정보(EXIF)를 기록한다.
-- 예: {"takenAt":"2026-08-01T06:42:11","lat":35.328146,"lng":129.023699,"make":"Apple","model":"iPhone 15 Pro"}
--
-- 사진 파일 자체에는 여전히 EXIF가 남지 않는다(브라우저에서 캔버스로 다시 그려 올리므로).
-- 촬영 정보는 이 컬럼에만 저장되고, 서버(service role)를 거치는 관리자 화면에서만 보인다.
-- 값이 없는 경우가 흔하다 — 스크린샷, 메신저로 받은 사진에는 EXIF가 없다.
alter table cells add column if not exists photo_meta jsonb;

-- 사진을 지우면 촬영 정보도 함께 지운다.
update cells set photo_meta = null where photo_path is null and photo_meta is not null;
