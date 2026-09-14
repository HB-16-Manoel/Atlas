begin;

-- Existing auth users created before the profile trigger was installed need a
-- profile too. This is idempotent and does not touch Atlas application data.
insert into public.profiles (id, email)
select id, email
from auth.users
on conflict (id) do nothing;

-- Only one active task may be generated from a carry-over source. This prevents
-- two devices opening on a new day from creating duplicate successors.
create unique index if not exists tasks_one_active_carry_successor_idx
  on public.tasks (user_id, carried_from_id)
  where carried_from_id is not null and deleted_at is null;

commit;
