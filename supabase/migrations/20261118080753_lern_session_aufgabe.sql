-- Fokus-Timer zu einer Aufgabe: Lernsitzung merkt sich, woran gearbeitet wurde
alter table public.lern_session
  add column aufgabe_typ text check (aufgabe_typ in ('deadline', 'todo', 'pruefung')),
  add column aufgabe_id uuid,
  add constraint lern_session_aufgabe_vollstaendig check ((aufgabe_typ is null) = (aufgabe_id is null));
create index lern_session_aufgabe_idx on public.lern_session (aufgabe_typ, aufgabe_id) where aufgabe_id is not null;

-- Interner Teil (nicht über die API erreichbar): Minuten je Person zu einer Aufgabe samt ihrer Unteraufgaben
create schema if not exists intern;
revoke all on schema intern from public, anon;
grant usage on schema intern to authenticated;

create or replace function intern.arbeitszeit_summen(p_typ text, p_id uuid)
returns table (user_id uuid, username text, minuten integer)
language sql stable security definer set search_path = '' as $$
  with ziele as (
    select p_typ as typ, p_id as id
    union all select 'deadline', d.id from public.deadline d
      where (p_typ = 'deadline' and d.parent_deadline_id = p_id)
         or (p_typ = 'pruefung' and d.pruefung_id = p_id)
         or (p_typ = 'todo' and d.todo_id = p_id)
    union all select 'todo', t.id from public.todo t where p_typ = 'todo' and t.parent_id = p_id
  )
  select s.user_id, st.username, sum(s.dauer_minuten)::integer
  from public.lern_session s
  join ziele z on z.typ = s.aufgabe_typ and z.id = s.aufgabe_id
  left join public.settings st on st.user_id = s.user_id
  group by s.user_id, st.username
  order by 3 desc;
$$;
revoke all on function intern.arbeitszeit_summen(text, uuid) from public, anon;
grant execute on function intern.arbeitszeit_summen(text, uuid) to authenticated;

-- Öffentlicher Teil: liefert nur etwas, wenn die aufrufende Person die Aufgabe selbst sehen darf (RLS der Aufgabe)
create or replace function public.aufgabe_arbeitszeit(p_typ text, p_id uuid)
returns table (user_id uuid, username text, minuten integer)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_typ = 'deadline' and exists (select 1 from public.deadline where id = p_id)
     or p_typ = 'todo' and exists (select 1 from public.todo where id = p_id)
     or p_typ = 'pruefung' and exists (select 1 from public.pruefung where id = p_id) then
    return query select * from intern.arbeitszeit_summen(p_typ, p_id);
  end if;
end $$;
revoke all on function public.aufgabe_arbeitszeit(text, uuid) from public, anon;
grant execute on function public.aufgabe_arbeitszeit(text, uuid) to authenticated;
