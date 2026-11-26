/**
 * KI-16.6: Erkennt eine grafische Bitte des Nutzers (Zweitweg neben dem Knopf).
 * Nur der Nutzer loest den Whiteboard-Modus aus (Version 1), die KI nicht selbst.
 */
const MUSTER: RegExp[] = [
  /\bzeig(e|st)?\b[^.?!]*\bgrafisch\b/i,
  /\bgrafisch\b[^.?!]*\berklaer/i,
  /\bmal(e|st)?\b[^.?!]*\b(mir|das|es|auf)\b/i,
  /\bzeichne(st)?\b/i,
  /\bals\s+(diagramm|skizze|zeichnung|grafik|bild)\b/i,
  /\bvisualisier/i,
  /\baufs?\s+whiteboard\b/i,
  /\bmach(e|st)?\b[^.?!]*\b(ein|eine)\s+(skizze|zeichnung|grafik)\b/i,
];

/** Ist die Eingabe eine Bitte, etwas grafisch zu zeichnen? */
export function istGrafischeBitte(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return MUSTER.some((m) => m.test(t));
}
