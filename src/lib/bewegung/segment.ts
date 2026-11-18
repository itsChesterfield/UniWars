/** Reine Rechenhilfe für die gleitende Segment-Markierung (testbar ohne Browser). */

export type SegmentEintrag = { links: number; oben: number; breite: number; hoehe: number; gewaehlt: boolean };
export type MarkeLage = { x: number; y: number; breite: number; hoehe: number };

/**
 * Lage der Markierung unter dem gewählten Eintrag, relativ zum Segment.
 * Ohne gewählten oder ohne sichtbaren Eintrag gibt es keine Markierung; dann gilt der Hintergrund des Knopfs.
 */
export function markeLage(eintraege: SegmentEintrag[]): MarkeLage | null {
  const g = eintraege.find((e) => e.gewaehlt);
  if (!g || g.breite <= 0 || g.hoehe <= 0) return null;
  return { x: Math.round(g.links), y: Math.round(g.oben), breite: Math.round(g.breite), hoehe: Math.round(g.hoehe) };
}

/** Gleich, wenn sich die Markierung nicht bewegen muss (verhindert unnötiges Schreiben ins DOM). */
export function gleicheLage(a: MarkeLage | null, b: MarkeLage | null): boolean {
  if (!a || !b) return a === b;
  return a.x === b.x && a.y === b.y && a.breite === b.breite && a.hoehe === b.hoehe;
}
