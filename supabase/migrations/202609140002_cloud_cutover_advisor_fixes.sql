begin;

-- These functions are trigger-only implementation details and must not be
-- callable as public Data API RPC endpoints.
revoke execute on function public.handle_new_atlas_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Cover composite foreign keys used by completion/history and carry-over
-- relationships. The carry-from index also enforces one active successor.
create index if not exists habit_completions_habit_owner_idx
  on public.habit_completions (habit_id, user_id);

create index if not exists task_activity_task_owner_idx
  on public.task_activity (task_id, user_id);

create index if not exists tasks_carried_to_owner_idx
  on public.tasks (carried_to_id, user_id);

commit;
