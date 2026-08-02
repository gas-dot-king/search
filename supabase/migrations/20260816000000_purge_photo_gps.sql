-- 이벤트가 끝난 뒤 인증 사진의 위치 좌표를 파기한다.
--
-- ⚠️ 실행 시점: 8/15 행사와 선물 명단 확정이 모두 끝난 뒤에 한 번만 실행하세요.
--    미리 실행하면 검토 중인 인증의 위치를 확인할 수 없게 됩니다.
--    (파일 이름의 날짜는 "8/16 이후"라는 뜻이고, 자동으로 실행되지는 않습니다)
--
-- 업로드 화면에서 "인증 검토를 위해" 기록한다고 안내했으므로, 검토가 끝나면
-- 더 들고 있을 이유가 없다. 촬영 시각·기기 정보는 통계와 기록으로 남기고
-- 위치만 지운다. 사진 파일 자체에는 원래부터 EXIF가 없다(캔버스로 다시 그려 올린다).

update cells
set photo_meta = photo_meta - 'lat' - 'lng'
where photo_meta ?| array['lat', 'lng'];

update lotto_entries
set photo_meta = photo_meta - 'lat' - 'lng'
where photo_meta ?| array['lat', 'lng'];

-- 좌표밖에 없던 사진은 빈 객체가 된다. 화면이 "촬영 정보 없음"으로 읽도록 비운다.
update cells set photo_meta = null where photo_meta = '{}'::jsonb;
update lotto_entries set photo_meta = null where photo_meta = '{}'::jsonb;

-- 남은 좌표가 없는지 확인용 (0이 나와야 정상)
-- select count(*) from cells where photo_meta ?| array['lat','lng'];
