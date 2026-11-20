/**
 * Klausurphase (Didi, 20.11., Richtung „A im Hub mit Tagesplan“): die Wochen vor den Klausuren.
 * Drei Wochen vor der ersten Klausur schlägt der Hub die Phase einmal vor; angenommen läuft sie bis zum Tag der
 * letzten Klausur, die bis vier Wochen nach der ersten liegt. Der Stand pro Fach kommt aus vorhandenen Daten:
 * Wissensstand von Studio pro Thema, sonst fällige Karteikarten.
 */
import { berlinDatum, berlinTageZwischen } from "./zeit.ts";

/** So viele Tage vor der ersten Klausur kommt der Vorschlag */
export const VORLAUF_TAGE = 21;
/** Klausuren bis so viele Tage nach der ersten gehören zur selben Phase */
export const PHASE_TAGE = 28;
/** Ab dieser Beherrschung (0 bis 1) gilt ein Thema als sicher */
export const SICHER_AB = 0.8;

/** Gespeichert in `settings.darstellung.klausurphase`: angenommen (bis Tag) oder für eine erste Klausur abgelehnt */
export type KlausurZustand = { bis: string } | { abgelehnt: string } | null;

type Pruefung = { id: string; titel: string; datum: string; fach_id: string | null; status: string; raum: string | null };
type ThemaStand = { fach_id: string | null; thema: string; beherrschung: number; fehlerbild: string | null };
type FaelligerStapel = { id: string; name: string; anzahl: number; fachId: string | null };

export type Cluster<P extends Pruefung = Pruefung> = { erste: P; klausuren: P[]; bis: string; tageBisErste: number };

export function zustandLesen(roh: unknown): KlausurZustand {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return null;
  const o = roh as Record<string, unknown>;
  if (typeof o.bis === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.bis)) return { bis: o.bis };
  if (typeof o.abgelehnt === "string" && o.abgelehnt.length > 0 && o.abgelehnt.length <= 64) return { abgelehnt: o.abgelehnt };
  return null;
}

/** Anstehende Klausuren ab heute; die erste und alle bis PHASE_TAGE danach bilden die Phase */
export function klausurCluster<P extends Pruefung>(pruefungen: P[], jetzt: Date): Cluster<P> | null {
  const anstehend = pruefungen
    .filter((p) => p.status === "ANSTEHEND" && berlinTageZwischen(jetzt, new Date(p.datum)) >= 0)
    .sort((a, b) => a.datum.localeCompare(b.datum));
  const erste = anstehend[0];
  if (!erste) return null;
  const klausuren = anstehend.filter((p) => berlinTageZwischen(new Date(erste.datum), new Date(p.datum)) <= PHASE_TAGE);
  return { erste, klausuren, bis: berlinDatum(new Date(klausuren[klausuren.length - 1].datum)), tageBisErste: berlinTageZwischen(jetzt, new Date(erste.datum)) };
}

export function phaseAktiv(z: KlausurZustand, jetzt: Date): boolean {
  return !!z && "bis" in z && berlinDatum(jetzt) <= z.bis;
}

export function vorschlagZeigen(c: Cluster | null, z: KlausurZustand, jetzt: Date): boolean {
  if (!c || phaseAktiv(z, jetzt) || c.tageBisErste > VORLAUF_TAGE) return false;
  return !(z && "abgelehnt" in z && z.abgelehnt === c.erste.id);
}

export type Stand = { anteil: number | null; text: string; schwach: { thema: string; fehlerbild: string | null } | null };

const minuten = (n: number) => (n === 1 ? "1 Minute" : `${n} Minuten`);

export function standFuer(fachId: string | null, themen: ThemaStand[], stapel: FaelligerStapel[]): Stand {
  const t = themen.filter((x) => x.fach_id === fachId);
  if (t.length) {
    const sicher = t.filter((x) => x.beherrschung >= SICHER_AB).length;
    const schwach = [...t].filter((x) => x.beherrschung < SICHER_AB).sort((a, b) => a.beherrschung - b.beherrschung)[0];
    return {
      anteil: sicher / t.length,
      text: `${sicher} von ${t.length} ${t.length === 1 ? "Thema" : "Themen"} sicher`,
      schwach: schwach ? { thema: schwach.thema, fehlerbild: schwach.fehlerbild } : null,
    };
  }
  const karten = stapel.filter((s) => s.fachId === fachId).reduce((n, s) => n + s.anzahl, 0);
  if (karten) return { anteil: null, text: `${karten} ${karten === 1 ? "Karteikarte" : "Karteikarten"} fällig`, schwach: null };
  return { anteil: null, text: "noch nicht angefangen", schwach: null };
}

export type PlanPunkt = { id: string; titel: string; unter: string; fachId: string | null; href?: string; frage?: string };

/** Was heute dran ist: je Klausur (nach Datum) das schwächste Thema, dann die fälligen Karten des Fachs. Höchstens vier Punkte. */
export function tagesplan(c: Cluster, themen: ThemaStand[], stapel: FaelligerStapel[], fachName: (id: string | null) => string | null): PlanPunkt[] {
  const plan: PlanPunkt[] = [];
  const gesehen = new Set<string | null>();
  for (const k of c.klausuren) {
    if (gesehen.has(k.fach_id)) continue;
    gesehen.add(k.fach_id);
    const fach = fachName(k.fach_id) ?? k.titel;
    const s = standFuer(k.fach_id, themen, stapel);
    if (s.schwach) {
      plan.push({
        id: `thema-${k.id}`,
        titel: `${s.schwach.thema} wiederholen`,
        unter: [fach, s.schwach.fehlerbild, `etwa ${minuten(25)}`].filter(Boolean).join(", "),
        fachId: k.fach_id,
        frage: `Frag mich zu „${s.schwach.thema}“ in ${fach} ab, für die Klausur „${k.titel}“. Fang mit dem an, was ich zuletzt verwechselt habe.`,
      });
    }
  }
  for (const fachId of gesehen) {
    const eigene = stapel.filter((x) => x.fachId === fachId && x.anzahl > 0).sort((a, b) => b.anzahl - a.anzahl);
    const anzahl = eigene.reduce((n, x) => n + x.anzahl, 0);
    if (!anzahl) continue;
    plan.push({
      id: `karten-${fachId}`,
      titel: `${anzahl} ${anzahl === 1 ? "Karteikarte" : "Karteikarten"}`,
      unter: `${fachName(fachId) ?? "Karteikarten"}, fällig heute, etwa ${minuten(Math.max(1, Math.round(anzahl * 0.5)))}`,
      fachId,
      href: `/karteikarten/${eigene[0].id}/lernen`,
    });
  }
  return plan.slice(0, 4);
}
