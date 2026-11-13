/**
 * KI-10: Formel-Helfer für Tabellen. Die KI kennt nur die unterstützten Funktionen
 * (TAB-04) und die Spaltenüberschriften (Zeile 1) – keine Zellinhalte.
 * Jeder Vorschlag wird vor dem Anzeigen mit dem echten Formel-Parser geprüft.
 */
import { KiEingabe, KiKeineDaten } from "./fehler.ts";
import { alsObjekt, jsonLesen, text } from "./json.ts";
import { MATERIAL_REGEL, markerEntschaerfen } from "./material.ts";
import { formelBezuege, formelGueltig, FUNKTIONEN, spaltenName, zerlegen } from "../tabellen/formeln.ts";

export const MAX_BESCHREIBUNG = 300;
export type FormelVorschlag = { formel: string; erklaerung: string };
export type FormelKontext = { kopfzeile: string[]; spalten: number; zeilen: number; ziel: string };

const KEINE_FORMEL = "Dafür gibt es noch keine passende Formel.";

export function formelPromptBauen(beschreibung: string, kontext: FormelKontext) {
  const wunsch = beschreibung.trim();
  if (wunsch.length < 3) throw new KiEingabe("Beschreib kurz, was du berechnen willst.");
  if (wunsch.length > MAX_BESCHREIBUNG) throw new KiEingabe("Die Beschreibung ist zu lang.");
  const spalten = kontext.kopfzeile
    .slice(0, kontext.spalten)
    .map((k, i) => `${spaltenName(i)}: ${markerEntschaerfen(text(k, 40)) || "(ohne Überschrift)"}`)
    .join("\n");
  const system = [
    "Du schlägst Formeln für eine einfache Tabellenkalkulation vor.",
    `Erlaubt sind NUR diese Funktionen: ${FUNKTIONEN.join(", ")}. Dazu + - * / und Klammern.`,
    'Syntax: Formel beginnt mit "=", Zellbezüge wie A1, Bereiche wie B2:B20, Argumente mit Semikolon getrennt, Dezimalkomma. Beispiel: =MITTELWERT(B2:B20)',
    "Es gibt KEINE Bedingungen (kein WENN, SUMMEWENN usw.) und keine Textfunktionen. Lässt sich der Wunsch damit nicht umsetzen, gib formel null zurück.",
    `Die Tabelle hat die Spalten A bis ${spaltenName(kontext.spalten - 1)} und die Zeilen 1 bis ${kontext.zeilen}. Zeile 1 enthält die Überschriften, Daten beginnen in Zeile 2.`,
    `Die Formel kommt in Zelle ${kontext.ziel} und darf diese Zelle nicht selbst enthalten.`,
    MATERIAL_REGEL,
    'Antworte nur mit JSON: {"formel":"=…","erklaerung":"ein kurzer Satz"} oder {"formel":null,"erklaerung":"warum nicht"}',
  ].join("\n");
  const nutzer = `Spaltenüberschriften:\n<quelle>\n${spalten}\n</quelle>\n\nWunsch:\n<quelle>\n${markerEntschaerfen(wunsch)}\n</quelle>`;
  return { system, nutzer };
}

/** Prüft den Vorschlag: gültige Syntax, nur bekannte Funktionen, Bezüge innerhalb der Tabelle, kein Selbstbezug. */
export function formelVorschlagParsen(antwort: string, kontext: FormelKontext): FormelVorschlag {
  const d = alsObjekt(jsonLesen(antwort));
  let formel = text(d.formel, 500).replace(/\s+/g, "");
  if (!formel) throw new KiKeineDaten(KEINE_FORMEL);
  if (!formel.startsWith("=")) formel = `=${formel}`;
  formel = formel.toUpperCase();
  if (!formelGueltig(formel)) throw new KiKeineDaten(KEINE_FORMEL);

  const ziel = zerlegen(kontext.ziel);
  for (const { von, bis } of formelBezuege(formel)) {
    const a = zerlegen(von);
    const b = zerlegen(bis);
    if (!a || !b) throw new KiKeineDaten(KEINE_FORMEL);
    if (Math.max(a.spalte, b.spalte) >= kontext.spalten || Math.max(a.zeile, b.zeile) >= kontext.zeilen) throw new KiKeineDaten(KEINE_FORMEL);
    if (
      ziel &&
      ziel.spalte >= Math.min(a.spalte, b.spalte) &&
      ziel.spalte <= Math.max(a.spalte, b.spalte) &&
      ziel.zeile >= Math.min(a.zeile, b.zeile) &&
      ziel.zeile <= Math.max(a.zeile, b.zeile)
    ) {
      throw new KiKeineDaten("Die Formel würde sich selbst berechnen. Wähl eine Zelle außerhalb der Daten.");
    }
  }
  return { formel, erklaerung: text(d.erklaerung, 300) };
}
