begin;

update public.profiles
set display_name = null
where display_name is not null and length(btrim(display_name)) = 0;

alter table public.profiles
  drop constraint if exists profiles_display_name_length_check;

alter table public.profiles
  add constraint profiles_display_name_length_check
  check (display_name is null or length(btrim(display_name)) between 1 and 80);

commit;
