/**
 * KI-03: Kontext aus PDF-Seiten auswählen – ohne Vektor-Datenbank (Version 1).
 * Läuft im Browser (Auswahl) und auf dem Server (Prüfung). Reine Logik, testbar.
 *
 * Bei Fragen werden die Seiten nach einfacher Stichwort-Relevanz sortiert
 * (Wörter der Frage ohne Stoppwörter, gewichtet nach Seltenheit) und mitgeschickt,
 * bis das Zeichenlimit erreicht ist. Die aktuelle Seite ist immer dabei.
 */
import { einbetten, MATERIAL_REGEL, markerEntschaerfen } from "./material.ts";

export type PdfSeite = { seite: number; text: string };

export const MAX_KONTEXT_ZEICHEN = 15_000;
/** Ab so wenig Text gilt ein PDF als gescannt (kein lesbarer Text) */
export const MIN_TEXT_JE_SEITE = 20;
export const MAX_FRAGE_ZEICHEN = 500;
/** Höchstzahl Seiten, die in einer Anfrage mitgeschickt werden */
export const MAX_SEITEN_JE_ANFRAGE = 60;

const STOPPWOERTER = new Set(
  (
    "der die das den dem des ein eine einer eines einem einen und oder aber auch als am an auf aus bei bis da dann dass daß " +
    "dein deine dem den denn dessen dies diese dieser dieses doch du durch er es etwa euch für hat hatte haben hier ich ihr " +
    "im in ins ist ja je jede jedem jeden jeder jedes kann kein keine können man mehr mein mich mir mit muss nach nicht noch " +
    "nun nur ob ohne sehr sein seine sich sie sind so soll sollte sowie über um uns unter viel vom von vor war was weil welche " +
    "welcher welches wenn wer werden wie wieder wir wird wo wurde zu zum zur zwischen bitte erkläre erklär erklären steht stehen " +
    "gibt geben wieso warum weshalb welchen welchem worum woran seite seiten skript kapitel " +
    "the a an and or of to in on for with is are was were be by as at from that this what which who how why does do"
  ).split(" "),
);

/** Wörter für die Relevanz: Kleinbuchstaben, ohne Stoppwörter, mindestens 3 Zeichen. */
export function woerter(text: string): string[] {
  return (text.toLocaleLowerCase("de-DE").match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length >= 3 && !STOPPWOERTER.has(w));
}

/** Gilt das Wort als Treffer für den Suchbegriff? (gleiche Wortanfänge decken Plural/Flexion ab) */
function passt(wort: string, begriff: string): boolean {
  if (wort === begriff) return true;
  const kurz = Math.min(wort.length, begriff.length);
  return kurz >= 5 && (wort.startsWith(begriff) || begriff.startsWith(wort));
}

/** Relevanz jeder Seite für die Frage (tf × idf). */
export function relevanz(seiten: PdfSeite[], frage: string): Map<number, number> {
  const begriffe = [...new Set(woerter(frage))];
  const seitenWoerter = seiten.map((s) => ({ seite: s.seite, woerter: woerter(s.text) }));
  const n = Math.max(1, seiten.length);
  const ergebnis = new Map<number, number>();
  const df = new Map(begriffe.map((b) => [b, seitenWoerter.filter((s) => s.woerter.some((w) => passt(w, b))).length]));
  for (const s of seitenWoerter) {
    let punkte = 0;
    for (const b of begriffe) {
      const tf = s.woerter.filter((w) => passt(w, b)).length;
      if (tf) punkte += (1 + Math.log(tf)) * (Math.log(n / (df.get(b) ?? 1)) + 1);
    }
    ergebnis.set(s.seite, punkte);
  }
  return ergebnis;
}

/** Seiten zuschneiden, bis das Zeichenbudget voll ist (Reihenfolge = Priorität). */
function packen(prioritaet: PdfSeite[], maxZeichen: number): PdfSeite[] {
  const auswahl: PdfSeite[] = [];
  let rest = maxZeichen;
  for (const s of prioritaet) {
    if (rest <= 0 || auswahl.length >= MAX_SEITEN_JE_ANFRAGE) break;
    const text = s.text.trim();
    if (!text) continue;
    if (text.length <= rest) {
      auswahl.push({ seite: s.seite, text });
      rest -= text.length;
    } else if (rest >= 500 || auswahl.length === 0) {
      auswahl.push({ seite: s.seite, text: text.slice(0, rest) });
      rest = 0;
    } else {
      break;
    }
  }
  return auswahl.sort((a, b) => a.seite - b.seite);
}

/**
 * Seiten für eine Frage: aktuelle Seite zuerst, dann nach Relevanz (bei Gleichstand näher
 * an der aktuellen Seite). Gibt es keine Treffer, werden die Nachbarseiten genommen.
 */
export function seitenFuerFrage(seiten: PdfSeite[], frage: string, aktuelleSeite: number, maxZeichen = MAX_KONTEXT_ZEICHEN): PdfSeite[] {
  const punkte = relevanz(seiten, frage);
  const aktuell = seiten.find((s) => s.seite === aktuelleSeite);
  const andere = seiten
    .filter((s) => s.seite !== aktuelleSeite)
    .map((s) => ({ s, p: punkte.get(s.seite) ?? 0, abstand: Math.abs(s.seite - aktuelleSeite) }));
  const treffer = andere.filter((x) => x.p > 0).sort((a, b) => b.p - a.p || a.abstand - b.abstand);
  const rest = treffer.length ? treffer : andere.filter((x) => x.abstand <= 2).sort((a, b) => a.abstand - b.abstand);
  return packen([...(aktuell ? [aktuell] : []), ...rest.map((x) => x.s)], maxZeichen);
}

