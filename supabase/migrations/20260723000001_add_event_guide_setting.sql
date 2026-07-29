insert into settings (key, value)
values (
  'event_guide',
  '{"hours":"오전 7시 ~ 오후 1시","venue":"양주 문화체육센터","timeline":[{"id":"running","time":"07:00 ~ 08:00","title":"간단한 러닝","activities":[]},{"id":"breakfast","time":"08:00 ~ 09:00","title":"아침 식사","activities":[]},{"id":"indoor","time":"09:00 ~ 13:00","title":"실내 레크레이션","activities":[]}]}'
)
on conflict (key) do nothing;
