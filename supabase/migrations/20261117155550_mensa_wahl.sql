-- Lieblingsmensa (OpenMensa-ID) für den Baustein „Mensa heute“ im Zentralen Hub
alter table public.settings
  add column mensa_id integer check (mensa_id > 0),
  add column mensa_name text check (char_length(mensa_name) <= 160);
