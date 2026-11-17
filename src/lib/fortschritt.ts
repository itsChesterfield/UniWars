/** Lernzeit für die Seite „Fortschritt“ (ohne React, testbar). Tage zählen in der Ortszeit des Browsers. */
export type Sitzung = { start: string; dauer_minuten: number; fach_id: string | null };

export const WOCHENTAGE_KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

/** Montag 0:00 der Woche, in der `datum` liegt. */
export function wochenbeginn(datum: Date): Date {
  const montag = new Date(datum);
  montag.setHours(0, 0, 0, 0);
  montag.setDate(montag.getDate() - ((montag.getDay() + 6) % 7));
  return montag;
}

/** Lernminuten je Tag der Woche ab `montag` (Index 0 = Montag). */
export function minutenProTag(sitzungen: readonly Sitzung[], montag: Date): number[] {
  const tage = [0, 0, 0, 0, 0, 0, 0];
  const ende = new Date(montag);
  ende.setDate(montag.getDate() + 7);
  for (const s of sitzungen) {
    const t = new Date(s.start);
    if (t < montag || t >= ende) continue;
    tage[(t.getDay() + 6) % 7] += s.dauer_minuten;
  }
  return tage;
}

/** Minuten je Fach über alle Sitzungen, meiste zuerst; Sitzungen ohne Fach unter `null`. */
export function minutenProFach(sitzungen: readonly Sitzung[]): { fachId: string | null; minuten: number }[] {
  const summen = new Map<string | null, number>();
  for (const s of sitzungen) summen.set(s.fach_id, (summen.get(s.fach_id) ?? 0) + s.dauer_minuten);
  return [...summen.entries()].map(([fachId, minuten]) => ({ fachId, minuten })).sort((a, b) => b.minuten - a.minuten);
}

/** „2 h 55 min“, „45 min“, „3 h“. */
export function dauerText(minuten: number): string {
  const h = Math.floor(minuten / 60);
  const m = Math.round(minuten % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
