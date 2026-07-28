alter table lotto_entries
add column if not exists slot integer;

with ranked as (
  select
    id,
    row_number() over (partition by user_id order by created_at, id) as slot_number
  from lotto_entries
)
update lotto_entries as entries
set slot = ranked.slot_number
from ranked
where entries.id = ranked.id
  and ranked.slot_number between 1 and 2
  and entries.slot is null;

alter table lotto_entries
drop constraint if exists lotto_entries_slot_check;

alter table lotto_entries
add constraint lotto_entries_slot_check
check (slot is null or slot between 1 and 2);

create unique index if not exists lotto_entries_user_slot_idx
on lotto_entries (user_id, slot)
where slot is not null;
