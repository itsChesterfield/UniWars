/**
 * Karteikarten-Vorschläge beim Öffnen des Hubs: Welche Stapel lohnen sich jetzt?
 * Gewichtet fällige Wiederholungen, bevorstehende Prüfungen und die nächste Vorlesung
 * des Fachs. Reine Logik ohne Datenbank, damit testbar.
 */

export type Wochentag = "MO" | "DI" | "MI" | "DO" | "FR" | "SA" | "SO";

export type StapelInfo = { id: string; name: string; fach_id: string | null; anzahl: number; faellig: number };
export type PruefungInfo = { fach_id: string; datum: string; titel: string };
export type VorlesungInfo = { fach_id: string; tag: Wochentag; start_zeit: string };

/** "jetzt" in Berlin: Kalendertag, Wochentag und Uhrzeit */
export type Jetzt = { datum: string; tag: Wochentag; uhr: string };

export type Vorschlag = {
  stapel: StapelInfo;
  gruende: string[];
  punkte: number;
};

const TAGE: Wochentag[] = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"];
export const MAX_VORSCHLAEGE = 3;
/** Prüfungen so viele Tage vorher berücksichtigen */
const PRUEFUNG_HORIZONT = 21;

function tageBis(vonIso: string, bisIso: string): number {
  return Math.round((Date.parse(`${bisIso.slice(0, 10)}T00:00:00Z`) - Date.parse(`${vonIso}T00:00:00Z`)) / 86_400_000);
}

/** Nächste Vorlesung eines Fachs ab jetzt: in wie vielen Tagen (0 = heute) und um wie viel Uhr. */
export function naechsteVorlesung(vorlesungen: VorlesungInfo[], fachId: string, jetzt: Jetzt): { inTagen: number; uhr: string } | null {
  const heute = TAGE.indexOf(jetzt.tag);
  let beste: { inTagen: number; uhr: string } | null = null;
  for (const v of vorlesungen) {
    if (v.fach_id !== fachId) continue;
    const uhr = v.start_zeit.slice(0, 5);
    let inTagen = (TAGE.indexOf(v.tag) - heute + 7) % 7;
    if (inTagen === 0 && uhr <= jetzt.uhr) inTagen = 7;
    if (!beste || inTagen < beste.inTagen || (inTagen === beste.inTagen && uhr < beste.uhr)) beste = { inTagen, uhr };
  }
  return beste;
}

function wann(tage: number): string {
  if (tage === 0) return "heute";
  if (tage === 1) return "morgen";
  return `in ${tage} Tagen`;
}

export function vorschlaegeBerechnen(
  stapel: StapelInfo[],
  pruefungen: PruefungInfo[],
  vorlesungen: VorlesungInfo[],
  jetzt: Jetzt,
): Vorschlag[] {
  const ergebnis: Vorschlag[] = [];
  for (const s of stapel) {
    if (s.anzahl === 0) continue;
    let punkte = 0;
    const gruende: string[] = [];

    if (s.faellig > 0) {
      punkte += Math.min(s.faellig, 30) * 2 + 10;
      gruende.push(`${s.faellig} ${s.faellig === 1 ? "Karte" : "Karten"} zur Wiederholung fällig`);
    }

    if (s.fach_id) {
      const pruefung = pruefungen
        .filter((p) => p.fach_id === s.fach_id)
        .map((p) => ({ ...p, tage: tageBis(jetzt.datum, p.datum) }))
        .filter((p) => p.tage >= 0 && p.tage <= PRUEFUNG_HORIZONT)
        .sort((a, b) => a.tage - b.tage)[0];
      if (pruefung) {
        punkte += (PRUEFUNG_HORIZONT + 1 - pruefung.tage) * 4;
        gruende.push(`${pruefung.titel || "Prüfung"} ${wann(pruefung.tage)}`);
      }

      const vorlesung = naechsteVorlesung(vorlesungen, s.fach_id, jetzt);
      if (vorlesung && vorlesung.inTagen <= 1) {
        punkte += vorlesung.inTagen === 0 ? 14 : 8;
        gruende.push(`Vorlesung ${wann(vorlesung.inTagen)} um ${vorlesung.uhr}`);
      }
    }

    // Nur Termine ohne fällige Karten reichen nicht immer: kurz vor der Prüfung trotzdem vorschlagen
    if (punkte > 0) ergebnis.push({ stapel: s, gruende, punkte });
  }
  return ergebnis.sort((a, b) => b.punkte - a.punkte || b.stapel.faellig - a.stapel.faellig).slice(0, MAX_VORSCHLAEGE);
}
