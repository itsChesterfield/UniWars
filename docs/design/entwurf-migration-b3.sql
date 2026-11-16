-- ENTWURF, NICHT ANWENDEN ohne Absprache mit Max.
-- Design B3: Design-Wahl "Wie das System", Hub-Anordnung, Symbolleiste und persönliche Darstellung.
-- Liegt bewusst nicht in supabase/migrations. Zum Anwenden als neue Migration mit aktuellem Zeitstempel anlegen.
-- RLS: settings hat bereits Policies "eigene Zeile" für SELECT, INSERT, UPDATE, DELETE; neue Spalten sind abgedeckt.

-- HELL = Hochschule, DUNKEL = Sternenhimmel, SYSTEM = folgt dem Gerät
alter type public.theme add value if not exists 'SYSTEM';

alter table public.settings
  -- Übersicht des Zentralen Hubs: [["naechstes", true, "L"], ["fakten", true, "L"], …]
  add column if not exists hub_layout jsonb,
  -- Symbolleiste: {"reihe": ["hub", "work-station", …], "aus": ["mindmap"]}
  add column if not exists symbolleiste jsonb,
  -- Persönliche Darstellung, getrennt vom späteren Design-Rezept
  add column if not exists darstellung jsonb not null
    default '{"schrift": "normal", "dichte": "normal", "bewegung": "system", "design_schalter": false}'::jsonb;

alter table public.settings
  add constraint settings_hub_layout_ist_liste check (hub_layout is null or jsonb_typeof(hub_layout) = 'array'),
  add constraint settings_symbolleiste_ist_objekt check (symbolleiste is null or jsonb_typeof(symbolleiste) = 'object'),
  add constraint settings_darstellung_ist_objekt check (jsonb_typeof(darstellung) = 'object');

comment on column public.settings.hub_layout is 'Design B3: Bausteine der Hub-Übersicht als [id, sichtbar, Größe S|M|L]';
comment on column public.settings.symbolleiste is 'Design B3: Reihenfolge und ausgeblendete Bereiche der Symbolleiste';
comment on column public.settings.darstellung is 'Design B3: Schriftgröße, Dichte, Bewegung, Design-Schalter in der Kopfleiste';
-- settings.sichtbare_widgets wird danach nicht mehr gebraucht; erst nach der Umstellung entfernen.
