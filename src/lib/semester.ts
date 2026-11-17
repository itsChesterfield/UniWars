/**
 * Semesterzeiten (ohne Next.js, testbar). Gibt es für eine Hochschule keine gepflegten Termine,
 * gelten Standardwerte nach Land und Hochschulart – als „ungefähr“ gekennzeichnet.
 * Daten sind Kalendertage im Format YYYY-MM-DD.
 */

export type Art = "uni" | "fh" | "sonstige";
export type Land = "DE" | "AT" | "CH" | string;

export type SemesterTermine = {
  semester: string; // z. B. 2026W
  vorlesung_beginn: string;
  vorlesung_ende: string;
  pruefung_beginn: string | null;
  pruefung_ende: string | null;
  rueckmeldung_bis: string | null;
};

export type Phase = "vor_beginn" | "vorlesungen" | "pruefungen" | "vorlesungsfrei";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const tag = (j: number, m: number, t: number) => new Date(Date.UTC(j, m - 1, t));
const plusTage = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** Montag der Woche, in der der Tag liegt */
function montag(d: Date): Date {
  return plusTage(d, -((d.getUTCDay() + 6) % 7));
}
/** Freitag der Woche, in der der Tag liegt */
function freitag(d: Date): Date {
  return plusTage(montag(d), 4);
}

const fhArt = (art: Art) => art === "fh";

/** Welches Semester läuft an diesem Tag (Semesterzeitraum, nicht nur Vorlesungen)? */
export function semesterZu(datum: string, art: Art, land: Land): string {
  const [j, m] = datum.split("-").map(Number);
  // Beginn des Wintersemesters (Monat): CH Aug, FH Sep, sonst Okt; Beginn Sommersemester: CH Feb, FH/AT Mär, sonst Apr
  const winterAb = land === "CH" ? 8 : fhArt(art) && land === "DE" ? 9 : 10;
  const sommerAb = land === "CH" ? 2 : (fhArt(art) && land === "DE") || land === "AT" ? 3 : 4;
  if (m >= winterAb) return `${j}W`;
  if (m >= sommerAb) return `${j}S`;
  return `${j - 1}W`;
}

export function naechstesSemester(semester: string): string {
  const j = Number(semester.slice(0, 4));
  return semester.endsWith("W") ? `${j + 1}S` : `${j}W`;
}

export function semesterName(semester: string, land: Land, kurz = false): string {
  const j = Number(semester.slice(0, 4));
  const winter = semester.endsWith("W");
  if (land === "CH") return kurz ? `${winter ? "HS" : "FS"} ${j}` : `${winter ? "Herbstsemester" : "Frühjahrssemester"} ${j}`;
  if (winter) return kurz ? `WiSe ${j}/${String(j + 1).slice(2)}` : `Wintersemester ${j}/${String(j + 1).slice(2)}`;
  return kurz ? `SoSe ${j}` : `Sommersemester ${j}`;
}

/** Übliche Vorlesungs- und Prüfungszeiten (Richtwerte, je Hochschule abweichend) */
export function standardTermine(semester: string, art: Art, land: Land): SemesterTermine {
  const j = Number(semester.slice(0, 4));
  const winter = semester.endsWith("W");
  let beginn: Date;
  let ende: Date;
  if (land === "CH") {
    beginn = winter ? montag(tag(j, 9, 17)) : montag(tag(j, 2, 20));
    ende = winter ? freitag(tag(j, 12, 20)) : freitag(tag(j, 5, 30));
  } else if (land === "AT") {
    beginn = winter ? tag(j, 10, 1) : tag(j, 3, 1);
    ende = winter ? tag(j + 1, 1, 31) : tag(j, 6, 30);
  } else if (fhArt(art)) {
    beginn = winter ? montag(tag(j, 9, 24)) : montag(tag(j, 3, 16));
    ende = winter ? freitag(tag(j + 1, 1, 27)) : freitag(tag(j, 7, 3));
  } else {
    beginn = winter ? montag(tag(j, 10, 14)) : montag(tag(j, 4, 14));
    ende = winter ? freitag(tag(j + 1, 2, 10)) : freitag(tag(j, 7, 18));
  }
  const pBeginn = plusTage(montag(plusTage(ende, 3)), 0);
  const pEnde = freitag(plusTage(pBeginn, 21));
  return { semester, vorlesung_beginn: iso(beginn), vorlesung_ende: iso(ende), pruefung_beginn: iso(pBeginn), pruefung_ende: iso(pEnde), rueckmeldung_bis: null };
}

/** Wo im Semester steht man an diesem Tag? Mit Vorlesungswoche (1 …) während der Vorlesungszeit. */
export function semesterStand(t: SemesterTermine, datum: string): { phase: Phase; woche: number | null; wochen: number; tageBisPruefungen: number | null } {
  const tage = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
  const wochen = Math.max(1, Math.ceil((tage(t.vorlesung_beginn, t.vorlesung_ende) + 1) / 7));
  const bisPruefung = t.pruefung_beginn && datum < t.pruefung_beginn ? tage(datum, t.pruefung_beginn) : null;
  if (datum < t.vorlesung_beginn) return { phase: "vor_beginn", woche: null, wochen, tageBisPruefungen: bisPruefung };
  if (datum <= t.vorlesung_ende) {
    return { phase: "vorlesungen", woche: Math.floor(tage(t.vorlesung_beginn, datum) / 7) + 1, wochen, tageBisPruefungen: bisPruefung };
  }
  if (t.pruefung_beginn && t.pruefung_ende && datum >= t.pruefung_beginn && datum <= t.pruefung_ende) return { phase: "pruefungen", woche: null, wochen, tageBisPruefungen: 0 };
  return { phase: "vorlesungsfrei", woche: null, wochen, tageBisPruefungen: bisPruefung };
}

export function datumKurz(datum: string | null): string {
  if (!datum) return "–";
  const [j, m, t] = datum.split("-");
  return `${t}.${m}.${j}`;
}

/** Ein Satz fürs KI-Lagebild */
export function semesterSatz(t: SemesterTermine, datum: string, land: Land, gepflegt: boolean): string {
  const s = semesterStand(t, datum);
  const name = semesterName(t.semester, land);
  const wann =
    s.phase === "vorlesungen"
      ? `Vorlesungswoche ${s.woche} von ${s.wochen}, Vorlesungen bis ${datumKurz(t.vorlesung_ende)}`
      : s.phase === "vor_beginn"
        ? `Vorlesungen beginnen am ${datumKurz(t.vorlesung_beginn)}`
        : s.phase === "pruefungen"
          ? "Prüfungszeit"
          : "vorlesungsfreie Zeit";
  const pruefung = t.pruefung_beginn ? `; Prüfungszeit ${datumKurz(t.pruefung_beginn)}–${datumKurz(t.pruefung_ende)}` : "";
  const rueck = t.rueckmeldung_bis ? `; Rückmeldung bis ${datumKurz(t.rueckmeldung_bis)}` : "";
  return `${name}: ${wann}${pruefung}${rueck}${gepflegt ? "" : " (Richtwerte, nicht von der Hochschule bestätigt)"}`;
}
