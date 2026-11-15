-- Paket 1: todo-Erweiterung (Faelligkeit + Zuweisung), anhang-Tabelle,
-- Generalisierung von einladung auf ziel_typ/ziel_id (statt nur Deadlines)
-- und die dafuer noetigen RLS-Hilfsfunktionen ist_ersteller/ist_mitglied.

-- todo: Faelligkeit + Zuweisung
alter table public.todo
  add column faellig_am timestamptz null,
  add column zugewiesen_an uuid null references auth.users(id) on delete set null;

-- anhang (Links an Todo/Deadline/Pruefung)
create table public.anhang (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ziel_typ text not null check (ziel_typ in ('todo','deadline','pruefung')),
  ziel_id uuid not null,
  url text not null,
  titel text not null,
  erstellt_am timestamptz not null default now()
);
create index anhang_ziel_idx on public.anhang(ziel_typ, ziel_id);
alter table public.anhang enable row level security;

-- einladung generalisieren: deadline_id -> ziel_id (+ ziel_typ)
alter table public.einladung
  add column ziel_typ text not null default 'deadline' check (ziel_typ in ('todo','deadline','pruefung'));

alter table public.einladung drop constraint einladung_deadline_id_fkey;
alter table public.einladung rename column deadline_id to ziel_id;
alter table public.einladung rename column deadline_titel to ziel_titel;
alter table public.einladung rename column deadline_faellig_am to ziel_faellig_am;
-- todos haben eine optionale Faelligkeit -> darf beim Teilen eines Todos ohne Termin leer sein
alter table public.einladung alter column ziel_faellig_am drop not null;

-- Hilfsfunktionen fuer polymorphe Mitgliedschaft (SECURITY DEFINER, sonst
-- rekursiert die Policy auf einladung ueber sich selbst)
create or replace function public.ist_ersteller(p_ziel_typ text, p_ziel_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case p_ziel_typ
    when 'deadline' then exists(select 1 from public.deadline where id = p_ziel_id and user_id = p_user_id)
    when 'todo' then exists(select 1 from public.todo where id = p_ziel_id and user_id = p_user_id)
    when 'pruefung' then exists(select 1 from public.pruefung where id = p_ziel_id and user_id = p_user_id)
    else false
  end;
$$;

create or replace function public.ist_mitglied(p_ziel_typ text, p_ziel_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.ist_ersteller(p_ziel_typ, p_ziel_id, (select auth.uid()))
    or exists (
      select 1 from public.einladung e
      where e.ziel_typ = p_ziel_typ and e.ziel_id = p_ziel_id
        and e.an_user_id = (select auth.uid()) and e.status = 'ANGENOMMEN'
    );
$$;

revoke execute on function public.ist_ersteller(text, uuid, uuid) from public, anon;
grant execute on function public.ist_ersteller(text, uuid, uuid) to authenticated;
revoke execute on function public.ist_mitglied(text, uuid) from public, anon;
grant execute on function public.ist_mitglied(text, uuid) to authenticated;

-- Trigger: denormalisierte Felder polymorph befuellen
create or replace function public.einladung_vor_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ziel_typ = 'deadline' then
    select d.titel, d.faellig_am into new.ziel_titel, new.ziel_faellig_am
    from public.deadline d where d.id = new.ziel_id;
  elsif new.ziel_typ = 'todo' then
    select t.titel, t.faellig_am into new.ziel_titel, new.ziel_faellig_am
    from public.todo t where t.id = new.ziel_id;
  elsif new.ziel_typ = 'pruefung' then
    select p.titel, p.datum into new.ziel_titel, new.ziel_faellig_am
    from public.pruefung p where p.id = new.ziel_id;
  end if;

  select s.username into new.von_username
  from public.settings s where s.user_id = new.von_user_id;

  return new;
end;
$$;

-- einladung INSERT-Policy: Ersteller-Check jetzt polymorph
drop policy "eigene Zeilen anlegen" on public.einladung;
create policy "eigene Zeilen anlegen" on public.einladung
  for insert with check (
    (select auth.uid()) = von_user_id
    and an_user_id != (select auth.uid())
    and public.ist_ersteller(ziel_typ, ziel_id, (select auth.uid()))
  );

-- deadline-RLS ueber die generalisierte Funktion
drop policy "eigene Zeilen lesen" on public.deadline;
create policy "eigene Zeilen lesen" on public.deadline
  for select using ( public.ist_mitglied('deadline', id) );

drop policy "eigene Zeilen aendern" on public.deadline;
create policy "eigene Zeilen aendern" on public.deadline
  for update using ( public.ist_mitglied('deadline', id) );

drop policy "eigene Zeilen loeschen" on public.deadline;
create policy "eigene Zeilen loeschen" on public.deadline
  for delete using ( public.ist_mitglied('deadline', id) );

-- todo-RLS: lesen fuer Ersteller/Zugewiesene/Mitglieder, schreiben nur Ersteller/Zugewiesene
drop policy "eigene Zeilen lesen" on public.todo;
create policy "eigene Zeilen lesen" on public.todo
  for select using (
    (select auth.uid()) = user_id
    or (select auth.uid()) = zugewiesen_an
    or public.ist_mitglied('todo', id)
  );

drop policy "eigene Zeilen aendern" on public.todo;
create policy "eigene Zeilen aendern" on public.todo
  for update using (
    (select auth.uid()) = user_id
    or (select auth.uid()) = zugewiesen_an
  );

-- deadline_mitglieder-RPC auf die generalisierte Funktion umgestellt (Signatur unveraendert)
create or replace function public.deadline_mitglieder(p_deadline_id uuid)
returns table (user_id uuid, username text, status public.einladung_status, ist_ersteller boolean)
language sql
security definer
set search_path = public
stable
as $$
  select d.user_id, s.username, 'ANGENOMMEN'::public.einladung_status, true
  from public.deadline d
  join public.settings s on s.user_id = d.user_id
  where d.id = p_deadline_id
    and public.ist_mitglied('deadline', d.id)
  union all
  select e.an_user_id, s2.username, e.status, false
  from public.einladung e
  join public.settings s2 on s2.user_id = e.an_user_id
  where e.ziel_typ = 'deadline' and e.ziel_id = p_deadline_id
    and public.ist_mitglied('deadline', p_deadline_id);
$$;

-- anhang-RLS: lesen fuer Mitglieder, schreiben fuer Ersteller/Zugewiesene
create policy "mitglieder lesen" on public.anhang
  for select using ( public.ist_mitglied(ziel_typ, ziel_id) );

create policy "ersteller oder zugewiesener anlegen" on public.anhang
  for insert with check (
    (select auth.uid()) = user_id
    and (
      public.ist_ersteller(ziel_typ, ziel_id, (select auth.uid()))
      or (ziel_typ = 'todo' and exists(
        select 1 from public.todo t where t.id = ziel_id and t.zugewiesen_an = (select auth.uid())
      ))
    )
  );

create policy "ersteller oder zugewiesener loeschen" on public.anhang
  for delete using (
    (select auth.uid()) = user_id
    or public.ist_ersteller(ziel_typ, ziel_id, (select auth.uid()))
    or (ziel_typ = 'todo' and exists(
      select 1 from public.todo t where t.id = ziel_id and t.zugewiesen_an = (select auth.uid())
    ))
  );
