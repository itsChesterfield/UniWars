/** Farben für neue Fächer (Fach-Verwaltung, Stundenplan-Foto). */
const FARB_PALETTE = [
  "#3E6FB0",
  "#4C9A6B",
  "#8A6BC0",
  "#C8823C",
  "#C0568A",
  "#3E9FA8",
  "#8A8A3E",
  "#6B6BC0",
];

export function naechsteFarbe(faecher: { farbe: string | null }[]): string {
  const genutzt = new Set(faecher.map((f) => f.farbe?.toUpperCase()));
  const frei = FARB_PALETTE.find((c) => !genutzt.has(c));
  return frei ?? FARB_PALETTE[faecher.length % FARB_PALETTE.length];
}
