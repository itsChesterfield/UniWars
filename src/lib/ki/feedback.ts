/**
 * KI-06: Feedback zu Struktur und Formulierung in der Textverarbeitung.
 * Grundsatz: Die KI gibt Hinweise, sie schreibt die Hausarbeit nicht.
 * Reine Logik ohne Next.js – Prompt, Parser und Suche der Fundstellen sind testbar.
 */
import { einbetten, MATERIAL_REGEL, markerEntschaerfen } from "./material.ts";
import { jsonLesen } from "./json.ts";
import { KiEingabe } from "./fehler.ts";

export const FOKUS = {
  struktur: "Struktur",
  verstaendlichkeit: "Verständlichkeit",
  stil: "Wissenschaftlicher Stil",
} as const;
export type Fokus = keyof typeof FOKUS;
export const ALLE_FOKUS = Object.keys(FOKUS) as Fokus[];

export const MAX_FEEDBACK_ZEICHEN = 20_000;
export const MIN_FEEDBACK_ZEICHEN = 80;
export const MAX_ZITAT_WOERTER = 15;
export const MAX_KOMMENTARE = 15;
export const MAX_SATZ_ZEICHEN = 600;

export type Kommentar = { id: number; fokus: Fokus; zitat: string; problem: string; hinweis: string };

export function istFokus(wert: unknown): wert is Fokus {
  return typeof wert === "string" && wert in FOKUS;
}

/** Eingaben prüfen (gleiche Regel für Knopf und Server). */
export function feedbackEingabePruefen(text: unknown, fokus: unknown): { text: string; fokus: Fokus[] } {
  const t = typeof text === "string" ? text.trim() : "";
  if (t.length < MIN_FEEDBACK_ZEICHEN) throw new KiEingabe("Der Text ist zu kurz für Feedback.");
  if (t.length > MAX_FEEDBACK_ZEICHEN) {
    throw new KiEingabe("Der Text ist zu lang für Feedback (höchstens 20.000 Zeichen). Markiere einen Abschnitt.");
  }
  const f = Array.isArray(fokus) ? [...new Set(fokus.filter(istFokus))] : [];
  if (f.length === 0) throw new KiEingabe("Wähle mindestens einen Schwerpunkt.");
  return { text: t, fokus: f };
}

const FOKUS_BESCHREIBUNG: Record<Fokus, string> = {
  struktur: "Struktur: roter Faden, Gliederung, Übergänge, Reihenfolge der Argumente, Einleitung und Schluss",
  verstaendlichkeit: "Verständlichkeit: zu lange oder verschachtelte Sätze, unklare Bezüge, Fachbegriffe ohne Erklärung",
  stil: "Wissenschaftlicher Stil: Umgangssprache, Wertungen ohne Beleg, Ich-Form, ungenaue Formulierungen, fehlende Belege",
};

export function feedbackPrompt(titel: string, text: string, fokus: Fokus[], auswahl: boolean): { system: string; nutzer: string } {
  const system = [
    "Du gibst Studierenden Feedback zu ihrem eigenen Text (z. B. einer Hausarbeit) wie eine Tutorin oder ein Tutor.",
    "Schreibe keine neuen Absätze und ergänze keine Inhalte. Gib nur Hinweise. Formuliere den Text nicht für den Nutzer um.",
    `Achte nur auf diese Schwerpunkte:\n${fokus.map((f) => `- ${f}: ${FOKUS_BESCHREIBUNG[f]}`).join("\n")}`,
    `Gib höchstens ${MAX_KOMMENTARE - 3} Hinweise, die wichtigsten zuerst. Ist ein Schwerpunkt in Ordnung, lass ihn weg statt etwas zu erfinden.`,
    `Jeder Hinweis hat eine Fundstelle: ein wörtliches, zusammenhängendes Zitat aus dem Text mit höchstens ${MAX_ZITAT_WOERTER} Wörtern, Zeichen für Zeichen kopiert (gleiche Schreibweise und Satzzeichen, nichts auslassen).`,
    "Schreib Problem und Hinweis kurz (je höchstens 2 Sätze) in der Sprache des Textes.",
    MATERIAL_REGEL,
    `Antworte ausschließlich mit JSON: {"kommentare":[{"fokus":"${ALLE_FOKUS.join('"|"')}","zitat":"…","problem":"…","hinweis":"…"}]}`,
    'Gibt es nichts Wesentliches zu verbessern, antworte mit {"kommentare":[]}.',
  ].join("\n");
  const art = auswahl ? "Markierter Abschnitt aus dem Dokument" : "Dokument";
  return { system, nutzer: `${art}: ${markerEntschaerfen(titel.trim() || "Ohne Titel")}\n\n${einbetten(text, "quelle")}` };
}

