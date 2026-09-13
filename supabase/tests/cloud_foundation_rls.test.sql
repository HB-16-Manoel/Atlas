begin;

do $$
declare
  atlas_tables constant text[] := array[
    'profiles',
    'tasks',
    'habits',
    'habit_completions',
    'events',
    'journal_entries',
    'task_activity',
    'migration_imports'
  ];
  table_name text;
  command_name text;
begin
  foreach table_name in array atlas_tables
  loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'Missing Atlas table: public.%', table_name;
    end if;

    if not coalesce(
      (
        select c.relrowsecurity
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = table_name
      ),
      false
    ) then
      raise exception 'RLS is not enabled on public.%', table_name;
    end if;

    foreach command_name in array array['select', 'insert', 'update', 'delete']
    loop
      if has_table_privilege(
        'anon',
        format('public.%I', table_name),
        command_name
      ) then
        raise exception 'anon unexpectedly has % on public.%', command_name, table_name;
      end if;

      if not has_table_privilege(
        'authenticated',
        format('public.%I', table_name),
        command_name
      ) then
        raise exception 'authenticated is missing % on public.%', command_name, table_name;
      end if;
    end loop;

    if (
      select count(*)
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and roles @> array['authenticated']::name[]
        and cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    ) <> 4 then
      raise exception 'Expected four authenticated CRUD policies on public.%', table_name;
    end if;
  end loop;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = any(atlas_tables)
      and roles && array['anon', 'public']::name[]
  ) then
    raise exception 'An Atlas private table has an anon/public RLS policy';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and (
        coalesce(qual, '') not like '%auth.uid()%id%'
        and coalesce(with_check, '') not like '%auth.uid()%id%'
      )
  ) then
    raise exception 'A profiles policy is not scoped to auth.uid() = id';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = any(atlas_tables[2:8])
      and (
        coalesce(qual, '') not like '%auth.uid()%user_id%'
        and coalesce(with_check, '') not like '%auth.uid()%user_id%'
      )
  ) then
    raise exception 'A user-data policy is not scoped to auth.uid() = user_id';
  end if;
end;
$$;

select
  'PASS' as result,
  '8 tables exist; RLS is enabled; anon has no CRUD grants; authenticated CRUD is owner-scoped.' as verification;

rollback;
