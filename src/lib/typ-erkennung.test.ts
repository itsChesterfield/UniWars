import { test } from "node:test";
import assert from "node:assert/strict";
import { erkenneTyp, erkenneDatum } from "./typ-erkennung.ts";

test("erkenneTyp: Klausur/Prüfung -> PRUEFUNG", () => {
  assert.deepEqual(erkenneTyp("Klausur Mathe"), { typ: "PRUEFUNG", sicher: true });
  assert.deepEqual(erkenneTyp("Prüfung Datenbanksysteme"), { typ: "PRUEFUNG", sicher: true });
  assert.deepEqual(erkenneTyp("Test in BWL"), { typ: "PRUEFUNG", sicher: true });
  assert.deepEqual(erkenneTyp("Examen Vorbereitung"), { typ: "PRUEFUNG", sicher: true });
});

test("erkenneTyp: Abgabe-Keywords -> ABGABE", () => {
  assert.deepEqual(erkenneTyp("Abgabe Übungsblatt 3"), { typ: "ABGABE", sicher: true });
  assert.deepEqual(erkenneTyp("Hausarbeit einreichen"), { typ: "ABGABE", sicher: true });
  assert.deepEqual(erkenneTyp("Protokoll fertig machen"), { typ: "ABGABE", sicher: true });
  assert.deepEqual(erkenneTyp("Bericht schreiben"), { typ: "ABGABE", sicher: true });
  assert.deepEqual(erkenneTyp("Essay abgeben"), { typ: "ABGABE", sicher: true });
});

test("erkenneTyp: Termin-Keywords -> TERMIN", () => {
  assert.deepEqual(erkenneTyp("Meeting mit Prof"), { typ: "TERMIN", sicher: true });
  assert.deepEqual(erkenneTyp("Treffen im Cafe"), { typ: "TERMIN", sicher: true });
  assert.deepEqual(erkenneTyp("Sprechstunde Herr Müller"), { typ: "TERMIN", sicher: true });
});

test("erkenneTyp: Gruppenarbeit-Keywords -> GRUPPENARBEIT", () => {
  assert.deepEqual(erkenneTyp("Gruppenarbeit Projekt"), { typ: "GRUPPENARBEIT", sicher: true });
  assert.deepEqual(erkenneTyp("Team Meeting vorbereiten"), { typ: "TERMIN", sicher: true });
  assert.deepEqual(erkenneTyp("zusammen mit Lea arbeiten"), {
    typ: "GRUPPENARBEIT",
    sicher: true,
  });
});

test("erkenneTyp: Priorität Prüfung vor Abgabe bei mehreren Treffern", () => {
  assert.deepEqual(erkenneTyp("Klausur Abgabe der Zulassung"), {
    typ: "PRUEFUNG",
    sicher: true,
  });
});

test("erkenneTyp: kein Treffer -> ABGABE unsicher", () => {
  assert.deepEqual(erkenneTyp("Wäsche waschen"), { typ: "ABGABE", sicher: false });
  assert.deepEqual(erkenneTyp(""), { typ: "ABGABE", sicher: false });
});

test("erkenneDatum: relative deutsche Ausdrücke", () => {
  assert.ok(erkenneDatum("Treffen morgen 18 Uhr") instanceof Date);
  assert.ok(erkenneDatum("Klausur am Freitag") instanceof Date);
  assert.ok(erkenneDatum("Abgabe nächsten Montag um 23:59") instanceof Date);
});

test("erkenneDatum: kein Datum im Text -> null", () => {
  assert.equal(erkenneDatum("Wäsche waschen"), null);
  assert.equal(erkenneDatum("Hausarbeit"), null);
});
