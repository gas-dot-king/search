update settings
set value = '2026-08-01T06:00:00+09:00'
where key = 'upload_start';

update settings
set value = '2026-08-14T18:00:00+09:00'
where key = 'upload_end';

-- 기존 4자리 추첨 결과는 새 3자리 규칙과 호환되지 않으므로 초기화합니다.
update settings
set value = ''
where key = 'winning_numbers'
  and length(value) > 3;
