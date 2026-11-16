/**
 * Verlinkungen in Notizen (wie Obsidian): [[Notiz]], [[Notiz|Anzeigetext]],
 * [[Skript.pdf]], [[Skript.pdf#S12]]. Reine Logik – im Browser und auf dem Server.
 */

export type Wikilink = {
  /** Name der Notiz bzw. Dateiname der PDF (ohne #S…) */
  name: string;
  /** Seite in der PDF (nur bei PDFs) */
  seite: number | null;
  /** eigener Anzeigetext */
  label: string | null;
};

const MUSTER = /\[\[([^\]|\n]+?)(?:\|([^\]\n]+))?\]\]/g;

/** "Skript.pdf#S12" → { name: "Skript.pdf", seite: 12 } */
export function zielZerlegen(ziel: string): { name: string; seite: number | null } {
  const m = ziel.trim().match(/^(.*?)#(?:S\.?\s*|Seite\s*)?(\d{1,5})$/i);
  // Seitenangaben gibt es nur bei PDFs – "Übung #3" bleibt ein Notizname
  if (m && m[1].trim() && istPdfName(m[1])) return { name: m[1].trim(), seite: Number(m[2]) || null };
  return { name: ziel.trim(), seite: null };
}

export function istPdfName(name: string): boolean {
  return /\.pdf$/i.test(name.trim());
}

/** Ziel-Text für den Link: "Skript.pdf#S12" */
export function zielText(name: string, seite?: number | null): string {
  return seite ? `${name}#S${seite}` : name;
}

/** Alle Verlinkungen in einem Markdown-Text (ohne Code-Blöcke), ohne Duplikate. */
export function wikilinksFinden(markdown: string): Wikilink[] {
  const ohneCode = markdown.replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]*`/g, " ");
  const gesehen = new Set<string>();
  const liste: Wikilink[] = [];
  for (const m of ohneCode.matchAll(MUSTER)) {
    const { name, seite } = zielZerlegen(m[1]);
    if (!name) continue;
    const schluessel = `${name.toLowerCase()}#${seite ?? ""}`;
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    liste.push({ name, seite, label: m[2]?.trim() || null });
  }
  return liste;
}

function regexEscape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Nach dem Umbenennen einer Notiz die Links in einem anderen Text anpassen. */
export function linksUmbenennen(markdown: string, alt: string, neu: string): string {
  if (!alt.trim() || !neu.trim() || alt === neu) return markdown;
  const muster = new RegExp(`\\[\\[${regexEscape(alt.trim())}(#[^\\]|\\n]*)?(\\|[^\\]\\n]+)?\\]\\]`, "gi");
  return markdown.replace(muster, (_g, anker: string | undefined, label: string | undefined) => `[[${neu.trim()}${anker ?? ""}${label ?? ""}]]`);
}

/** #tags im Text (wie Obsidian), ohne Überschriften und Code. */
export function tagsFinden(markdown: string): string[] {
  const ohneCode = markdown.replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]*`/g, " ");
  const tags = new Set<string>();
  for (const m of ohneCode.matchAll(/(^|[\s(])#([\p{L}][\p{L}\p{N}_/-]{0,40})/gu)) tags.add(m[2].toLowerCase());
  return [...tags];
}
