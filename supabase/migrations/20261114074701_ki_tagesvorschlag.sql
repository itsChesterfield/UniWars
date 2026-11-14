-- Phase 14: Lernplan-Agent (KI-05). Einmal pro Tag beim ersten Öffnen des Dashboards erzeugt.
create table public.ki_tagesvorschlag (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  datum date not null,
  -- laeuft: wird gerade erzeugt (verhindert doppelte KI-Aufrufe aus zwei Tabs)
  status text not null default 'laeuft' check (status in ('laeuft', 'fertig', 'fehler')),
  -- [{ grund, karte: Aktionskarte }] – höchstens 3
  vorschlaege jsonb not null default '[]'::jsonb check (jsonb_typeof(vorschlaege) = 'array'),
  -- „Neu erstellen“ ist einmal pro Tag erlaubt
  neu_erstellt boolean not null default false,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  unique (user_id, datum)
);

create trigger ki_tagesvorschlag_geaendert_am
  before update on public.ki_tagesvorschlag
  for each row execute function public.setze_geaendert_am();

alter table public.ki_tagesvorschlag enable row level security;

create policy "ki_tagesvorschlag_select_eigene" on public.ki_tagesvorschlag
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "ki_tagesvorschlag_insert_eigene" on public.ki_tagesvorschlag
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ki_tagesvorschlag_update_eigene" on public.ki_tagesvorschlag
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ki_tagesvorschlag_delete_eigene" on public.ki_tagesvorschlag
  for delete to authenticated using ((select auth.uid()) = user_id);
