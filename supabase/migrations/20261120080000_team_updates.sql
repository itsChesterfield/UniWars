create table public.team_update_mitglied (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table public.team_update (
  pr integer primary key check (pr > 0),
  merge_sha text not null unique check (merge_sha ~ '^[a-f0-9]{40}$'),
  titel text not null check (char_length(titel) between 1 and 100),
  punkte text[] not null check (
    cardinality(punkte) between 1 and 3
    and char_length(array_to_string(punkte, '')) <= 660
  ),
  aktualisiert_am timestamptz not null,
  aktiv boolean not null default true
);

create table public.team_update_gelesen (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pr integer not null references public.team_update (pr) on delete cascade,
  primary key (user_id, pr)
);

alter table public.team_update_mitglied enable row level security;
alter table public.team_update enable row level security;
alter table public.team_update_gelesen enable row level security;

revoke all on public.team_update_mitglied, public.team_update, public.team_update_gelesen
  from public, anon, authenticated;
grant select on public.team_update_mitglied, public.team_update, public.team_update_gelesen to authenticated;
grant insert (pr) on public.team_update_gelesen to authenticated;
grant select on public.team_update to service_role;

create policy "Eigenen Teamzugriff prüfen" on public.team_update_mitglied
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Briefing nur für das Team" on public.team_update
  for select to authenticated using (
    exists (select 1 from public.team_update_mitglied where user_id = (select auth.uid()))
  );

create policy "Eigenen Lesestatus im Team lesen" on public.team_update_gelesen
  for select to authenticated using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.team_update_mitglied where user_id = (select auth.uid()))
  );

create policy "Eigenen Lesestatus im Team setzen" on public.team_update_gelesen
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.team_update where team_update.pr = team_update_gelesen.pr)
  );

create function public.team_updates_abgleichen(eintraege jsonb, aktive_prs integer[])
returns void
language sql
set search_path = ''
as $$
  insert into public.team_update (pr, merge_sha, titel, punkte, aktualisiert_am)
  select eintrag.pr, eintrag.merge_sha, eintrag.titel, eintrag.punkte, eintrag.aktualisiert_am
  from jsonb_to_recordset(eintraege)
    as eintrag(pr integer, merge_sha text, titel text, punkte text[], aktualisiert_am timestamptz)
  on conflict (pr) do nothing;

  update public.team_update
  set aktiv = (pr = any(aktive_prs))
  where aktiv is distinct from (pr = any(aktive_prs));
$$;

grant insert, update on public.team_update to service_role;
revoke all on function public.team_updates_abgleichen(jsonb, integer[]) from public, anon, authenticated;
grant execute on function public.team_updates_abgleichen(jsonb, integer[]) to service_role;
