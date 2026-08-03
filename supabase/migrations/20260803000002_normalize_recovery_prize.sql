-- 이미 적용된 복구 이벤트 마이그레이션은 수정하지 않고,
-- 보상 문구 정규화만 새 마이그레이션으로 남긴다.
update settings
set value = jsonb_set(value::jsonb, '{prizeText}', to_jsonb('커피 쿠폰 ☕'::text))::text
where key = 'recovery_event';
