-- Persönliches Modell: UniVerse Studio lernt die Person kennen
create table public.ki_gedaechtnis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bereich text not null check (bereich in ('ziel', 'rahmen', 'lernstil', 'wissen', 'rhythmus', 'interesse', 'kommunikation')),
  inhalt text not null check (char_length(inhalt) between 1 and 300),
  quelle text not null default 'gespraech' check (quelle in ('ausdruecklich', 'gespraech', 'ergebnis', 'kennenlernen')),
  sicherheit real not null default 0.8 check (sicherheit >= 0 and sicherheit <= 1),
  status text not null default 'aktiv' check (status in ('aktiv', 'vorschlag', 'verworfen')),
  fest boolean not null default false,
  nachricht_id uuid null references public.ki_nachricht(id) on delete set null,
  zuletzt_genutzt timestamptz null,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);
create index ki_gedaechtnis_user_idx on public.ki_gedaechtnis (user_id, status);
create trigger ki_gedaechtnis_geaendert_am before update on public.ki_gedaechtnis for each row execute function public.setze_geaendert_am();

create table public.ki_thema_stand (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fach_id uuid null references public.fach(id) on delete cascade,
  thema text not null check (char_length(thema) between 1 and 80),
  beherrschung real not null default 0.5 check (beherrschung >= 0 and beherrschung <= 1),
  versuche integer not null default 0,
  fehlerbild text null check (fehlerbild is null or char_length(fehlerbild) <= 300),
  aktualisiert_am timestamptz not null default now(),
  unique (user_id, fach_id, thema)
);
create index ki_thema_stand_user_idx on public.ki_thema_stand (user_id, fach_id);

alter table public.settings add column ki_gedaechtnis_an boolean not null default true;
alter table public.settings add column ki_kennenlernen jsonb not null default '{}';

alter table public.ki_gedaechtnis enable row level security;
alter table public.ki_thema_stand enable row level security;
create policy "ki_gedaechtnis_eigene" on public.ki_gedaechtnis for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ki_thema_stand_eigene" on public.ki_thema_stand for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (fach_id is null or exists (select 1 from public.fach f where f.id = fach_id and f.user_id = (select auth.uid()))));

-- Bisherige dauerhafte Wünsche aus dem Lernprofil übernehmen
insert into public.ki_gedaechtnis (user_id, bereich, inhalt, quelle, sicherheit)
select s.user_id, 'lernstil', left(h.wert, 300), 'ausdruecklich', 1
from public.settings s, jsonb_array_elements_text(coalesce(s.ki_profil -> 'hinweise', '[]'::jsonb)) as h(wert)
where char_length(trim(h.wert)) > 0;
