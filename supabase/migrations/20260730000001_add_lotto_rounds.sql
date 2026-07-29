-- 로또 재추첨: 1등이 없어 넘어간 차수의 당첨 번호를 JSON 배열로 남긴다.
-- 예) ["010","473"] → 1차·2차에서 1등이 없었고 지금은 3차 진행 중.
-- 현재 차수의 번호는 기존 winning_numbers를 그대로 쓴다.
insert into settings (key, value) values
  ('lotto_rounds', '[]')
on conflict (key) do nothing;
