-- Karteikarten: Spaced Repetition mit 4 Bewertungen (Nochmal / Schwer / Gut / Einfach)
-- statt Leitner mit 2 Antworten. Jede Karte hat ihr eigenes Intervall und ihre Leichtigkeit.

alter table public.kk_karte
  add column intervall_tage integer not null default 0 check (intervall_tage between 0 and 36500),
  add column leichtigkeit real not null default 2.5 check (leichtigkeit between 1.3 and 5),
  add column wiederholungen integer not null default 0 check (wiederholungen >= 0),
  add column fehler integer not null default 0 check (fehler >= 0),
  add column zuletzt_gelernt timestamptz null;

-- Bisherigen Leitner-Stand übernehmen: Box 2–5 = schon gelernt, Intervall wie bisher
update public.kk_karte
set
  intervall_tage = case box when 2 then 2 when 3 then 4 when 4 then 8 when 5 then 16 else 0 end,
  wiederholungen = greatest(box - 1, 0)
where box > 1;
