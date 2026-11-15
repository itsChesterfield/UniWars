-- Hubs Stufe 3: Textverarbeitung, Tabellen, Präsentationen (siehe UniWars-Hubs-Spezifikation).
-- Inhalte liegen als JSON vor (Editor-Dokument, Zellen, Folien); Bilder verweisen auf die Dateiablage.

-- ---------------------------------------------------------------------------
-- Textverarbeitung (TXT-01 … TXT-07)
-- ---------------------------------------------------------------------------
create table public.dokument (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fach_id uuid null references public.fach(id) on delete set null,
  titel text not null default '' check (char_length(titel) <= 300),
  -- TipTap-Dokument (JSON)
  inhalt jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  -- Klartext für Suche (ALL-09) und Wortzahl in Listen
  klartext text not null default '' check (char_length(klartext) <= 500000),
  woerter integer not null default 0 check (woerter >= 0),
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  constraint dokument_inhalt_groesse check (pg_column_size(inhalt) <= 5000000)
);

create index dokument_user_idx on public.dokument (user_id, geaendert_am desc);
create index dokument_fach_idx on public.dokument (fach_id);

create trigger dokument_geaendert_am
  before update on public.dokument
  for each row execute function public.setze_geaendert_am();

alter table public.dokument enable row level security;

create policy "dokument_select_eigene" on public.dokument
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "dokument_insert_eigene" on public.dokument
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dokument_update_eigene" on public.dokument
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dokument_delete_eigene" on public.dokument
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Tabellen (TAB-01 … TAB-06)
-- ---------------------------------------------------------------------------
create table public.tabelle (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fach_id uuid null references public.fach(id) on delete set null,
  titel text not null default '' check (char_length(titel) <= 300),
  -- { spalten, zeilen, zellen: { "A1": { w: "=SUMME(A2:A5)", f?: true, bg?: "#…", fmt?: "2"|"%" } } }
  daten jsonb not null default '{"spalten":10,"zeilen":20,"zellen":{}}'::jsonb,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  constraint tabelle_daten_groesse check (pg_column_size(daten) <= 5000000)
);

create index tabelle_user_idx on public.tabelle (user_id, geaendert_am desc);
create index tabelle_fach_idx on public.tabelle (fach_id);

create trigger tabelle_geaendert_am
  before update on public.tabelle
  for each row execute function public.setze_geaendert_am();

alter table public.tabelle enable row level security;

create policy "tabelle_select_eigene" on public.tabelle
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "tabelle_insert_eigene" on public.tabelle
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tabelle_update_eigene" on public.tabelle
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "tabelle_delete_eigene" on public.tabelle
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Präsentationen (PRÄ-01 … PRÄ-07)
-- ---------------------------------------------------------------------------
create table public.praesentation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fach_id uuid null references public.fach(id) on delete set null,
  titel text not null check (char_length(btrim(titel)) between 1 and 200),
  -- PRÄ-05: drei feste Designs
  design text not null default 'HELL' check (design in ('HELL', 'DUNKEL', 'GOLD')),
  -- [{ id, layout: TITEL|TEXT|BILD|ZWEISPALTIG, titel, text, text2, bild_datei_id }]
  folien jsonb not null default '[]'::jsonb check (jsonb_typeof(folien) = 'array'),
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  constraint praesentation_folien_groesse check (pg_column_size(folien) <= 2000000)
);

create index praesentation_user_idx on public.praesentation (user_id, geaendert_am desc);
create index praesentation_fach_idx on public.praesentation (fach_id);

create trigger praesentation_geaendert_am
  before update on public.praesentation
  for each row execute function public.setze_geaendert_am();

alter table public.praesentation enable row level security;

create policy "praesentation_select_eigene" on public.praesentation
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "praesentation_insert_eigene" on public.praesentation
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "praesentation_update_eigene" on public.praesentation
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "praesentation_delete_eigene" on public.praesentation
  for delete to authenticated using ((select auth.uid()) = user_id);