const kurz = (wert: unknown, max: number) => (typeof wert === "string" ? wert.trim().replace(/\s+/g, " ").slice(0, max) : "");

/** Zitat auf höchstens 15 Wörter kürzen, Anführungszeichen und Auslassungspunkte am Rand entfernen. */
export function zitatBereinigen(zitat: string): string {
  const ohneRand = zitat
    .trim()
    .replace(/^["„“”'‚‘’»«]+|["„“”'‚‘’»«]+$/g, "")
    .replace(/^(…|\.\.\.)\s*|\s*(…|\.\.\.)$/g, "")
    .trim();
  return ohneRand.split(/\s+/).slice(0, MAX_ZITAT_WOERTER).join(" ");
}

/** KI-Antwort prüfen. Leere Liste ist erlaubt ("nichts Wesentliches"). */
export function feedbackParsen(antwort: string, fokus: Fokus[]): Kommentar[] {
  const daten = jsonLesen(antwort);
  const liste: unknown = Array.isArray(daten) ? daten : (daten as { kommentare?: unknown } | null)?.kommentare;
  if (!Array.isArray(liste)) return [];
  const ergebnis: Kommentar[] = [];
  for (const e of liste) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    const f = istFokus(o.fokus) && fokus.includes(o.fokus) ? o.fokus : fokus[0];
    const zitat = zitatBereinigen(kurz(o.zitat, 400));
    const problem = kurz(o.problem, 400);
    const hinweis = kurz(o.hinweis, 500);
    if (!problem || !hinweis) continue;
    ergebnis.push({ id: ergebnis.length + 1, fokus: f, zitat, problem, hinweis });
    if (ergebnis.length >= MAX_KOMMENTARE) break;
  }
  return ergebnis;
}

// ---------------------------------------------------------------------------
// Fundstellen im Text finden (KI-06: Klick markiert die Stelle)
// ---------------------------------------------------------------------------

/** Zeichen vereinheitlichen, damit typografische Unterschiede die Suche nicht scheitern lassen. */
function zeichenNorm(z: string): string {
  if (/["„“”«»]/.test(z)) return '"';
  if (/['‚‘’`´]/.test(z)) return "'";
  if (/[–—−‐‑]/.test(z)) return "-";
  if (z === "…") return "...";
  return z.toLocaleLowerCase("de-DE");
}

/** Normalisierter Text mit Rückverweis auf die Original-Position jedes Zeichens. */
function normalisieren(text: string): { norm: string; index: number[] } {
  let norm = "";
  const index: number[] = [];
  let leer = false;
  for (let i = 0; i < text.length; i++) {
    const z = text[i];
    if (z === "­") continue; // weiches Trennzeichen
    if (/\s/.test(z)) {
      if (!leer && norm.length > 0) {
        norm += " ";
        index.push(i);
      }
      leer = true;
      continue;
    }
    leer = false;
    for (const n of zeichenNorm(z)) {
      norm += n;
      index.push(i);
    }
  }
  return { norm, index };
}

/**
 * Position eines Zitats im Text (Start inklusive, Ende exklusive) oder null.
 * Tolerant gegenüber Groß-/Kleinschreibung, Leerraum, Anführungszeichen und Bindestrichen.
 * Kommt das Zitat mehrfach vor, gewinnt der erste Treffer ab `abIndex`.
 */
export function fundstelleFinden(text: string, zitat: string, abIndex = 0): { start: number; ende: number } | null {
  const z = normalisieren(zitatBereinigen(zitat)).norm.trim();
  if (z.length < 3) return null;
  const { norm, index } = normalisieren(text);
  const ab = index.findIndex((i) => i >= abIndex);
  let pos = ab >= 0 ? norm.indexOf(z, ab) : -1;
  if (pos === -1) pos = norm.indexOf(z);
  // Satzzeichen am Ende des Zitats weglassen (KI kopiert sie manchmal nicht genau)
  let laenge = z.length;
  if (pos === -1) {
    const ohne = z.replace(/[.,;:!?"')\]]+$/, "");
    if (ohne.length >= 3) {
      pos = norm.indexOf(ohne);
      laenge = ohne.length;
    }
  }
  if (pos === -1) return null;
  return { start: index[pos], ende: index[pos + laenge - 1] + 1 };
}

/** Text eines Editors mit Positionszuordnung (z. B. ProseMirror): Stücke in Dokumentreihenfolge. */
export type TextStueck = { text: string; pos: number; neuerBlock: boolean };

/** Flachen Text bauen und für jedes Zeichen die Editor-Position merken (Blöcke durch \n getrennt). */
export function textKarte(stuecke: TextStueck[]): { text: string; position: (i: number) => number } {
  let text = "";
  const pos: number[] = [];
  for (const s of stuecke) {
    if (s.neuerBlock && text.length > 0) {
      text += "\n";
      pos.push(s.pos);
    }
    for (let i = 0; i < s.text.length; i++) {
      text += s.text[i];
      pos.push(s.pos + i);
    }
  }
  return { text, position: (i) => (i >= pos.length ? (pos[pos.length - 1] ?? 0) + 1 : pos[i]) };
}

// ---------------------------------------------------------------------------
// Satzebene: Alternative Formulierungen (höchstens 2)
// ---------------------------------------------------------------------------

/** Ist die Auswahl genau ein ganzer Satz? (kein Bruchstück, keine Zeilenumbrüche, kein Satzende mitten im Text) */
export function istEinzelnerSatz(auswahl: string): boolean {
  const t = auswahl.trim();
  if (t.length < 15 || t.length > MAX_SATZ_ZEICHEN || /\n/.test(t)) return false;
  // Ganzer Satz: beginnt groß (oder mit Zahl/Anführungszeichen) und endet mit einem Satzzeichen
  if (!/^["„»«(]?[A-ZÄÖÜ0-9]/.test(t) || !/[.!?…]["“”»«')\]]?$/.test(t)) return false;
  // Satzgrenze = Satzzeichen + Leerzeichen + Großbuchstabe (Abkürzungen wie "z. B. die" zählen nicht)
  return !/[.!?…]["“”»«')\]]?\s+["„»«(]?[A-ZÄÖÜ]/.test(t.replace(/\b(z|d|u|s|vgl|bzw|ca|Nr|Abb|Kap|Dr|Prof|etc|ggf|usw|bspw|Hrsg|S|f|ff)\.\s/g, "$1·"));
}

export function alternativenPrompt(satz: string, kontext: string): { system: string; nutzer: string } {
  const system = [
    "Du schlägst Studierenden für einen einzelnen Satz aus ihrem eigenen Text bessere Formulierungen vor.",
    "Gib höchstens 2 Varianten. Jede Variante sagt inhaltlich genau dasselbe wie das Original: keine neuen Aussagen, Beispiele, Zahlen oder Quellen.",
    "Schreibe keine neuen Sätze dazu. Jede Variante ist genau ein Satz in derselben Sprache und im wissenschaftlichen Stil.",
    MATERIAL_REGEL,
    'Antworte ausschließlich mit JSON: {"alternativen":["…","…"]}',
  ].join("\n");
  const umfeld = kontext.trim() ? `\n\nUmgebender Text (nur zum Verständnis, nicht umformulieren):\n${einbetten(kontext.trim().slice(0, 1500), "quelle", { art: "kontext" })}` : "";
  return { system, nutzer: `Satz:\n${einbetten(satz.trim(), "quelle", { art: "satz" })}${umfeld}` };
}

/** Höchstens 2 Varianten, verschieden vom Original, nicht viel länger als das Original. */
export function alternativenParsen(antwort: string, original: string): string[] {
  const daten = jsonLesen(antwort);
  const liste: unknown = Array.isArray(daten) ? daten : (daten as { alternativen?: unknown } | null)?.alternativen;
  if (!Array.isArray(liste)) return [];
  const norm = (s: string) => s.toLocaleLowerCase("de-DE").replace(/\s+/g, " ").trim();
  const gesehen = new Set([norm(original)]);
  const ergebnis: string[] = [];
  for (const e of liste) {
    const t = kurz(e, MAX_SATZ_ZEICHEN * 2);
    if (!t || t.length > Math.max(80, original.trim().length * 1.6) || gesehen.has(norm(t))) continue;
    gesehen.add(norm(t));
    ergebnis.push(t);
    if (ergebnis.length === 2) break;
  }
  return ergebnis;
}
