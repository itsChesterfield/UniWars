-- PDF Reader: eigene Ordner für PDFs (unabhängig von den Fach-Ordnern der Dateiablage)

create table public.pdf_ordner (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  erstellt_am timestamptz not null default now()
);

create index pdf_ordner_user_idx on public.pdf_ordner (user_id);
create unique index pdf_ordner_name_eindeutig on public.pdf_ordner (user_id, lower(btrim(name)));

alter table public.pdf_ordner enable row level security;

create policy "pdf_ordner_select_eigene" on public.pdf_ordner
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "pdf_ordner_insert_eigene" on public.pdf_ordner
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "pdf_ordner_update_eigene" on public.pdf_ordner
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "pdf_ordner_delete_eigene" on public.pdf_ordner
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Wird ein Ordner gelöscht, landen seine PDFs wieder in "Ohne Ordner"
alter table public.datei add column pdf_ordner_id uuid null references public.pdf_ordner(id) on delete set null;
create index datei_pdf_ordner_idx on public.datei (pdf_ordner_id);
