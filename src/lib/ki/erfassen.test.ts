import { test } from "node:test";
import assert from "node:assert/strict";
import { erfassenLesen, erfassenPrompt } from "./erfassen.ts";

test("Erfassen: KI-Antwort lesen und prüfen", () => {
  const f = ["Statistik", "Datenbanken"];
  assert.deepEqual(erfassenLesen('{"art":"PRUEFUNG","titel":"Klausur Statistik","fach":"statistik","wann":"2027-02-12T10:00","raum":"H1"}', f), {
    art: "PRUEFUNG",
    titel: "Klausur Statistik",
    fach: "Statistik",
    wann: "2027-02-12T10:00",
    raum: "H1",
  });
  const g = erfassenLesen('```json\n{"art":"gruppenarbeit","titel":"Marketing-Projekt","fach":"BWL","wann":"morgen","raum":""}\n```', f);
  assert.equal(g?.art, "GRUPPENARBEIT");
  assert.equal(g?.fach, null);
  assert.equal(g?.wann, null);
  assert.equal(g?.raum, null);
  assert.equal(erfassenLesen('{"art":"QUATSCH"}', f), null);
  assert.equal(erfassenLesen("kein json", f), null);
});

test("Erfassen: Prompt enthält Datum und Fächer", () => {
  const p = erfassenPrompt("Abgabe DB Freitag", ["Datenbanken"], { datum: "2026-11-17", wochentag: "Dienstag", uhrzeit: "22:00" });
  assert.match(p.nutzer, /Dienstag, 2026-11-17/);
  assert.match(p.nutzer, /"Datenbanken"/);
});
