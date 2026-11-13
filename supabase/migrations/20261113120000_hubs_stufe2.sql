-- Hubs Stufe 2: Dateiablage, PDF Reader, Literaturverwaltung (siehe UniWars-Hubs-Spezifikation).
-- Baut auf 20261113100000_hubs_stufe1.sql auf (Funktion setze_geaendert_am).

-- ---------------------------------------------------------------------------
-- Storage-Bucket (DAT-02): privat, max. 25 MB, nur erlaubte Typen
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dateiablage',
  'dateiablage',
  false,
  26214400,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a',
    'audio/wav',
    'audio/x-wav',
    'audio/wave'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Jeder Nutzer nur in seinem eigenen Ordner: <user_id>/...
create policy "dateiablage_select_eigene" on storage.objects
  for select to authenticated
  using (bucket_id = 'dateiablage' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "dateiablage_insert_eigene" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dateiablage' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "dateiablage_update_eigene" on storage.objects
  for update to authenticated
  using (bucket_id = 'dateiablage' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "dateiablage_delete_eigene" on storage.objects
  for delete to authenticated
  using (bucket_id = 'dateiablage' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Dateien (DAT-01 … DAT-09)
-- ---------------------------------------------------------------------------
create table public.datei (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- ALL-05 / DAT-01: Fach weg -> Datei landet in "Allgemein"
  fach_id uuid null references public.fach(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  groesse bigint not null check (groesse >= 0 and groesse <= 26214400),
  mime_typ text not null,
  speicher_pfad text not null unique,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);

-- DAT-02: gleicher Name im selben Ordner nicht doppelt
create unique index datei_name_pro_ordner_idx
  on public.datei (user_id, coalesce(fach_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index datei_user_idx on public.datei (user_id, erstellt_am desc);

create trigger datei_geaendert_am
  before update on public.datei
  for each row execute function public.setze_geaendert_am();

alter table public.datei enable row level security;

create policy "datei_select_eigene" on public.datei
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "datei_insert_eigene" on public.datei
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and speicher_pfad like (select auth.uid())::text || '/%'
  );
create policy "datei_update_eigene" on public.datei
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "datei_delete_eigene" on public.datei
  for delete to authenticated using ((select auth.uid()) = user_id);

-- DAT-09: Speicherlimit pro Nutzer (2 GB) – auch in der Datenbank abgesichert
create or replace function public.datei_speicherlimit_pruefen()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_belegt bigint;
begin
  select coalesce(sum(groesse), 0) into v_belegt from public.datei where user_id = new.user_id;
  if v_belegt + new.groesse > 2147483648 then
    raise exception 'SPEICHER_VOLL';
  end if;
  return new;
end;
$$;

create trigger datei_speicherlimit
  before insert on public.datei
  for each row execute function public.datei_speicherlimit_pruefen();

-- DAT-08: Dateien aus der Ablage können an Deadlines/To-dos angehängt werden
alter table public.anhang
  add column datei_id uuid null references public.datei(id) on delete cascade;
create index anhang_datei_idx on public.anhang (datei_id);

-- ---------------------------------------------------------------------------
-- PDF Reader (PDF-04, PDF-05): Lesezeichen und zuletzt gelesene Seite
-- ---------------------------------------------------------------------------
create table public.pdf_stand (
  datei_id uuid primary key references public.datei(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  letzte_seite integer not null default 1 check (letzte_seite >= 1),
  lesezeichen integer[] not null default '{}',
  geaendert_am timestamptz not null default now()
);

create trigger pdf_stand_geaendert_am
  before update on public.pdf_stand
  for each row execute function public.setze_geaendert_am();

alter table public.pdf_stand enable row level security;

create policy "pdf_stand_select_eigene" on public.pdf_stand
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "pdf_stand_insert_eigene" on public.pdf_stand
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.datei d where d.id = datei_id and d.user_id = (select auth.uid()))
  );
create policy "pdf_stand_update_eigene" on public.pdf_stand
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "pdf_stand_delete_eigene" on public.pdf_stand
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Literaturverwaltung (LIT-01 … LIT-06)
-- ---------------------------------------------------------------------------
create table public.quelle (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  typ text not null check (typ in ('BUCH', 'ARTIKEL', 'WEBSEITE')),
  autoren text not null check (char_length(btrim(autoren)) between 1 and 1000),
  titel text not null check (char_length(btrim(titel)) between 1 and 500),
  jahr integer not null check (jahr between 1000 and 2200),
  verlag text null check (char_length(verlag) <= 300),
  url text null check (char_length(url) <= 2000),
  abgerufen_am date null,
  seiten text null check (char_length(seiten) <= 50),
  fach_id uuid null references public.fach(id) on delete set null,
  notiz text null check (char_length(notiz) <= 5000),
  datei_id uuid null references public.datei(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  -- Webseiten brauchen URL und Abrufdatum
  constraint quelle_webseite_pflicht check (typ <> 'WEBSEITE' or (url is not null and abgerufen_am is not null))
);

create index quelle_user_idx on public.quelle (user_id, geaendert_am desc);

create trigger quelle_geaendert_am
  before update on public.quelle
  for each row execute function public.setze_geaendert_am();

alter table public.quelle enable row level security;

create policy "quelle_select_eigene" on public.quelle
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "quelle_insert_eigene" on public.quelle
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "quelle_update_eigene" on public.quelle
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "quelle_delete_eigene" on public.quelle
  for delete to authenticated using ((select auth.uid()) = user_id);
