-- Paket 4: Mitgliederliste eines Todos (fuer die "Zustaendig"-Auswahl im
-- Unteraufgaben-Dialog), analog zu deadline_mitglieder aus Paket 1.
create or replace function public.todo_mitglieder(p_todo_id uuid)
returns table (user_id uuid, username text, status public.einladung_status, ist_ersteller boolean)
language sql
security definer
set search_path = public
stable
as $$
  select t.user_id, s.username, 'ANGENOMMEN'::public.einladung_status, true
  from public.todo t
  join public.settings s on s.user_id = t.user_id
  where t.id = p_todo_id
    and public.ist_mitglied('todo', t.id)
  union all
  select e.an_user_id, s2.username, e.status, false
  from public.einladung e
  join public.settings s2 on s2.user_id = e.an_user_id
  where e.ziel_typ = 'todo' and e.ziel_id = p_todo_id
    and public.ist_mitglied('todo', p_todo_id);
$$;

revoke execute on function public.todo_mitglieder(uuid) from public, anon;
grant execute on function public.todo_mitglieder(uuid) to authenticated;
