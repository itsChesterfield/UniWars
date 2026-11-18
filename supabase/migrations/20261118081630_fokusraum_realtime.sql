-- Fokusraum: wer welchem Raum (Realtime-Presence, private Kanäle) beitreten darf
--   fokusraum:alle              – alle angemeldeten Personen
--   fokusraum:hs:<hochschule>   – nur mit gültig bestätigter Uni-Mail dieser Hochschule
--   fokusraum:gruppe:<deadline> – nur wer die Gruppenarbeit sehen darf (RLS der Deadline)
create or replace function public.fokusraum_erlaubt(p_topic text) returns boolean
language sql stable security invoker set search_path = '' as $$
  select case
    when p_topic = 'fokusraum:alle' then true
    when p_topic like 'fokusraum:hs:%' then exists (
      select 1 from public.uni_verifizierung v
      where v.user_id = (select auth.uid())
        and v.hochschule_id = substr(p_topic, length('fokusraum:hs:') + 1)
        and v.bestaetigt_am is not null and v.gueltig_bis > now())
    when p_topic ~ '^fokusraum:gruppe:[0-9a-f-]{36}$' then exists (
      select 1 from public.deadline d where d.id = substr(p_topic, length('fokusraum:gruppe:') + 1)::uuid)
    else false
  end;
$$;
revoke all on function public.fokusraum_erlaubt(text) from public, anon;
grant execute on function public.fokusraum_erlaubt(text) to authenticated;

create policy "Fokusraum lesen" on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'presence' and public.fokusraum_erlaubt((select realtime.topic())));
create policy "Fokusraum beitreten" on realtime.messages for insert to authenticated
  with check (realtime.messages.extension = 'presence' and public.fokusraum_erlaubt((select realtime.topic())));
