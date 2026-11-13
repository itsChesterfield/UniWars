-- Hubs Stufe 1: Notizen, Karteikarten, Work Station (siehe UniWars-Hubs-Spezifikation).
-- Lernsitzungen der Work Station nutzen die bestehende Tabelle lern_session.

-- ALL-06: geaendert_am automatisch pflegen
create or replace function public.setze_geaendert_am()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.geaendert_am := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notizen (NOT-01 … NOT-08)
-- ---------------------------------------------------------------------------
create table public.notiz (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- ALL-05: Fach gelöscht -> Notiz bleibt, steht auf "Ohne Fach"
  fach_id uuid null references public.fach(id) on delete set null,
  titel text not null default '' check (char_length(titel) <= 300),
  inhalt text not null default '' check (char_length(inhalt) <= 200000),
  angepinnt boolean not null default false,
  -- NOT-08: Mitschrift zu einer Vorlesung aus dem Stundenplan
  stundenplan_eintrag_id uuid null references public.stundenplan_eintrag(id) on delete set null,
  vorlesung_datum date null,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);

create index notiz_user_sortierung_idx on public.notiz (user_id, angepinnt desc, geaendert_am desc);
create index notiz_fach_idx on public.notiz (fach_id);

create trigger notiz_geaendert_am
  before update on public.notiz
  for each row execute function public.setze_geaendert_am();

alter table public.notiz enable row level security;

create policy "notiz_select_eigene" on public.notiz
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "notiz_insert_eigene" on public.notiz
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "notiz_update_eigene" on public.notiz
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "notiz_delete_eigene" on public.notiz
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Karteikarten (KK-01 … KK-06)
-- ---------------------------------------------------------------------------
create table public.kk_stapel (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fach_id uuid null references public.fach(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);

create index kk_stapel_user_idx on public.kk_stapel (user_id, geaendert_am desc);
create index kk_stapel_fach_idx on public.kk_stapel (fach_id);

create trigger kk_stapel_geaendert_am
  before update on public.kk_stapel
  for each row execute function public.setze_geaendert_am();

create table public.kk_karte (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  stapel_id uuid not null references public.kk_stapel(id) on delete cascade,
  vorderseite text not null check (char_length(btrim(vorderseite)) between 1 and 5000),
  rueckseite text not null check (char_length(btrim(rueckseite)) between 1 and 5000),
  -- KK-05 Leitner: Box 1–5, neue Karten sofort fällig
  box smallint not null default 1 check (box between 1 and 5),
  naechste_abfrage timestamptz not null default now(),
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);

create index kk_karte_stapel_idx on public.kk_karte (stapel_id, erstellt_am);
create index kk_karte_faellig_idx on public.kk_karte (user_id, naechste_abfrage);

create trigger kk_karte_geaendert_am
  before update on public.kk_karte
  for each row execute function public.setze_geaendert_am();

alter table public.kk_stapel enable row level security;
alter table public.kk_karte enable row level security;

create policy "kk_stapel_select_eigene" on public.kk_stapel
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "kk_stapel_insert_eigene" on public.kk_stapel
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "kk_stapel_update_eigene" on public.kk_stapel
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "kk_stapel_delete_eigene" on public.kk_stapel
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Karten nur in eigenen Stapeln
create policy "kk_karte_select_eigene" on public.kk_karte
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "kk_karte_insert_eigene" on public.kk_karte
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.kk_stapel s where s.id = stapel_id and s.user_id = (select auth.uid()))
  );
create policy "kk_karte_update_eigene" on public.kk_karte
  for update to authenticated using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.kk_stapel s where s.id = stapel_id and s.user_id = (select auth.uid()))
  );
create policy "kk_karte_delete_eigene" on public.kk_karte
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Work Station (WS-04): Timer-Einstellungen pro Nutzer
-- ---------------------------------------------------------------------------
alter table public.settings
  add column work_station jsonb not null default '{}'::jsonb;

-- WS-03: Sitzungen landen in lern_session. Die App schreibt dort jetzt erstmals,
-- daher eigene Policies sicherstellen (idempotent, zusätzlich zu evtl. vorhandenen).
alter table public.lern_session enable row level security;

drop policy if exists "lern_session_select_eigene" on public.lern_session;
create policy "lern_session_select_eigene" on public.lern_session
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "lern_session_insert_eigene" on public.lern_session;
create policy "lern_session_insert_eigene" on public.lern_session
  for insert to authenticated with check ((select auth.uid()) = user_id);
