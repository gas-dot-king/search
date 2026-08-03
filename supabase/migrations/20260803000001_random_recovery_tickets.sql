-- 복구 접수번호는 순번이 아니라 무작위 6자리 번호를 사용한다.
alter table recovery_entries
  alter column ticket_no drop identity if exists;

alter table recovery_entries
  alter column ticket_no set default floor(random() * 900000 + 100000)::bigint;

-- 실제 운영 보상 문구를 커피 쿠폰으로 맞춘다.
update settings
set value = replace(value, '"prizeText":"서버 복구 공로상"', '"prizeText":"커피 쿠폰 ☕"')
where key = 'recovery_event';
