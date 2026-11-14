// Transkriptions-Hub (TRA-01 … TRA-05): reine Logik ohne Abhängigkeiten, gut testbar.

/** Browser-Aufnahmen werden in Teilen von höchstens 10 Minuten gespeichert und transkribiert. */
export const TEIL_SEKUNDEN = 10 * 60;
/** TRA-01: höchstens 2 Stunden pro Aufnahme */
export const MAX_AUFNAHME_SEKUNDEN = 2 * 60 * 60;
/** Längste Datei, die am Stück transkribiert wird (Grenze des Dienstes, mit Reserve) */
export const MAX_DATEI_SEKUNDEN = 60 * 60;
/** So lange darf ein Teil "in Bearbeitung" sein, bevor er als abgebrochen gilt */
export const HAENGT_NACH_MS = 6 * 60 * 1000;

export type TeilStatus = "ausstehend" | "in_bearbeitung" | "fertig" | "fehler";
export type Segment = { start: number; ende: number; text: string };
export type Absatz = { teil: number; start: number | null; ende: number | null; text: string };

export type TeilInfo = { nr: number; status: TeilStatus; gestartet_am: string | null; sekunden: number };

/** "4:05" bzw. "1:02:03" */
export function zeitText(sekunden: number): string {
  const s = Math.max(0, Math.floor(sekunden));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

/** Ein Teil, der zu lange "in Bearbeitung" ist, gilt als abgebrochen (z. B. Zeitlimit des Servers). */
export function haengt(teil: { status: string; gestartet_am: string | null }, jetzt = Date.now()): boolean {
  if (teil.status !== "in_bearbeitung" || !teil.gestartet_am) return false;
  return jetzt - new Date(teil.gestartet_am).getTime() > HAENGT_NACH_MS;
}

/** Wirksamer Status eines Teils (hängende Teile zählen als Fehler). */
export function wirksamerStatus(teil: TeilInfo, jetzt = Date.now()): TeilStatus {
  return haengt(teil, jetzt) ? "fehler" : teil.status;
}

/** Gesamtstatus eines Transkripts aus seinen Teilen. */
export function gesamtStatus(teile: TeilInfo[], jetzt = Date.now()): TeilStatus {
  if (teile.length === 0) return "ausstehend";
  const st = teile.map((t) => wirksamerStatus(t, jetzt));
  if (st.every((s) => s === "fertig")) return "fertig";
  if (st.some((s) => s === "in_bearbeitung")) return "in_bearbeitung";
  if (st.some((s) => s === "fehler")) return "fehler";
  return st.some((s) => s === "fertig") ? "in_bearbeitung" : "ausstehend";
}

/** Nächster Teil, der transkribiert werden muss (ausstehend oder fehlgeschlagen), in Reihenfolge. */
export function naechsterTeil<T extends TeilInfo>(teile: T[], jetzt = Date.now()): T | null {
  return [...teile].sort((a, b) => a.nr - b.nr).find((t) => ["ausstehend", "fehler"].includes(wirksamerStatus(t, jetzt))) ?? null;
}

/** Sekunden, die noch gebucht werden (offene Teile). */
export function offeneSekunden(teile: TeilInfo[], jetzt = Date.now()): number {
  return teile.filter((t) => wirksamerStatus(t, jetzt) !== "fertig").reduce((n, t) => n + t.sekunden, 0);
}

/** Abrechnung in ganzen Sekunden, mindestens 1 */
export function abrechenbareSekunden(sekunden: number): number {
  return Math.max(1, Math.ceil(sekunden));
}

const SATZENDE = /[.!?…]["“”»«')\]]?$/;

/**
 * TRA-04: Segmente aller Teile zu lesbaren Absätzen zusammenfassen. Ein neuer Absatz beginnt
 * nach einer Pause (> 2 s), nach etwa 45 s an einem Satzende oder spätestens bei ~700 Zeichen.
 * Liefert der Dienst keine Segmente, wird der Text an Satzgrenzen geteilt (ohne Zeitstempel).
 */
export function absaetzeBilden(teile: { nr: number; text: string; segmente: Segment[] }[]): Absatz[] {
  const absaetze: Absatz[] = [];
  for (const teil of [...teile].sort((a, b) => a.nr - b.nr)) {
    const segmente = teil.segmente.filter((s) => s.text.trim());
    if (segmente.length === 0) {
      for (const text of textTeilen(teil.text, 700)) absaetze.push({ teil: teil.nr, start: null, ende: null, text });
      continue;
    }
    let aktuell: Absatz | null = null;
    for (const s of segmente) {
      const text = s.text.trim();
      const pause = aktuell?.ende !== null && aktuell?.ende !== undefined ? s.start - aktuell.ende : 0;
      const dauer = aktuell?.start !== null && aktuell?.start !== undefined ? s.start - aktuell.start : 0;
      const neu =
        !aktuell ||
        pause > 2 ||
        aktuell.text.length + text.length > 700 ||
        (dauer >= 45 && SATZENDE.test(aktuell.text));
      if (neu) {
        aktuell = { teil: teil.nr, start: s.start, ende: s.ende, text };
        absaetze.push(aktuell);
      } else if (aktuell) {
        aktuell.text = `${aktuell.text} ${text}`;
        aktuell.ende = s.ende;
      }
    }
  }
  return absaetze;
}

/** Text an Satzgrenzen in Stücke von höchstens etwa `max` Zeichen teilen. */
export function textTeilen(text: string, max: number): string[] {
  const saetze = text.replace(/\s+/g, " ").trim().match(/[^.!?…]+(?:[.!?…]+["“”»«')\]]?|$)\s*/g) ?? [];
  const stuecke: string[] = [];
  let aktuell = "";
  for (const satz of saetze) {
    const s = satz.trim();
    if (!s) continue;
    if (aktuell && aktuell.length + s.length + 1 > max) {
      stuecke.push(aktuell);
      aktuell = "";
    }
    // Ein einzelner sehr langer "Satz" (ohne Satzzeichen) wird hart geteilt
    let rest = s;
    while (rest.length > max) {
      const schnitt = rest.lastIndexOf(" ", max) > max / 2 ? rest.lastIndexOf(" ", max) : max;
      if (aktuell) {
        stuecke.push(aktuell);
        aktuell = "";
      }
      stuecke.push(rest.slice(0, schnitt).trim());
      rest = rest.slice(schnitt).trim();
    }
    aktuell = aktuell ? `${aktuell} ${rest}` : rest;
  }
  if (aktuell) stuecke.push(aktuell);
  return stuecke;
}

/** Fließtext aus den Absätzen (für Notiz und KI-04) */
export function absaetzeAlsText(absaetze: Pick<Absatz, "text">[]): string {
  return absaetze
    .map((a) => a.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Absätze aus der Datenbank/vom Browser prüfen. */
export function absaetzeLesen(roh: unknown, maxZeichen = 400_000): Absatz[] | null {
  if (!Array.isArray(roh) || roh.length > 5000) return null;
  const zahl = (w: unknown) => (typeof w === "number" && Number.isFinite(w) && w >= 0 ? w : null);
  const liste: Absatz[] = [];
  let summe = 0;
  for (const e of roh) {
    const o = (e ?? {}) as Record<string, unknown>;
    if (typeof o.text !== "string" || !Number.isInteger(o.teil) || (o.teil as number) < 1) return null;
    summe += o.text.length;
    if (summe > maxZeichen) return null;
    liste.push({ teil: o.teil as number, start: zahl(o.start), ende: zahl(o.ende), text: o.text });
  }
  return liste;
}

/** TRA-05: "Transkript – Mathe 1 – 13.11.2026" */
export function notizTitel(fachName: string | null, datum: Date, art: "Transkript" | "Mitschrift" = "Transkript"): string {
  const tag = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(datum);
  return [art, fachName?.trim() || null, tag].filter(Boolean).join(" – ");
}

/** Name der Aufnahme-Datei: "Aufnahme 13.11.2026 14-03.webm" bzw. "… (Teil 2).webm" */
export function aufnahmeName(start: Date, teil: number, endung: string): string {
  const f = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(start);
  const t = (typ: string) => f.find((p) => p.type === typ)?.value ?? "";
  return `Aufnahme ${t("day")}.${t("month")}.${t("year")} ${t("hour")}-${t("minute")}${teil > 1 ? ` (Teil ${teil})` : ""}.${endung}`;
}

/** Passendes Aufnahmeformat des Browsers (Chrome/Firefox: WebM/Opus, Safari: MP4/AAC). */
export function aufnahmeFormat(unterstuetzt: (mime: string) => boolean): { mime: string; endung: string } | null {
  const kandidaten = [
    { mime: "audio/webm;codecs=opus", endung: "webm" },
    { mime: "audio/webm", endung: "webm" },
    { mime: "audio/ogg;codecs=opus", endung: "ogg" },
    { mime: "audio/mp4", endung: "m4a" },
  ];
  return kandidaten.find((k) => unterstuetzt(k.mime)) ?? null;
}