/** Seitenbereich (z. B. für Zusammenfassung/Karteikarten), gekürzt auf das Zeichenlimit. */
export function seitenBereich(seiten: PdfSeite[], von: number, bis: number, maxZeichen = MAX_KONTEXT_ZEICHEN): { seiten: PdfSeite[]; gekuerzt: boolean } {
  const [a, b] = von <= bis ? [von, bis] : [bis, von];
  const im = seiten.filter((s) => s.seite >= a && s.seite <= b).sort((x, y) => x.seite - y.seite);
  const gepackt = packen(im, maxZeichen);
  const gesamt = im.reduce((n, s) => n + s.text.trim().length, 0);
  const genutzt = gepackt.reduce((n, s) => n + s.text.length, 0);
  return { seiten: gepackt, gekuerzt: genutzt < gesamt };
}

/** Hat das PDF lesbaren Text? (gescannte PDFs haben keinen) */
export function hatLesbarenText(seiten: PdfSeite[]): boolean {
  const zeichen = seiten.reduce((n, s) => n + s.text.trim().length, 0);
  return zeichen >= Math.max(50, MIN_TEXT_JE_SEITE * Math.min(seiten.length, 5));
}

/** Seiten für den Prompt, jede in <seite nr="…">. */
export function seitenEinbetten(seiten: PdfSeite[]): string {
  return seiten.map((s) => einbetten(s.text, "seite", { nr: s.seite })).join("\n\n");
}

/** Server-Prüfung der vom Browser geschickten Seiten. */
export function seitenPruefen(roh: unknown, maxZeichen = MAX_KONTEXT_ZEICHEN + 1000): PdfSeite[] | null {
  if (!Array.isArray(roh) || roh.length === 0 || roh.length > MAX_SEITEN_JE_ANFRAGE) return null;
  const seiten: PdfSeite[] = [];
  let summe = 0;
  for (const s of roh) {
    const o = (s ?? {}) as Record<string, unknown>;
    const seite = Number(o.seite);
    if (!Number.isInteger(seite) || seite < 1 || seite > 100_000 || typeof o.text !== "string") return null;
    summe += o.text.length;
    if (summe > maxZeichen) return null;
    seiten.push({ seite, text: o.text });
  }
  return seiten;
}

const SEITEN_REGEL = "Nenne zu jeder Aussage die Seite in eckigen Klammern, z. B. [S. 12] oder [S. 12–14].";

export function pdfFragePrompt(titel: string, frage: string, seiten: PdfSeite[]) {
  const system = [
    "Du beantwortest Fragen von Studierenden zu ihrem Skript.",
    "Antworte nur aus den mitgeschickten Seiten. Steht die Antwort nicht darin, sag ehrlich: „Dazu steht auf den gelesenen Seiten nichts.“ und erfinde nichts.",
    SEITEN_REGEL,
    "Antworte kurz und konkret in der Sprache der Frage. Markdown sparsam (Fettdruck, Aufzählungen).",
    MATERIAL_REGEL,
  ].join("\n");
  const nutzer = `Dokument: ${markerEntschaerfen(titel)}\n\n${seitenEinbetten(seiten)}\n\nFrage:\n${einbetten(frage.trim().slice(0, MAX_FRAGE_ZEICHEN), "quelle")}`;
  return { system, nutzer };
}

export function pdfZusammenfassungPrompt(titel: string, seiten: PdfSeite[]) {
  const system = [
    "Du fasst Seiten aus dem Skript eines Studierenden zusammen.",
    "Schreib 4 bis 8 kurze Stichpunkte als Markdown-Liste, nur mit dem, was auf den Seiten steht.",
    SEITEN_REGEL,
    "Schreib in derselben Sprache wie das Skript.",
    MATERIAL_REGEL,
  ].join("\n");
  return { system, nutzer: `Dokument: ${markerEntschaerfen(titel)}\n\n${seitenEinbetten(seiten)}` };
}

export type TextTeil = { typ: "text"; text: string } | { typ: "seite"; seite: number; label: string };

/**
 * Antworttext in Text und klickbare Seitenverweise zerlegen.
 * Erkennt [S. 12], [S. 12–14], (S. 3), [Seite 7], [S. 3, 5].
 */
export function seitenVerweise(text: string, maxSeite = Number.POSITIVE_INFINITY): TextTeil[] {
  const teile: TextTeil[] = [];
  const muster = /[[(]\s*(?:S\.|Seiten?)\s*(\d+(?:\s*[–-]\s*\d+)?(?:\s*(?:,|und)\s*\d+(?:\s*[–-]\s*\d+)?)*)\s*[\])]/gi;
  let pos = 0;
  for (const m of text.matchAll(muster)) {
    const start = m.index ?? 0;
    if (start > pos) teile.push({ typ: "text", text: text.slice(pos, start) });
    const angaben = m[1].split(/\s*(?:,|und)\s*/);
    const links = angaben
      .map((a) => ({ a: a.replace(/\s+/g, ""), erste: Number(a.match(/\d+/)?.[0]) }))
      .filter((x) => x.erste >= 1 && x.erste <= maxSeite);
    if (links.length === 0) teile.push({ typ: "text", text: m[0] });
    else for (const l of links) teile.push({ typ: "seite", seite: l.erste, label: `S. ${l.a.replace("-", "–")}` });
    pos = start + m[0].length;
  }
  if (pos < text.length) teile.push({ typ: "text", text: text.slice(pos) });
  return teile;
}
