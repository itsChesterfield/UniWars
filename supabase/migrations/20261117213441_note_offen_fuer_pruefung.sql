-- Prüfung legt eine offene Note an: Note darf leer sein (= ausstehend) und gehört zu höchstens einer Prüfung
alter table public.note alter column wert drop not null;
alter table public.note add column pruefung_id uuid references public.pruefung (id) on delete set null;
create unique index note_pruefung_eindeutig on public.note (pruefung_id) where pruefung_id is not null;

-- Schnitt nur aus eingetragenen Noten
create or replace function public.notenschnitt() returns numeric
language sql stable set search_path to 'public' as $$
  select round(sum(wert * gewicht) / nullif(sum(gewicht), 0), 1)
  from note
  where user_id = auth.uid() and wert is not null;
$$;

-- Vorhandene anstehende Prüfungen bekommen ihre offene Note.
-- Hinweis: Beim Einspielen am 17.11. direkt wieder entfernt, weil die damalige Live-Version leere Noten
-- noch nicht kannte; wird beim Live-Schalten mit derselben Abfrage nachgetragen.
insert into public.note (user_id, fach_id, titel, datum, gewicht, wert, pruefung_id)
select p.user_id, p.fach_id, p.titel, (p.datum at time zone 'Europe/Berlin')::date, 1, null, p.id
from public.pruefung p
where p.status = 'ANSTEHEND'
  and not exists (select 1 from public.note n where n.pruefung_id = p.id);
