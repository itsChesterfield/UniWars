-- Lernraum (wie NotebookLM): ein Lernraum pro Fach, Quellen = PDFs und Notizen des Fachs
create table public.lernraum (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fach_id uuid not null references public.fach(id) on delete cascade,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  unique (user_id, fach_id)
);
create trigger lernraum_geaendert_am before update on public.lernraum for each row execute function public.setze_geaendert_am();

-- Abweichungen von den automatischen Quellen: "aus" (ausgeschaltet) oder "extra" (fachfremd dazugenommen)
create table public.lernraum_quelle (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lernraum_id uuid not null references public.lernraum(id) on delete cascade,
  datei_id uuid null references public.datei(id) on delete cascade,
  notiz_id uuid null references public.notiz(id) on delete cascade,
  status text not null check (status in ('aus', 'extra')),
  erstellt_am timestamptz not null default now(),
  constraint lernraum_quelle_ein_ziel check ((datei_id is null) <> (notiz_id is null))
);
create unique index lernraum_quelle_datei on public.lernraum_quelle (lernraum_id, datei_id) where datei_id is not null;
create unique index lernraum_quelle_notiz on public.lernraum_quelle (lernraum_id, notiz_id) where notiz_id is not null;

-- Eingelesener Text der PDF-Seiten (einmal im Browser gelesen, dann für jede Frage verfügbar)
create table public.quelle_seite (
  datei_id uuid not null references public.datei(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  seite integer not null check (seite >= 1),
  text text not null check (char_length(text) <= 30000),
  primary key (datei_id, seite)
);

-- Überblick je Quelle (Zusammenfassung, Themen, Vorschlagsfragen) – zwischengespeichert
create table public.quelle_ueberblick (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  datei_id uuid null references public.datei(id) on delete cascade,
  notiz_id uuid null references public.notiz(id) on delete cascade,
  stand text not null,
  inhalt jsonb not null,
  erstellt_am timestamptz not null default now(),
  constraint quelle_ueberblick_ein_ziel check ((datei_id is null) <> (notiz_id is null))
);
create unique index quelle_ueberblick_datei on public.quelle_ueberblick (datei_id) where datei_id is not null;
create unique index quelle_ueberblick_notiz on public.quelle_ueberblick (notiz_id) where notiz_id is not null;

-- Chatverlauf im Lernraum
create table public.lernraum_nachricht (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lernraum_id uuid not null references public.lernraum(id) on delete cascade,
  rolle text not null check (rolle in ('nutzer', 'ki')),
  inhalt text not null check (char_length(inhalt) <= 40000),
  meta jsonb not null default '{}',
  erstellt_am timestamptz not null default now()
);
create index lernraum_nachricht_raum_idx on public.lernraum_nachricht (lernraum_id, erstellt_am);

-- Lernprofil: wie die KI erklären soll (lernt aus Rückmeldungen)
alter table public.settings add column ki_profil jsonb not null default '{}';

-- RLS: alles nur für den eigenen Account
alter table public.lernraum enable row level security;
alter table public.lernraum_quelle enable row level security;
alter table public.quelle_seite enable row level security;
alter table public.quelle_ueberblick enable row level security;
alter table public.lernraum_nachricht enable row level security;

create policy "lernraum_eigene" on public.lernraum for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.fach f where f.id = fach_id and f.user_id = (select auth.uid())));
create policy "lernraum_quelle_eigene" on public.lernraum_quelle for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.lernraum l where l.id = lernraum_id and l.user_id = (select auth.uid())));
create policy "quelle_seite_eigene" on public.quelle_seite for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.datei d where d.id = datei_id and d.user_id = (select auth.uid())));
create policy "quelle_ueberblick_eigene" on public.quelle_ueberblick for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "lernraum_nachricht_eigene" on public.lernraum_nachricht for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.lernraum l where l.id = lernraum_id and l.user_id = (select auth.uid())));
