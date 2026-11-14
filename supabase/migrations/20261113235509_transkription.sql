-- Phase 10: Transkriptions-Hub (TRA-01 … TRA-05) + KI-04.
-- Eine Aufnahme besteht aus Teilen von höchstens 10 Minuten (der Browser teilt beim Aufnehmen),
-- jeder Teil wird einzeln transkribiert und gebucht. Hochgeladene Dateien sind ein Teil.

-- ---------------------------------------------------------------------------
-- Dateiablage: Browser-Aufnahmen (WebM/Opus, Ogg) erlauben
-- ---------------------------------------------------------------------------
update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct m)
  from unnest(coalesce(allowed_mime_types, '{}') || array['audio/webm', 'audio/ogg']) as m
)
where id = 'dateiablage';

-- ---------------------------------------------------------------------------
-- Transkript (TRA-03 … TRA-05)
-- ---------------------------------------------------------------------------
create table public.transkript (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fach_id uuid null references public.fach(id) on delete set null,
  titel text not null check (char_length(btrim(titel)) between 1 and 200),
  quelle text not null default 'aufnahme' check (quelle in ('aufnahme', 'datei')),
  sprache text not null default 'de' check (sprache in ('de', 'en')),
  -- TRA-04: bearbeitbare Absätze [{ teil, start, ende, text }] (Zeiten relativ zum Teil, in Sekunden)
  absaetze jsonb not null default '[]'::jsonb check (jsonb_typeof(absaetze) = 'array'),
  text text not null default '' check (char_length(text) <= 400000),
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);

create index transkript_user_idx on public.transkript (user_id, erstellt_am desc);
create index transkript_fach_idx on public.transkript (fach_id);

create trigger transkript_geaendert_am
  before update on public.transkript
  for each row execute function public.setze_geaendert_am();

alter table public.transkript enable row level security;

create policy "transkript_select_eigene" on public.transkript
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "transkript_insert_eigene" on public.transkript
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "transkript_update_eigene" on public.transkript
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "transkript_delete_eigene" on public.transkript
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Teile einer Aufnahme (je eine Audiodatei)
-- Status: ausstehend → in_bearbeitung → fertig / fehler
-- ---------------------------------------------------------------------------
create table public.transkript_teil (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  transkript_id uuid not null references public.transkript(id) on delete cascade,
  nr integer not null check (nr between 1 and 30),
  -- Audiodatei gelöscht → Text bleibt, nur das Abspielen geht nicht mehr
  datei_id uuid null references public.datei(id) on delete set null,
  -- Länge laut Browser (für die Buchung vorab), Sekunden
  sekunden integer not null check (sekunden between 1 and 7200),
  status text not null default 'ausstehend' check (status in ('ausstehend', 'in_bearbeitung', 'fertig', 'fehler')),
  fehler text null check (char_length(fehler) <= 500),
  gestartet_am timestamptz null,
  text text not null default '' check (char_length(text) <= 200000),
  segmente jsonb not null default '[]'::jsonb check (jsonb_typeof(segmente) = 'array'),
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  unique (transkript_id, nr)
);

create index transkript_teil_user_idx on public.transkript_teil (user_id);
create index transkript_teil_datei_idx on public.transkript_teil (datei_id);

create trigger transkript_teil_geaendert_am
  before update on public.transkript_teil
  for each row execute function public.setze_geaendert_am();

alter table public.transkript_teil enable row level security;

create policy "transkript_teil_select_eigene" on public.transkript_teil
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "transkript_teil_insert_eigene" on public.transkript_teil
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.transkript t where t.id = transkript_id and t.user_id = (select auth.uid()))
    and (datei_id is null or exists (select 1 from public.datei d where d.id = datei_id and d.user_id = (select auth.uid())))
  );
create policy "transkript_teil_update_eigene" on public.transkript_teil
  for update to authenticated using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.transkript t where t.id = transkript_id and t.user_id = (select auth.uid()))
    and (datei_id is null or exists (select 1 from public.datei d where d.id = datei_id and d.user_id = (select auth.uid())))
  );
create policy "transkript_teil_delete_eigene" on public.transkript_teil
  for delete to authenticated using ((select auth.uid()) = user_id);

-- KI-04: aufbereitete Notizen aus einem Transkript (Herkunft, wie quelle_notiz_id bei Karten)
alter table public.notiz add column quelle_transkript_id uuid null references public.transkript(id) on delete set null;
create index notiz_quelle_transkript_idx on public.notiz (quelle_transkript_id);
