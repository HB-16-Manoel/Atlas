begin;

create extension if not exists pgcrypto;

create or replace function public.set_atlas_record_metadata()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.revision = old.revision + 1;
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  timezone text not null default 'UTC',
  locale text not null default 'en',
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id bigint,
  title text not null check (length(btrim(title)) > 0),
  task_date date not null,
  position integer not null default 0,
  completed_at timestamptz,
  carry_over boolean not null default true,
  carried_from_id uuid,
  carried_to_id uuid,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  unique (user_id, legacy_id)
);

alter table public.tasks
  add constraint tasks_carried_from_owner_fk foreign key (carried_from_id, user_id) references public.tasks(id, user_id),
  add constraint tasks_carried_to_owner_fk foreign key (carried_to_id, user_id) references public.tasks(id, user_id);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id bigint,
  name text not null check (length(btrim(name)) > 0),
  position integer not null default 0,
  started_on date not null default current_date,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  unique (user_id, legacy_id)
);

create table public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null,
  completion_date date not null,
  legacy_id text,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (habit_id, user_id) references public.habits(id, user_id),
  unique (user_id, habit_id, completion_date),
  unique (user_id, legacy_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id bigint,
  title text not null check (length(btrim(title)) > 0),
  event_date date not null,
  event_time time,
  repeat_yearly boolean not null default false,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  unique (user_id, legacy_id)
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  entry_date date not null,
  body text not null default '',
  mood text check (mood is null or mood in ('Great', 'Good', 'Okay', 'Low', 'Rough')),
  energy text check (energy is null or energy in ('High', 'Good', 'Average', 'Low')),
  rating smallint check (rating is null or rating between 1 and 10),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  unique (user_id, entry_date),
  unique (user_id, legacy_id)
);

create table public.task_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid,
  legacy_id text,
  activity_type text not null check (activity_type in ('created', 'completed', 'uncompleted', 'deleted')),
  task_title text not null,
  task_date date not null,
  occurred_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (task_id, user_id) references public.tasks(id, user_id),
  unique (user_id, legacy_id)
);

create table public.migration_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_hash text not null,
  status text not null default 'prepared' check (status in ('prepared', 'confirmed', 'imported', 'failed', 'rolled_back')),
  raw_backup jsonb not null,
  validation_result jsonb not null default '{}'::jsonb,
  import_preview jsonb not null default '{}'::jsonb,
  imported_counts jsonb not null default '{}'::jsonb,
  confirmed_at timestamptz,
  imported_at timestamptz,
  rolled_back_at timestamptz,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, source_hash)
);

create index tasks_user_date_active_idx on public.tasks (user_id, task_date, position) where deleted_at is null;
create index tasks_user_updated_idx on public.tasks (user_id, updated_at);
create index habits_user_position_active_idx on public.habits (user_id, position) where deleted_at is null;
create index habits_user_updated_idx on public.habits (user_id, updated_at);
create index habit_completions_user_date_active_idx on public.habit_completions (user_id, completion_date) where deleted_at is null;
create index events_user_date_active_idx on public.events (user_id, event_date) where deleted_at is null;
create index journal_entries_user_date_active_idx on public.journal_entries (user_id, entry_date) where deleted_at is null;
create index task_activity_user_occurred_idx on public.task_activity (user_id, occurred_at desc) where deleted_at is null;
create index migration_imports_user_created_idx on public.migration_imports (user_id, created_at desc);

create trigger profiles_metadata before update on public.profiles for each row execute function public.set_atlas_record_metadata();
create trigger tasks_metadata before update on public.tasks for each row execute function public.set_atlas_record_metadata();
create trigger habits_metadata before update on public.habits for each row execute function public.set_atlas_record_metadata();
create trigger habit_completions_metadata before update on public.habit_completions for each row execute function public.set_atlas_record_metadata();
create trigger events_metadata before update on public.events for each row execute function public.set_atlas_record_metadata();
create trigger journal_entries_metadata before update on public.journal_entries for each row execute function public.set_atlas_record_metadata();
create trigger task_activity_metadata before update on public.task_activity for each row execute function public.set_atlas_record_metadata();
create trigger migration_imports_metadata before update on public.migration_imports for each row execute function public.set_atlas_record_metadata();

create or replace function public.handle_new_atlas_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_atlas_user();

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;
alter table public.events enable row level security;
alter table public.journal_entries enable row level security;
alter table public.task_activity enable row level security;
alter table public.migration_imports enable row level security;

revoke all on public.profiles, public.tasks, public.habits, public.habit_completions, public.events, public.journal_entries, public.task_activity, public.migration_imports from anon, authenticated;
grant select, insert, update, delete on public.profiles, public.tasks, public.habits, public.habit_completions, public.events, public.journal_entries, public.task_activity, public.migration_imports to authenticated;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy profiles_delete_own on public.profiles for delete to authenticated using ((select auth.uid()) = id);

do $$
declare table_name text;
begin
  foreach table_name in array array['tasks','habits','habit_completions','events','journal_entries','task_activity','migration_imports']
  loop
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name || '_delete_own', table_name);
  end loop;
end;
$$;

commit;
