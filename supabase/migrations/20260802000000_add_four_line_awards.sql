-- 4줄 선착순 명단을 "확정"해서 고정한다.
--
-- 지금까지 순위는 남아 있는 사진의 uploaded_at으로 매번 다시 계산했다.
-- 그래서 이미 4줄을 채운 회원이 그 줄에 속한 사진을 교체하면 달성 시각이 뒤로 밀리고,
-- 선물 20명 순위가 조용히 바뀐다. 운영진이 인증을 확인한 사람은 그 시점의 달성 시각을
-- 여기에 적어 두고, 이후 사진이 어떻게 바뀌든 순위는 이 값으로 고정한다.
--
-- 순위 자체는 저장하지 않는다. achieved_at으로 정렬해 그때그때 매기면
-- 확정하는 순서가 뒤바뀌어도 결과가 흔들리지 않는다.
create table if not exists four_line_awards (
  user_id uuid primary key references users(id) on delete cascade,
  achieved_at timestamptz not null,
  confirmed_at timestamptz not null default now(),
  note text
);

-- 명단을 뽑을 때 항상 달성 시각 순으로 읽는다
create index if not exists four_line_awards_achieved_at_idx
  on four_line_awards (achieved_at);

-- 다른 표와 같이 서버(service role)를 통해서만 접근한다
alter table four_line_awards enable row level security;
