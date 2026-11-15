-- Notiz mit einer PDF verknüpfen (PDF Reader zeigt die Notizen in der Seitenleiste)
alter table public.notiz add column datei_id uuid null references public.datei(id) on delete set null;
create index notiz_datei_idx on public.notiz (datei_id);
