/**
 * KI-07: MindMap aus einer Notiz – Prompt und Parser.
 * Die KI liefert nur die Struktur; Positionen berechnet der Code (radialLayout).
 * Ausgabe der KI: { wurzel: string, knoten: [{ text, kinder: [...] }] }
 */
import { KiEingabe, KiKeineDaten } from "./fehler.ts";
import { alsObjekt, jsonLesen, text } from "./json.ts";
import { einbetten, kuerzen, MATERIAL_REGEL, markerEntschaerfen } from "./material.ts";

export const MIN_MINDMAP_ZEICHEN = 100;
/** Ebenen unterhalb der Wurzel */
export const MAX_EBENEN = 3;
/** Knoten ohne die Wurzel */
export const MAX_KI_KNOTEN = 30;
export const MAX_KNOTEN_TEXT = 80;

export type EntwurfKnoten = { text: string; kinder: EntwurfKnoten[] };
export type MindmapEntwurf = { wurzel: string; knoten: EntwurfKnoten[] };

export function mindmapMoeglich(inhalt: string): boolean {
  return inhalt.trim().length >= MIN_MINDMAP_ZEICHEN;
}

export function mindmapPromptBauen(notiz: { titel: string; inhalt: string }) {
  const inhalt = notiz.inhalt.trim();
  if (inhalt.length < MIN_MINDMAP_ZEICHEN) throw new KiEingabe(`Die Notiz ist zu kurz für eine MindMap (mindestens ${MIN_MINDMAP_ZEICHEN} Zeichen).`);
  const { text: material, gekuerzt } = kuerzen(inhalt, 12_000);
  const system = [
    "Du machst aus einer Mitschrift eine übersichtliche MindMap.",
    `Die Wurzel ist das Hauptthema. Darunter höchstens ${MAX_EBENEN} Ebenen und insgesamt höchstens ${MAX_KI_KNOTEN} Knoten.`,
    "Jeder Knoten ist ein kurzer Begriff oder eine Stichphrase (höchstens 6 Wörter), keine ganzen Sätze.",
    "Nimm nur auf, was in der Notiz steht. Schreib in derselben Sprache wie die Notiz.",
    MATERIAL_REGEL,
    'Antworte nur mit JSON: {"wurzel":"…","knoten":[{"text":"…","kinder":[{"text":"…","kinder":[]}]}]}',
    'Hat die Notiz keinen Lerninhalt, antworte mit {"wurzel":"","knoten":[]}.',
  ].join("\n");
  const nutzer = `Titel der Notiz: ${markerEntschaerfen(notiz.titel.trim() || "Ohne Titel")}\n\n${einbetten(material, "notiz")}`;
  return { system, nutzer, gekuerzt };
}

/** Anzahl Knoten ohne Wurzel. */
export function knotenZaehlen(knoten: EntwurfKnoten[]): number {
  return knoten.reduce((n, k) => n + 1 + knotenZaehlen(k.kinder), 0);
}

/**
 * Baum bereinigen: leere Texte raus, Tiefe ≤ MAX_EBENEN, insgesamt ≤ MAX_KI_KNOTEN.
 * Gekürzt wird ebenenweise (Breitensuche), damit Hauptäste erhalten bleiben.
 */
export function entwurfBereinigen(rohKnoten: unknown, maxKnoten = MAX_KI_KNOTEN): EntwurfKnoten[] {
  type Arbeit = { roh: unknown; ziel: EntwurfKnoten[]; ebene: number };
  const ergebnis: EntwurfKnoten[] = [];
  let anzahl = 0;
  let schlange: Arbeit[] = Array.isArray(rohKnoten) ? rohKnoten.map((roh) => ({ roh, ziel: ergebnis, ebene: 1 })) : [];
  while (schlange.length && anzahl < maxKnoten) {
    const naechste: Arbeit[] = [];
    for (const { roh, ziel, ebene } of schlange) {
      if (anzahl >= maxKnoten) break;
      const o = alsObjekt(roh);
      const t = text(o.text, MAX_KNOTEN_TEXT);
      if (!t) continue;
      const knoten: EntwurfKnoten = { text: t, kinder: [] };
      ziel.push(knoten);
      anzahl++;
      if (ebene < MAX_EBENEN && Array.isArray(o.kinder)) {
        for (const kind of o.kinder) naechste.push({ roh: kind, ziel: knoten.kinder, ebene: ebene + 1 });
      }
    }
    schlange = naechste;
  }
  return ergebnis;
}

export function mindmapParsen(antwort: string, titelFallback: string): MindmapEntwurf {
  const daten = alsObjekt(jsonLesen(antwort));
  const knoten = entwurfBereinigen(daten.knoten);
  if (knoten.length === 0) throw new KiKeineDaten("Aus dieser Notiz ließ sich keine MindMap erstellen.");
  return { wurzel: text(daten.wurzel, MAX_KNOTEN_TEXT) || text(titelFallback, MAX_KNOTEN_TEXT) || "MindMap", knoten };
}
