-- Google-Kalender-Anbindung: UniWars schreibt in einen eigenen "UniWars"-Kalender
-- beim Nutzer, liest aus Google nur Frei/Belegt-Zeiten (werden nicht gespeichert).

create table public.kalender_verbindung (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  anbieter text not null default 'google' check (anbieter in ('google')),
  -- Tokens sind serverseitig mit AES-256-GCM verschluesselt (KALENDER_TOKEN_SCHLUESSEL).
  refresh_token text not null,
  access_token text,
  access_token_ablauf timestamptz,
  kalender_id text,
  zuletzt_abgeglichen timestamptz,
  erstellt_am timestamptz not null default now()
);

alter table public.kalender_verbindung enable row level security;

create policy "eigene Zeilen lesen" on public.kalender_verbindung
  for select using ((select auth.uid()) = user_id);
create policy "eigene Zeilen anlegen" on public.kalender_verbindung
  for insert with check ((select auth.uid()) = user_id);
create policy "eigene Zeilen aendern" on public.kalender_verbindung
  for update using ((select auth.uid()) = user_id);
create policy "eigene Zeilen loeschen" on public.kalender_verbindung
  for delete using ((select auth.uid()) = user_id);

-- Welche UniWars-Zeile zu welchem Google-Event gehoert; inhalt_hash verhindert
-- unnoetige Updates, wenn sich am Eintrag nichts geaendert hat.
create table public.kalender_eintrag (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  quelle_typ text not null check (quelle_typ in ('deadline', 'pruefung', 'stundenplan', 'todo')),
  quelle_id uuid not null,
  google_event_id text not null,
  inhalt_hash text not null,
  primary key (user_id, quelle_typ, quelle_id)
);

alter table public.kalender_eintrag enable row level security;

create policy "eigene Zeilen lesen" on public.kalender_eintrag
  for select using ((select auth.uid()) = user_id);
create policy "eigene Zeilen anlegen" on public.kalender_eintrag
  for insert with check ((select auth.uid()) = user_id);
create policy "eigene Zeilen aendern" on public.kalender_eintrag
  for update using ((select auth.uid()) = user_id);
create policy "eigene Zeilen loeschen" on public.kalender_eintrag
  for delete using ((select auth.uid()) = user_id);

-- Dauer fuer Kalenderbloecke; null = Standard je Typ (im Code).
alter table public.deadline
  add column dauer_minuten integer check (dauer_minuten between 1 and 1440);
alter table public.pruefung
  add column dauer_minuten integer check (dauer_minuten between 1 and 1440);
