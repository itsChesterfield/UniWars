-- PDF Reader: Textmarker (Highlights) mit Farbe und optionaler Notiz.
-- Rechtecke werden relativ zur Seite gespeichert (0…1), damit sie bei jedem Zoom passen.

create table public.pdf_markierung (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  datei_id uuid not null references public.datei(id) on delete cascade,
  seite integer not null check (seite >= 1),
  farbe text not null default 'GELB' check (farbe in ('GELB', 'GRUEN', 'BLAU', 'ROSA', 'ORANGE')),
  rechtecke jsonb not null check (
    jsonb_typeof(rechtecke) = 'array'
    and jsonb_array_length(rechtecke) between 1 and 200
  ),
  text text not null default '' check (char_length(text) <= 5000),
  notiz text null check (char_length(notiz) <= 2000),
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);

create index pdf_markierung_datei_idx on public.pdf_markierung (datei_id, seite);
create index pdf_markierung_user_idx on public.pdf_markierung (user_id);

create trigger pdf_markierung_geaendert_am
  before update on public.pdf_markierung
  for each row execute function public.setze_geaendert_am();

alter table public.pdf_markierung enable row level security;

create policy "pdf_markierung_select_eigene" on public.pdf_markierung
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "pdf_markierung_insert_eigene" on public.pdf_markierung
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.datei d where d.id = datei_id and d.user_id = (select auth.uid()))
  );
create policy "pdf_markierung_update_eigene" on public.pdf_markierung
  for update to authenticated using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.datei d where d.id = datei_id and d.user_id = (select auth.uid()))
  );
create policy "pdf_markierung_delete_eigene" on public.pdf_markierung
  for delete to authenticated using ((select auth.uid()) = user_id);
