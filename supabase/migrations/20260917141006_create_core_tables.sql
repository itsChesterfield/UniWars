-- Fach: die Wurzel-Entität
create table fach (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  semester    text,
  farbe       text,               -- Hex, z.B. '#3B82F6'
  ects        numeric,            -- nullable
  anwesenheitspflicht boolean not null default false,
  max_fehltage        integer,    -- nur wenn Anwesenheitspflicht
  fehltage_genutzt    integer not null default 0,
  aktiv       boolean not null default true,
  erstellt_am timestamptz not null default now()
);

create table deadline (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  fach_id     uuid references fach (id) on delete cascade,
  titel       text not null,
  faellig_am  timestamptz not null,
  typ         deadline_typ not null default 'SONSTIGE',
  kategorie   deadline_kategorie not null default 'NORMAL',
  erledigt    boolean not null default false,
  quelle      quelle not null default 'MANUELL',
  extern_uid  text,               -- für iCal-Dedup, nullable
  wiederhol_regel text            -- z.B. 'woechentlich_FR', nullable
);

create table todo (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  fach_id     uuid references fach (id) on delete set null,   -- To-Do darf fachlos sein
  titel       text not null,
  prioritaet  prioritaet not null default 'MITTEL',
  erledigt    boolean not null default false,
  erstellt_am timestamptz not null default now()
);

create table note (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  fach_id     uuid not null references fach (id) on delete cascade,
  titel       text not null,
  wert        numeric not null,   -- dt. Skala 1.0–5.0
  gewicht     numeric not null default 1.0,
  bestanden   boolean,            -- nullable; sonst aus wert <= 4.0 ableitbar
  datum       date not null default current_date
);

create table pruefung (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  fach_id     uuid not null references fach (id) on delete cascade,
  titel       text not null,
  datum       timestamptz not null,
  raum        text,
  status      pruefung_status not null default 'ANSTEHEND'
);

create table stundenplan_eintrag (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  fach_id     uuid not null references fach (id) on delete cascade,
  tag         wochentag not null,
  start_zeit  time not null,
  end_zeit    time not null,
  raum        text,
  dozent      text
);

-- Vom Work-Station-Hub später befüllt; hier nur für die Lernzeit-Statistik gelesen
create table lern_session (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  fach_id       uuid references fach (id) on delete set null,
  start         timestamptz not null,
  dauer_minuten integer not null
);

create table externer_feed (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  url         text not null,      -- enthält Token → sensibel
  aktiv       boolean not null default true,
  zuletzt_synchronisiert timestamptz
);

create table benachrichtigung (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  text        text not null,
  ref_id      uuid,               -- verweist auf das auslösende Element
  gelesen     boolean not null default false,
  erstellt_am timestamptz not null default now()
);

-- Eine Zeile pro Nutzer
create table settings (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  theme             theme not null default 'HELL',
  sichtbare_widgets jsonb not null default '[]',
  streak_count      integer not null default 0,
  streak_last_active date,
  streak_freezes    integer not null default 1
);
