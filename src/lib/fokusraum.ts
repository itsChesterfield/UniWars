/**
 * Fokusraum: wer gerade lernt (Supabase Realtime Presence). Ohne Next.js, testbar.
 * Räume: „alle“, eine Hochschule (nur bestätigte Uni-Mail) oder eine Gruppenarbeit.
 */
export type RaumArt = "alle" | "hs" | "gruppe";
export type Raum = { art: RaumArt; id: string | null; titel: string };

export const raumTopic = (r: Pick<Raum, "art" | "id">): string =>
  r.art === "alle" ? "fokusraum:alle" : `fokusraum:${r.art}:${r.id ?? ""}`;

/** Was andere sehen; ohne Freigabe nur „Anonym“ und kein Fach */
export type Anwesenheit = {
  /** Anzeigename oder null = anonym */
  n: string | null;
  /** Fach oder null */
  f: string | null;
  /** fokus | kurz | lang */
  m: string;
  /** läuft gerade */
  l: boolean;
  /** Ende der Phase (ms) während der Timer läuft, im Flow der gedachte Start */
  e: number | null;
  /** Restzeit, im Flow die bisherige Zeit (solange der Timer steht) */
  r: number;
  /** Flow: Zeit zählt hoch (ältere Clients senden das Feld nicht) */
  w?: boolean;
};

export type Teilnehmer = Anwesenheit & { key: string; ich: boolean };

const MODI = ["fokus", "kurz", "lang"];
const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const zahl = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Ein Eintrag aus der Anwesenheit; andere Clients können beliebiges senden, daher streng prüfen */
function pruefen(roh: unknown): Anwesenheit | null {
  if (!roh || typeof roh !== "object") return null;
  const a = roh as Record<string, unknown>;
  if (typeof a.m !== "string" || !MODI.includes(a.m)) return null;
  return { n: text(a.n, 40), f: text(a.f, 60), m: a.m, l: a.l === true, e: zahl(a.e), r: Math.min(Math.max(0, zahl(a.r) ?? 0), 24 * 3600_000), w: a.w === true };
}

/** Presence-Zustand → Liste: wer gerade Fokus hat zuerst, dann Pausen; eigener Platz vorn */
export function teilnehmerListe(zustand: Record<string, unknown[]>, ichKey: string | null): Teilnehmer[] {
  return Object.entries(zustand)
    .flatMap(([key, eintraege]) => {
      const a = pruefen(Array.isArray(eintraege) ? eintraege[eintraege.length - 1] : null);
      return a ? [{ ...a, key, ich: key === ichKey }] : [];
    })
    .sort((a, b) => Number(b.ich) - Number(a.ich) || Number(b.m === "fokus" && b.l) - Number(a.m === "fokus" && a.l) || (a.n ?? "~").localeCompare(b.n ?? "~", "de"));
}

export function initiale(name: string | null): string {
  const t = name?.trim();
  return t ? t[0].toLocaleUpperCase("de-DE") : "?";
}

/** Zeit in ms für die Anzeige: Restzeit, im Flow die bisherige Zeit */
export function restMs(t: Pick<Anwesenheit, "l" | "e" | "r" | "w">, jetzt: number): number {
  if (t.w) return t.l && t.e ? Math.max(0, jetzt - t.e) : t.r;
  return t.l && t.e ? Math.max(0, t.e - jetzt) : t.r;
}
