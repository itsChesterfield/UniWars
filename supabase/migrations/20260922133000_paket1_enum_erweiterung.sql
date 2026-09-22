-- Paket 1: neue deadline_typ-Werte fuer die Chip-Leiste im Schnell-Erfassen.
-- Eigene Migration, da ALTER TYPE ... ADD VALUE nicht in derselben
-- Transaktion wie seine Verwendung laufen darf.
ALTER TYPE deadline_typ ADD VALUE IF NOT EXISTS 'TERMIN';
ALTER TYPE deadline_typ ADD VALUE IF NOT EXISTS 'GRUPPENARBEIT';
