-- Phase 12: UniWars-Assistent (KI-12). Achtung Namenskonflikt: chat / chat_nachricht gehören
-- zum Chat zwischen Nutzern – alles für den KI-Assistenten heißt ki_… .

create table public.ki_unterhaltung (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titel text not null default 'Neue Unterhaltung' check (char_length(titel) between 1 and 120),
  -- Kurzfassung älterer Nachrichten (Verlaufskürzung), einmal erzeugt
  zusammenfassung text null check (char_length(zusammenfassung) <= 4000),
  -- bis zu welcher Nachricht (Zeitpunkt) die Zusammenfassung reicht
  zusammengefasst_bis timestamptz null,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);

create index ki_unterhaltung_user_idx on public.ki_unterhaltung (user_id, geaendert_am desc);

create trigger ki_unterhaltung_geaendert_am
  before update on public.ki_unterhaltung
  for each row execute function public.setze_geaendert_am();

alter table public.ki_unterhaltung enable row level security;

create policy "ki_unterhaltung_select_eigene" on public.ki_unterhaltung
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "ki_unterhaltung_insert_eigene" on public.ki_unterhaltung
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ki_unterhaltung_update_eigene" on public.ki_unterhaltung
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ki_unterhaltung_delete_eigene" on public.ki_unterhaltung
  for delete to authenticated using ((select auth.uid()) = user_id);

create table public.ki_nachricht (
  id uuid primary key default gen_random_uuid(),
  unterhaltung_id uuid not null references public.ki_unterhaltung(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rolle text not null check (rolle in ('nutzer', 'assistent', 'werkzeug')),
  inhalt text not null default '' check (char_length(inhalt) <= 60000),
  -- Werkzeugaufrufe, Ergebnisse und Aktionskarten (mit Status übernommen/verworfen)
  werkzeug_daten jsonb null,
  eingabe_art text not null default 'text' check (eingabe_art in ('text', 'sprache')),
  erstellt_am timestamptz not null default now()
);

create index ki_nachricht_unterhaltung_idx on public.ki_nachricht (unterhaltung_id, erstellt_am);
create index ki_nachricht_user_idx on public.ki_nachricht (user_id);

alter table public.ki_nachricht enable row level security;

create policy "ki_nachricht_select_eigene" on public.ki_nachricht
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "ki_nachricht_insert_eigene" on public.ki_nachricht
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.ki_unterhaltung u where u.id = unterhaltung_id and u.user_id = (select auth.uid()))
  );
-- Update nur für den Status der Aktionskarten (werkzeug_daten)
create policy "ki_nachricht_update_eigene" on public.ki_nachricht
  for update to authenticated using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.ki_unterhaltung u where u.id = unterhaltung_id and u.user_id = (select auth.uid()))
  );
create policy "ki_nachricht_delete_eigene" on public.ki_nachricht
  for delete to authenticated using ((select auth.uid()) = user_id);
