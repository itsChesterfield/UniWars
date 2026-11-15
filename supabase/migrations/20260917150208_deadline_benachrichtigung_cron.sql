create extension if not exists pg_cron with schema extensions;

create or replace function public.benachrichtigungen_fuer_faellige_deadlines()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into benachrichtigung (user_id, text, ref_id)
  select d.user_id, 'Deadline "' || d.titel || '" ist bald fällig', d.id
  from deadline d
  where d.erledigt = false
    and d.faellig_am between now() and now() + interval '24 hours'
    and not exists (
      select 1 from benachrichtigung b
      where b.ref_id = d.id
    );
end;
$$;

revoke execute on function public.benachrichtigungen_fuer_faellige_deadlines() from anon, authenticated, public;

select cron.schedule(
  'deadline-benachrichtigungen',
  '0 * * * *',
  $$select public.benachrichtigungen_fuer_faellige_deadlines()$$
);
