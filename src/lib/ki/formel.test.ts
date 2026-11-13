import { test } from "node:test";
import assert from "node:assert/strict";
import { formelPromptBauen, formelVorschlagParsen, type FormelKontext } from "./formel.ts";
import { KiEingabe, KiKeineDaten } from "./fehler.ts";
import { formelGueltig } from "../tabellen/formeln.ts";

const KONTEXT: FormelKontext = { kopfzeile: ["Fach", "Note", "Status"], spalten: 3, zeilen: 20, ziel: "B20" };

test("KI-10: gültige Formel wird übernommen (auch ohne '=' und klein geschrieben)", () => {
  assert.deepEqual(formelVorschlagParsen('{"formel":"=MITTELWERT(B2:B19)","erklaerung":"Durchschnitt der Noten."}', KONTEXT), {
    formel: "=MITTELWERT(B2:B19)",
    erklaerung: "Durchschnitt der Noten.",
  });
  assert.equal(formelVorschlagParsen('{"formel":"summe(b2:b5) / anzahl(b2:b5)"}', KONTEXT).formel, "=SUMME(B2:B5)/ANZAHL(B2:B5)");
});

test("KI-10: ungültige Formeln werden abgefangen", () => {
  const ungueltig = [
    '{"formel":"=WENN(C2=\\"bestanden\\";B2;0)"}', // nicht unterstützte Funktion
    '{"formel":"=SUMMEWENN(C2:C19;\\"x\\";B2:B19)"}',
    '{"formel":"=SUMME(B2:B19"}', // Klammer fehlt
    '{"formel":"=B2 + + "}',
    '{"formel":null,"erklaerung":"Bedingungen gibt es nicht."}',
    "kaputt",
    '{"formel":"=SUMME(Z2:Z5)"}', // Spalte gibt es nicht
    '{"formel":"=SUMME(B2:B99)"}', // Zeile außerhalb
  ];
  for (const a of ungueltig) {
    assert.throws(() => formelVorschlagParsen(a, KONTEXT), (e) => e instanceof KiKeineDaten && e.nutzerMeldung === "Dafür gibt es noch keine passende Formel.", a);
  }
});

test("KI-10: Selbstbezug (Zielzelle im Bereich) wird abgelehnt", () => {
  assert.throws(() => formelVorschlagParsen('{"formel":"=SUMME(B2:B20)"}', KONTEXT), (e) => e instanceof KiKeineDaten && /sich selbst/.test(e.nutzerMeldung));
  assert.throws(() => formelVorschlagParsen('{"formel":"=B20*2"}', KONTEXT), KiKeineDaten);
});

test("KI-10: Prompt nennt Funktionen und Überschriften, aber keine Zellinhalte; Beschreibung begrenzt", () => {
  const p = formelPromptBauen("Durchschnitt der Noten", KONTEXT);
  assert.match(p.system, /SUMME, MITTELWERT, MIN, MAX, ANZAHL/);
  assert.match(p.system, /Zelle B20/);
  assert.match(p.nutzer, /A: Fach\nB: Note\nC: Status/);
  assert.throws(() => formelPromptBauen("x", KONTEXT), KiEingabe);
  assert.throws(() => formelPromptBauen("x".repeat(301), KONTEXT), KiEingabe);
});

test("Formel-Parser: formelGueltig", () => {
  assert.equal(formelGueltig("=SUMME(A1:A3)+2"), true);
  assert.equal(formelGueltig("SUMME(A1:A3)"), false);
  assert.equal(formelGueltig("=WENN(A1;1;2)"), false);
  assert.equal(formelGueltig("="), false);
});
