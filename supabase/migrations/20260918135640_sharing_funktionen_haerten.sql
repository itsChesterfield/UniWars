
-- search_path fixen
create or replace function public.einladung_status_pruefen()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if (select auth.uid()) != old.an_user_id then
      raise exception 'Nur der Eingeladene kann antworten';
    end if;
    if old.status != 'OFFEN' then
      raise exception 'Einladung wurde bereits beantwortet';
    end if;
    new.beantwortet_am := now();
  end if;
  return new;
end;
$$;

-- Trigger-Funktionen: keine direkte RPC-Ausfuehrung erlauben
revoke execute on function public.einladung_vor_insert() from public, anon, authenticated;
revoke execute on function public.einladung_status_pruefen() from public, anon, authenticated;

-- Nur explizit gewollte Rollen duerfen die Such-/Lookup-Funktionen aufrufen
revoke execute on function public.benutzer_suchen(text) from public, anon;
grant execute on function public.benutzer_suchen(text) to authenticated;

revoke execute on function public.user_id_von_username(text) from public, anon;
grant execute on function public.user_id_von_username(text) to authenticated;

revoke execute on function public.deadline_mitglieder(uuid) from public, anon;
grant execute on function public.deadline_mitglieder(uuid) to authenticated;

revoke execute on function public.ist_username_verfuegbar(text) from public;
grant execute on function public.ist_username_verfuegbar(text) to anon, authenticated;
