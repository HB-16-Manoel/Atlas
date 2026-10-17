begin;

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 160),
  description text check (description is null or length(description) <= 2000),
  target_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  kind text not null check (kind in ('milestone', 'measurable')),
  target_value numeric(14, 2),
  current_value numeric(14, 2) not null default 0,
  unit text,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  check (
    (kind = 'milestone' and target_value is null and unit is null and current_value = 0)
    or (kind = 'measurable' and target_value > 0 and current_value >= 0
      and unit is not null and length(btrim(unit)) between 1 and 40)
  )
);

create table public.goal_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 160),
  position integer not null default 0,
  completed_at timestamptz,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (goal_id, user_id) references public.goals(id, user_id) on delete cascade
);

create table public.goal_task_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null,
  task_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.goals(id, user_id) on delete cascade,
  foreign key (task_id, user_id) references public.tasks(id, user_id) on delete cascade,
  unique (goal_id, task_id)
);

create table public.goal_habit_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null,
  habit_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.goals(id, user_id) on delete cascade,
  foreign key (habit_id, user_id) references public.habits(id, user_id) on delete cascade,
  unique (goal_id, habit_id)
);

create index goals_user_active_idx on public.goals (user_id, created_at desc) where deleted_at is null;
create index goal_milestones_goal_active_idx on public.goal_milestones (goal_id, position) where deleted_at is null;
create index goal_milestones_user_idx on public.goal_milestones (user_id);
create index goal_task_links_user_idx on public.goal_task_links (user_id);
create index goal_task_links_task_idx on public.goal_task_links (task_id);
create index goal_habit_links_user_idx on public.goal_habit_links (user_id);
create index goal_habit_links_habit_idx on public.goal_habit_links (habit_id);

create trigger goals_metadata before update on public.goals for each row execute function public.set_atlas_record_metadata();
create trigger goal_milestones_metadata before update on public.goal_milestones for each row execute function public.set_atlas_record_metadata();

alter table public.goals enable row level security;
alter table public.goal_milestones enable row level security;
alter table public.goal_task_links enable row level security;
alter table public.goal_habit_links enable row level security;

revoke all on public.goals, public.goal_milestones, public.goal_task_links, public.goal_habit_links from anon, authenticated;
grant select, insert, update, delete on public.goals, public.goal_milestones, public.goal_task_links, public.goal_habit_links to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['goals','goal_milestones','goal_task_links','goal_habit_links']
  loop
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name || '_delete_own', table_name);
  end loop;
end;
$$;

commit;
