-- Verlinkungen aus Notizen ([[Notiz]], [[Skript.pdf#S12]]) – wird beim Speichern aus dem Text erzeugt.
-- Dient für Rückverweise ("Verlinkt von") und für die Notizen-Liste im PDF Reader.
create table public.notiz_link (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  von_notiz_id uuid not null references public.notiz(id) on delete cascade,
  ziel_notiz_id uuid null references public.notiz(id) on delete cascade,
  ziel_datei_id uuid null references public.datei(id) on delete cascade,
  seite integer null check (seite is null or seite >= 1),
  erstellt_am timestamptz not null default now(),
  constraint notiz_link_genau_ein_ziel check ((ziel_notiz_id is null) <> (ziel_datei_id is null))
);

create index notiz_link_user_idx on public.notiz_link (user_id);
create index notiz_link_von_idx on public.notiz_link (von_notiz_id);
create index notiz_link_ziel_notiz_idx on public.notiz_link (ziel_notiz_id);
create index notiz_link_ziel_datei_idx on public.notiz_link (ziel_datei_id);

alter table public.notiz_link enable row level security;

create policy "notiz_link_select_eigene" on public.notiz_link
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "notiz_link_insert_eigene" on public.notiz_link
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.notiz n where n.id = von_notiz_id and n.user_id = (select auth.uid()))
  );
create policy "notiz_link_delete_eigene" on public.notiz_link
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Bisherige feste PDF-Zuordnung (notiz.datei_id) als Verlinkung übernehmen
insert into public.notiz_link (user_id, von_notiz_id, ziel_datei_id)
select n.user_id, n.id, n.datei_id from public.notiz n where n.datei_id is not null;
