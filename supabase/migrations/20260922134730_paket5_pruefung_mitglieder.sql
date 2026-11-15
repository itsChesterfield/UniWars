-- Paket 5: Mitgliederliste einer Pruefung (fuer die Detailansicht),
-- analog zu deadline_mitglieder/todo_mitglieder.
create or replace function public.pruefung_mitglieder(p_pruefung_id uuid)
returns table (user_id uuid, username text, status public.einladung_status, ist_ersteller boolean)
language sql
security definer
set search_path = public
stable
as $$
  select p.user_id, s.username, 'ANGENOMMEN'::public.einladung_status, true
  from public.pruefung p
  join public.settings s on s.user_id = p.user_id
  where p.id = p_pruefung_id
    and public.ist_mitglied('pruefung', p.id)
  union all
  select e.an_user_id, s2.username, e.status, false
  from public.einladung e
  join public.settings s2 on s2.user_id = e.an_user_id
  where e.ziel_typ = 'pruefung' and e.ziel_id = p_pruefung_id
    and public.ist_mitglied('pruefung', p_pruefung_id);
$$;

revoke execute on function public.pruefung_mitglieder(uuid) from public, anon;
grant execute on function public.pruefung_mitglieder(uuid) to authenticated;
