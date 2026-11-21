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

// ---------------------------------------------------------------------------
// Noten wie an der Uni (Entscheidung Didi 21.11.)
// Fach = Modul. Teilnoten eines Moduls zählen nach ihrem Anteil (Feld `gewicht`, z. B. 70 und 30 oder gleich).
// Die Modulnote zählt mit den ECTS des Fachs. Auch ein Modul über zwei Semester ist ein Fach mit mehreren Noten.
// Wie in den meisten Prüfungsordnungen: Modul- und Gesamtnote nach der ersten Stelle abgeschnitten, nicht gerundet;
// nicht bestandene Module (über 4,0) und unbenotete zählen nicht.
// ---------------------------------------------------------------------------

/** Nach `stellen` Nachkommastellen abschneiden, nicht runden (1,98 → 1,9). */
export function abschneiden(x: number, stellen = 1): number {
  const f = 10 ** stellen;
  return Math.floor(x * f + 1e-9) / f;
}

export type ModulStand = {
  fachId: string;
  /** Modulnote, abgeschnitten; null ohne eingetragene Note */
  note: number | null;
  /** Gewicht in der Gesamtnote: ECTS, ohne ECTS-Angaben die Summe der Anteile */
  ects: number | null;
  /** Noten mit Wert */
  teile: number;
  /** Es fehlt noch mindestens eine Teilnote (ausstehend) */
  vorlaeufig: boolean;
};

export type Gesamtnote = {
  wert: number | null;
  module: ModulStand[];
  /** Summe der Gewichte, die gerade zählen */
  ects: number;
  /** Summe aus Modulnote mal Gewicht (für den Rechner) */
  summe: number;
  /** Fächer mit Note, aber ohne ECTS (zählen nicht, solange andere Fächer ECTS haben) */
  ohneEcts: string[];
  /** Fächer mit Modulnote über 4,0 */
  nichtBestanden: string[];
  /** false: kein Fach hat ECTS, gewichtet wird nach den Anteilen der Noten wie bisher */
  nachEcts: boolean;
};

/** Modulnote aus den Teilnoten eines Fachs: nach Anteil gewichtet, abgeschnitten. */
export function modulnote(noten: readonly NotenEintrag[]): { note: number | null; teile: number; vorlaeufig: boolean; anteile: number } {
  const mitWert = eingetragen(noten);
  const anteil = (n: NotenEintrag) => (n.gewicht > 0 ? n.gewicht : 1);
  const anteile = mitWert.reduce((s, n) => s + anteil(n), 0);
  const note = anteile > 0 ? abschneiden(mitWert.reduce((s, n) => s + n.wert * anteil(n), 0) / anteile) : null;
  return { note, teile: mitWert.length, vorlaeufig: mitWert.length < noten.length, anteile };
}

/** Gesamtnote nach ECTS. `ectsVon` liefert die ECTS eines Fachs (auch archivierter Fächer). */
export function gesamtnote(noten: readonly NotenEintrag[], ectsVon: (fachId: string) => number | null | undefined): Gesamtnote {
  const gruppen = new Map<string, NotenEintrag[]>();
  for (const n of noten) gruppen.set(n.fach_id, [...(gruppen.get(n.fach_id) ?? []), n]);
  const roh = [...gruppen.entries()].map(([fachId, liste]) => ({ fachId, ...modulnote(liste), echteEcts: ectsVon(fachId) ?? null }));
  const nachEcts = roh.some((m) => m.note !== null && (m.echteEcts ?? 0) > 0);
  const stand: ModulStand[] = roh.map((m) => ({
    fachId: m.fachId,
    note: m.note,
    ects: nachEcts ? (m.echteEcts && m.echteEcts > 0 ? m.echteEcts : null) : m.anteile || null,
    teile: m.teile,
    vorlaeufig: m.vorlaeufig,
  }));
  let summe = 0;
  let ects = 0;
  const ohneEcts: string[] = [];
  const nichtBestanden: string[] = [];
  for (const m of stand) {
    if (m.note === null) continue;
    if (m.note > 4) {
      nichtBestanden.push(m.fachId);
      continue;
    }
    if (!m.ects) {
      ohneEcts.push(m.fachId);
      continue;
    }
    summe += m.note * m.ects;
    ects += m.ects;
  }
  return { wert: ects > 0 ? abschneiden(summe / ects) : null, module: stand, ects, summe, ohneEcts, nichtBestanden, nachEcts };
}

/** Gesamtnote, wenn ein weiteres Modul mit `note` und `ects` dazukommt; null bei ungültiger Eingabe. */
export function gesamtMitModul(g: Gesamtnote, note: number, ects: number): number | null {
  if (!Number.isFinite(note) || !Number.isFinite(ects) || ects <= 0 || note < 1 || note > 4) return null;
  return abschneiden((g.summe + note * ects) / (g.ects + ects));
}

/**
 * Welche Note braucht es im Schnitt auf die restlichen ECTS, damit die abgeschnittene Gesamtnote das Ziel erreicht?
 * Abgeschnitten heißt: 2,0 steht da, solange der genaue Schnitt unter 2,1 bleibt.
 */
export function zielnoteNachEcts(
  g: Gesamtnote,
  ziel: number,
  restEcts: number,
): { art: "ungueltig" } | { art: "sicher" } | { art: "unmoeglich" } | { art: "note"; wert: number } {
  if (!Number.isFinite(ziel) || !Number.isFinite(restEcts) || restEcts <= 0 || ziel < 1 || ziel > 4) return { art: "ungueltig" };
  const grenze = ((abschneiden(ziel) + 0.1) * (g.ects + restEcts) - g.summe) / restEcts;
  // größte Note mit einer Stelle, die noch knapp unter der Grenze bleibt
  const wert = Math.ceil(grenze * 10 - 1e-9) / 10 - 0.1;
  if (wert >= 4) return { art: "sicher" };
  if (wert < 1) return { art: "unmoeglich" };
  return { art: "note", wert: Math.round(wert * 10) / 10 };
}
