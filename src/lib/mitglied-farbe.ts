// Bewusst aus der bestehenden Fächer-Palette (fach-manager.tsx) gewählt,
// damit das Gesamtsystem konsistent bleibt. Keine DB-Spalte nötig: die
// Farbe ergibt sich rein aus der Position in einer stabil sortierten
// Mitgliederliste (Ersteller zuerst, dann alphabetisch nach Nutzername),
// bleibt also pro Ziel stabil und kollisionsfrei ohne Migration.
const MITGLIED_PALETTE = [
  "#3E6FB0",
  "#4C9A6B",
  "#8A6BC0",
  "#C8823C",
  "#C0568A",
  "#3E9FA8",
  "#8A8A3E",
  "#6B6BC0",
];

export function farbeFuerMitglied(index: number): string {
  return MITGLIED_PALETTE[index % MITGLIED_PALETTE.length];
}
