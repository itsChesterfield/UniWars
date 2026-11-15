
-- 1) Eindeutiger Nutzername auf settings
alter table public.settings
  add column username text;

alter table public.settings
  add constraint settings_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');

create unique index settings_username_unique on public.settings (username);

-- Bestehende Nutzer aus user_metadata befuellen (best effort)
update public.settings s
set username = nullif(lower(regexp_replace(u.raw_user_meta_data->>'username', '[^a-zA-Z0-9_]', '', 'g')), '')
from auth.users u
where u.id = s.user_id
  and s.username is null
  and u.raw_user_meta_data->>'username' is not null
  and length(regexp_replace(u.raw_user_meta_data->>'username', '[^a-zA-Z0-9_]', '', 'g')) >= 3;

-- handle_new_user erweitert: Nutzername beim Signup uebernehmen
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := nullif(lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', ''), '[^a-zA-Z0-9_]', '', 'g')), '');

  insert into public.settings (user_id, username)
  values (new.id, v_username)
  on conflict (user_id) do nothing;

  return new;
exception
  when unique_violation then
    raise exception 'USERNAME_TAKEN';
end;
$$;

-- Verfuegbarkeit vor dem Signup pruefen (auch fuer nicht angemeldete Nutzer)
create or replace function public.ist_username_verfuegbar(p_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from public.settings where username = lower(p_username)
  );
$$;

grant execute on function public.ist_username_verfuegbar(text) to anon, authenticated;

-- Nutzer per Nutzername suchen (fuer Einladungen)
create or replace function public.benutzer_suchen(suchtext text)
returns table (user_id uuid, username text)
language sql
security definer
set search_path = public
stable
as $$
  select s.user_id, s.username
  from public.settings s
  where s.username is not null
    and s.username ilike lower(suchtext) || '%'
    and s.user_id != (select auth.uid())
  order by s.username
  limit 8;
$$;

grant execute on function public.benutzer_suchen(text) to authenticated;

-- Exakte Nutzername-Aufloesung
create or replace function public.user_id_von_username(p_username text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select user_id from public.settings where username = lower(p_username);
$$;

grant execute on function public.user_id_von_username(text) to authenticated;

-- 2) Unteraufgaben: Deadlines koennen zu einem Todo oder einer Pruefung gehoeren
alter table public.deadline
  add column todo_id uuid references public.todo(id) on delete cascade,
  add column pruefung_id uuid references public.pruefung(id) on delete cascade;

create index deadline_todo_id_idx on public.deadline(todo_id);
create index deadline_pruefung_id_idx on public.deadline(pruefung_id);

-- 3) Einladungen (Inbox) fuer geteilte Deadlines
create type public.einladung_status as enum ('OFFEN', 'ANGENOMMEN', 'ABGELEHNT');

create table public.einladung (
  id uuid primary key default gen_random_uuid(),
  deadline_id uuid not null references public.deadline(id) on delete cascade,
  von_user_id uuid not null references auth.users(id) on delete cascade,
  an_user_id uuid not null references auth.users(id) on delete cascade,
  status public.einladung_status not null default 'OFFEN',
  deadline_titel text not null,
  deadline_faellig_am timestamptz not null,
  von_username text,
  erstellt_am timestamptz not null default now(),
  beantwortet_am timestamptz,
  unique (deadline_id, an_user_id)
);

alter table public.einladung enable row level security;

create policy "eigene Zeilen lesen" on public.einladung
  for select using ((select auth.uid()) = an_user_id or (select auth.uid()) = von_user_id);

create policy "eigene Zeilen anlegen" on public.einladung
  for insert with check (
    (select auth.uid()) = von_user_id
    and an_user_id != (select auth.uid())
    and exists (
      select 1 from public.deadline d
      where d.id = deadline_id and d.user_id = (select auth.uid())
    )
  );

create policy "eigene Zeilen aendern" on public.einladung
  for update using ((select auth.uid()) = an_user_id or (select auth.uid()) = von_user_id);

create policy "eigene Zeilen loeschen" on public.einladung
  for delete using ((select auth.uid()) = an_user_id or (select auth.uid()) = von_user_id);

-- Denormalisierte Felder automatisch befuellen (Empfaenger darf die Deadline selbst noch nicht lesen)
create or replace function public.einladung_vor_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select d.titel, d.faellig_am into new.deadline_titel, new.deadline_faellig_am
  from public.deadline d where d.id = new.deadline_id;

  select s.username into new.von_username
  from public.settings s where s.user_id = new.von_user_id;

  return new;
end;
$$;

create trigger einladung_vor_insert_trigger
before insert on public.einladung
for each row execute function public.einladung_vor_insert();

-- Nur der Eingeladene darf den Status einmalig aendern (annehmen/ablehnen)
create or replace function public.einladung_status_pruefen()
returns trigger
language plpgsql
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

create trigger einladung_vor_update_trigger
before update on public.einladung
for each row execute function public.einladung_status_pruefen();

-- 4) deadline-RLS: angenommene Mitglieder bekommen volle Rechte
drop policy "eigene Zeilen lesen" on public.deadline;
create policy "eigene Zeilen lesen" on public.deadline
  for select using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.einladung e
      where e.deadline_id = deadline.id
        and e.an_user_id = (select auth.uid())
        and e.status = 'ANGENOMMEN'
    )
  );

drop policy "eigene Zeilen aendern" on public.deadline;
create policy "eigene Zeilen aendern" on public.deadline
  for update using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.einladung e
      where e.deadline_id = deadline.id
        and e.an_user_id = (select auth.uid())
        and e.status = 'ANGENOMMEN'
    )
  );

drop policy "eigene Zeilen loeschen" on public.deadline;
create policy "eigene Zeilen loeschen" on public.deadline
  for delete using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.einladung e
      where e.deadline_id = deadline.id
        and e.an_user_id = (select auth.uid())
        and e.status = 'ANGENOMMEN'
    )
  );

-- 5) Mitglieder-Liste einer Deadline (fuer die UI, nur Ersteller oder angenommene Mitglieder)
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
    and (
      d.user_id = (select auth.uid())
      or exists (select 1 from public.einladung e2 where e2.deadline_id = d.id and e2.an_user_id = (select auth.uid()) and e2.status = 'ANGENOMMEN')
    )
  union all
  select e.an_user_id, s2.username, e.status, false
  from public.einladung e
  join public.settings s2 on s2.user_id = e.an_user_id
  where e.deadline_id = p_deadline_id
    and (
      exists (select 1 from public.deadline d2 where d2.id = e.deadline_id and d2.user_id = (select auth.uid()))
      or e.an_user_id = (select auth.uid())
      or exists (select 1 from public.einladung e3 where e3.deadline_id = p_deadline_id and e3.an_user_id = (select auth.uid()) and e3.status = 'ANGENOMMEN')
    );
$$;

grant execute on function public.deadline_mitglieder(uuid) to authenticated;
