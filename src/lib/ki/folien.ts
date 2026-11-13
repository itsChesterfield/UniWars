/**
 * KI-08: Folien-Gliederung aus einer Notiz oder einem Dokument – Prompt und Parser.
 * Nur die Layouts aus PRÄ-02; erste Folie immer "Titel"; höchstens 6 Stichpunkte je Folie.
 */
import { KiEingabe, KiKeineDaten } from "./fehler.ts";
import { alsObjekt, jsonLesen, text, textListe } from "./json.ts";
import { einbetten, kuerzen, MATERIAL_REGEL, markerEntschaerfen } from "./material.ts";

export const ERLAUBTE_FOLIENZAHL = [5, 8, 12] as const;
export type Folienzahl = (typeof ERLAUBTE_FOLIENZAHL)[number];
export const MIN_FOLIEN_ZEICHEN = 200;
export const MAX_PUNKTE_JE_FOLIE = 6;

/** Layouts wie im Präsentations-Hub (PRÄ-02) */
export type FolienLayout = "TITEL" | "TEXT" | "BILD" | "ZWEISPALTIG";
export type EntwurfFolie = { layout: FolienLayout; titel: string; untertitel: string; punkte: string[]; punkteRechts: string[] };
export type FolienEntwurf = { titel: string; folien: EntwurfFolie[] };

/** Namen, die die KI benutzt → interne Layouts */
const LAYOUT_NAMEN: Record<string, FolienLayout> = {
  titel: "TITEL",
  titel_text: "TEXT",
  titel_bild: "BILD",
  zweispaltig: "ZWEISPALTIG",
};

export function istFolienzahl(wert: unknown): wert is Folienzahl {
  return (ERLAUBTE_FOLIENZAHL as readonly unknown[]).includes(wert);
}

export function folienPromptBauen(material: { titel: string; text: string }, anzahl: Folienzahl) {
  const inhalt = material.text.trim();
  if (inhalt.length < MIN_FOLIEN_ZEICHEN) throw new KiEingabe(`Der Text ist zu kurz für eine Präsentation (mindestens ${MIN_FOLIEN_ZEICHEN} Zeichen).`);
  const { text: quelle, gekuerzt } = kuerzen(inhalt, 15_000);
  const system = [
    "Du erstellst die Gliederung für Referatsfolien von Studierenden.",
    `Erstelle genau ${anzahl} Folien, sofern das Material dafür reicht, sonst weniger. Nimm nur auf, was im Material steht.`,
    'Erlaubte Layouts: "titel" (Titel + Untertitel), "titel_text" (Überschrift + Stichpunkte), "titel_bild" (Überschrift + Platz für ein Bild, das der Nutzer selbst einfügt), "zweispaltig" (Überschrift + zwei Spalten mit Stichpunkten, z. B. Vergleich).',
    `Die erste Folie hat immer das Layout "titel". Höchstens ${MAX_PUNKTE_JE_FOLIE} kurze Stichpunkte pro Folie bzw. Spalte, keine ganzen Absätze.`,
    "Schreib in derselben Sprache wie das Material.",
    MATERIAL_REGEL,
    'Antworte nur mit JSON: {"titel":"…","folien":[{"layout":"titel","titel":"…","untertitel":"…"},{"layout":"titel_text","titel":"…","punkte":["…"]},{"layout":"zweispaltig","titel":"…","punkte":["…"],"punkte_rechts":["…"]}]}',
    'Hat das Material keinen verwertbaren Inhalt, antworte mit {"titel":"","folien":[]}.',
  ].join("\n");
  const nutzer = `Titel: ${markerEntschaerfen(material.titel.trim() || "Ohne Titel")}\n\n${einbetten(quelle, "quelle")}`;
  return { system, nutzer, gekuerzt };
}

/** Eine Folie bereinigen (auch für vom Nutzer bearbeitete Entwürfe). */
export function folieBereinigen(roh: unknown): EntwurfFolie | null {
  const o = alsObjekt(roh);
  const layoutRoh = typeof o.layout === "string" ? o.layout.toLowerCase() : "";
  const layout = LAYOUT_NAMEN[layoutRoh] ?? (["TITEL", "TEXT", "BILD", "ZWEISPALTIG"].includes(String(o.layout)) ? (o.layout as FolienLayout) : "TEXT");
  const titel = text(o.titel, 150);
  const untertitel = layout === "TITEL" ? text(o.untertitel, 200) : "";
  const punkte = layout === "TEXT" || layout === "ZWEISPALTIG" ? textListe(o.punkte, 200, MAX_PUNKTE_JE_FOLIE) : [];
  const punkteRechts = layout === "ZWEISPALTIG" ? textListe(o.punkte_rechts ?? o.punkteRechts, 200, MAX_PUNKTE_JE_FOLIE) : [];
  if (!titel && !punkte.length && !punkteRechts.length) return null;
  return { layout, titel, untertitel, punkte, punkteRechts };
}

export function folienParsen(antwort: string, anzahl: number, titelFallback: string): FolienEntwurf {
  const daten = alsObjekt(jsonLesen(antwort));
  const titel = text(daten.titel, 150) || text(titelFallback, 150) || "Präsentation";
  const folien = (Array.isArray(daten.folien) ? daten.folien : []).map(folieBereinigen).filter((f): f is EntwurfFolie => f !== null);
  if (folien.length === 0) throw new KiKeineDaten("Aus diesem Text ließ sich keine Präsentation erstellen.");
  return { titel, folien: mitTitelfolie(titel, folien).slice(0, Math.max(1, anzahl)) };
}

/** Erste Folie muss "Titel" sein – sonst wird eine vorangestellt. */
export function mitTitelfolie(titel: string, folien: EntwurfFolie[]): EntwurfFolie[] {
  if (folien[0]?.layout === "TITEL") return folien;
  return [{ layout: "TITEL", titel, untertitel: "", punkte: [], punkteRechts: [] }, ...folien];
}
