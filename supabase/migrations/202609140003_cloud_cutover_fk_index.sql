begin;

-- Match the carried-from composite foreign key column order. The separate
-- partial unique index remains responsible for duplicate-successor protection.
create index if not exists tasks_carried_from_owner_idx
  on public.tasks (carried_from_id, user_id);

commit;
