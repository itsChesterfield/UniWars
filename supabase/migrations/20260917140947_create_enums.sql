create type prioritaet as enum ('HOCH', 'MITTEL', 'NIEDRIG');
create type deadline_typ as enum ('ABGABE', 'FRIST', 'SONSTIGE');
create type deadline_kategorie as enum ('NORMAL', 'BAFOEG', 'SEMESTERBEITRAG');
create type quelle as enum ('MANUELL', 'EXTERN');
create type pruefung_status as enum ('ANSTEHEND', 'BESTANDEN', 'NICHT_BESTANDEN');
create type wochentag as enum ('MO','DI','MI','DO','FR','SA','SO');
create type theme as enum ('HELL', 'DUNKEL');
