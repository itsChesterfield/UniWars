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
  /** Ende der Phase (ms) während der Timer läuft, sonst Restzeit */
  e: number | null;
  r: number;
};

export type Teilnehmer = Anwesenheit & { key: string; ich: boolean };

/** Presence-Zustand → Liste: wer gerade Fokus hat zuerst, dann Pausen; eigener Platz vorn */
export function teilnehmerListe(zustand: Record<string, Anwesenheit[]>, ichKey: string | null): Teilnehmer[] {
  return Object.entries(zustand)
    .map(([key, eintraege]) => ({ ...eintraege[eintraege.length - 1], key, ich: key === ichKey }))
    .filter((t) => typeof t.m === "string")
    .sort((a, b) => Number(b.ich) - Number(a.ich) || Number(b.m === "fokus" && b.l) - Number(a.m === "fokus" && a.l) || (a.n ?? "~").localeCompare(b.n ?? "~", "de"));
}

export function initiale(name: string | null): string {
  const t = name?.trim();
  return t ? t[0].toLocaleUpperCase("de-DE") : "?";
}

/** Restzeit in ms für die Anzeige */
export function restMs(t: Pick<Anwesenheit, "l" | "e" | "r">, jetzt: number): number {
  return t.l && t.e ? Math.max(0, t.e - jetzt) : t.r;
}
