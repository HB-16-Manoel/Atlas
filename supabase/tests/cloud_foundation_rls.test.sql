begin;
select plan(6);

select ok((select relrowsecurity from pg_class where oid = 'public.tasks'::regclass), 'tasks has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.habits'::regclass), 'habits has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.events'::regclass), 'events has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.journal_entries'::regclass), 'journal has RLS');
select ok(not has_table_privilege('anon', 'public.tasks', 'select'), 'anon cannot read tasks');
select ok(has_table_privilege('authenticated', 'public.tasks', 'select'), 'authenticated role can query through RLS');

select * from finish();
rollback;
