/**
 * Notenrechnung ohne React (testbar). Gewichtet wie die Datenbankfunktion `notenschnitt()`:
 * Summe aus Note mal Gewicht, geteilt durch die Summe der Gewichte.
 */
export type NotenEintrag = { wert: number | null; gewicht: number; fach_id: string };
type Eingetragen = NotenEintrag & { wert: number };

/** Nur Noten mit Wert zählen; leere Noten (Prüfung noch ohne Ergebnis) sind „ausstehend“. */
export function eingetragen(noten: readonly NotenEintrag[]): Eingetragen[] {
  return noten.filter((n): n is Eingetragen => typeof n.wert === "number");
}

/** Deutsche Schreibweise mit Komma, z. B. 1,7 oder 2,25. */
export function notenText(wert: number, stellen = 1): string {
  return wert.toLocaleString("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
}

/** Gewichteter Schnitt; null, solange kein Gewicht vorliegt. */
export function gewichteterSchnitt(alle: readonly NotenEintrag[]): number | null {
  const noten = eingetragen(alle);
  const gewicht = noten.reduce((s, n) => s + n.gewicht, 0);
  if (gewicht <= 0) return null;
  return noten.reduce((s, n) => s + n.wert * n.gewicht, 0) / gewicht;
}

/** Schnitt je Fach, bester zuerst. */
export function schnittProFach(noten: readonly NotenEintrag[]): { fachId: string; schnitt: number; anzahl: number }[] {
  const gruppen = new Map<string, NotenEintrag[]>();
  for (const n of eingetragen(noten)) gruppen.set(n.fach_id, [...(gruppen.get(n.fach_id) ?? []), n]);
  return [...gruppen.entries()]
    .map(([fachId, liste]) => ({ fachId, schnitt: gewichteterSchnitt(liste), anzahl: liste.length }))
    .filter((x): x is { fachId: string; schnitt: number; anzahl: number } => x.schnitt !== null)
    .sort((a, b) => a.schnitt - b.schnitt);
}

/** Welche Note braucht es im Schnitt auf das restliche Gewicht, um den Zielschnitt zu erreichen? */
export function benoetigteNote(
  noten: readonly NotenEintrag[],
  ziel: number,
  restGewicht: number,
): { art: "ungueltig" } | { art: "sicher" } | { art: "unmoeglich" } | { art: "note"; wert: number } {
  if (!Number.isFinite(ziel) || !Number.isFinite(restGewicht) || restGewicht <= 0 || ziel < 1 || ziel > 5) {
    return { art: "ungueltig" };
  }
  const mitWert = eingetragen(noten);
  const summe = mitWert.reduce((s, n) => s + n.wert * n.gewicht, 0);
  const gewicht = mitWert.reduce((s, n) => s + n.gewicht, 0);
  const wert = (ziel * (gewicht + restGewicht) - summe) / restGewicht;
  // Noten sind „je kleiner, desto besser“: ab 5,0 reicht jede Note, unter 1,0 geht es nicht mehr
  if (wert >= 5) return { art: "sicher" };
  if (wert < 1) return { art: "unmoeglich" };
  return { art: "note", wert };
}

/** Schnitt nach einer weiteren Note mit Gewicht; null bei ungültiger Eingabe. */
export function schnittMit(noten: readonly NotenEintrag[], wert: number, gewicht: number): number | null {
  if (!Number.isFinite(wert) || !Number.isFinite(gewicht) || gewicht <= 0 || wert < 1 || wert > 5) return null;
  return gewichteterSchnitt([...noten, { wert, gewicht, fach_id: "" }]);
}

/** Eingabe mit Komma oder Punkt als Zahl lesen („1,7“ und „1.7“). */
export function zahlLesen(text: string): number {
  const t = text.trim().replace(",", ".");
  return t === "" ? Number.NaN : Number(t);
}
