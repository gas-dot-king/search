-- 기존 행사 안내의 옛 장소명만 새 표기로 교체한다.
-- 관리자가 별도로 입력한 장소명은 그대로 유지한다.
update public.settings
set value = jsonb_set(
  value::jsonb,
  '{venue}',
  to_jsonb('양주 문화체육센터'::text),
  true
)::text
where key = 'event_guide'
  and value::jsonb ->> 'venue' in (
    '양산 문화체육센터 1층 실내체육관',
    '양주 체육문화센터'
  );
