/**
 * Einrichtung beim ersten Login (Entscheidung Didi, 18./19.11.): eine Frage pro Bildschirm.
 * Ohne Migration: Der Stand liegt in einem Cookie auf dem Gerät. Gezeigt wird die Einrichtung
 * nur neuen Konten ohne eigene Daten, oder solange sie läuft (auch nach dem Umweg über Google).
 */

export const EINRICHTUNG_COOKIE = "uv_einrichtung";

/** Wie lange ein Konto als „neu“ gilt */
export const NEU_TAGE = 30;

export type Schritt = "hochschule" | "stundenplan" | "kalender" | "mensa" | "faecher";

export const ALLE_SCHRITTE: Schritt[] = ["hochschule", "stundenplan", "kalender", "mensa", "faecher"];

/** Kalender nur, wenn die Google-Verbindung auf dem Server eingerichtet ist */
export function schritte(kalenderMoeglich: boolean): Schritt[] {
  return ALLE_SCHRITTE.filter((s) => s !== "kalender" || kalenderMoeglich);
}

export type EinrichtungStand = { art: "neu" } | { art: "laeuft"; schritt: number } | { art: "fertig" };

/** Cookie lesen: „fertig“, „laeuft:2“ oder nichts */
export function standLesen(wert: string | undefined | null): EinrichtungStand {
  if (wert === "fertig") return { art: "fertig" };
  const m = /^laeuft:(\d{1,2})$/.exec(wert ?? "");
  if (m) return { art: "laeuft", schritt: Number(m[1]) };
  return { art: "neu" };
}

export function standSchreiben(stand: EinrichtungStand): string {
  return stand.art === "laeuft" ? `laeuft:${stand.schritt}` : stand.art;
}

export type KontoDaten = {
  /** Anlegedatum des Kontos (ISO) */
  seit: string | null | undefined;
  faecher: number;
  aufgaben: number;
  stundenplan: number;
  hochschule: boolean;
  mensa: boolean;
};

/** Ein Konto ist leer, wenn es nichts Eigenes enthält und höchstens NEU_TAGE alt ist. */
export function kontoNeuUndLeer(k: KontoDaten, jetzt: Date): boolean {
  const seit = k.seit ? Date.parse(k.seit) : Number.NaN;
  if (!Number.isFinite(seit) || jetzt.getTime() - seit > NEU_TAGE * 86_400_000) return false;
  return k.faecher === 0 && k.aufgaben === 0 && k.stundenplan === 0 && !k.hochschule && !k.mensa;
}

/** Soll der Hub zur Einrichtung umleiten? */
export function einrichtungZeigen(stand: EinrichtungStand, k: KontoDaten, jetzt: Date): boolean {
  if (stand.art === "fertig") return false;
  if (stand.art === "laeuft") return true;
  return kontoNeuUndLeer(k, jetzt);
}

/** Schrittnummer auf die vorhandenen Schritte begrenzen (0 = Begrüßung, n + 1 = fertig) */
export function schrittBegrenzen(schritt: number, anzahl: number): number {
  if (!Number.isInteger(schritt) || schritt < 0) return 0;
  return Math.min(schritt, anzahl + 1);
}

/** Satz für den letzten Bildschirm, aus dem, was eingerichtet ist */
export function zusammenfassung(s: { hochschule: string | null; termine: number; faecher: number; mensa: string | null; kalender: boolean }): string {
  const teile: string[] = [];
  if (s.hochschule) teile.push(s.hochschule);
  if (s.faecher > 0) teile.push(s.faecher === 1 ? "1 Fach" : `${s.faecher} Fächer`);
  if (s.termine > 0) teile.push(s.termine === 1 ? "1 Termin im Stundenplan" : `${s.termine} Termine im Stundenplan`);
  if (s.kalender) teile.push("Google Kalender verbunden");
  if (s.mensa) teile.push(s.mensa);
  if (teile.length === 0) return "Du kannst alles später in den Einstellungen ergänzen.";
  return `${teile.join(", ")}. Alles lässt sich später in den Einstellungen ändern.`;
}
