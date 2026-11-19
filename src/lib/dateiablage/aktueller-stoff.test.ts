import assert from "node:assert/strict";
import { test } from "node:test";
import { aktuelleMaterialfolge, fachAusStofffrage, fragtNachLetztemStoff } from "./aktueller-stoff.ts";
import { materialRefs, materialZiel } from "./material.ts";

test("Vorlesungstermine bestimmen den Crashkurs auch bei aktuellen Uploads alter Materialien", () => {
  const result = aktuelleMaterialfolge(
    [{ datum: "2026-11-17", material: "neu" }, { datum: "2026-11-10", material: "vorher" },
      { datum: "2026-11-08", material: "davor" }, { datum: "2026-01-01", material: "alt" },
      { datum: "2026-11-30", material: "zukuenftig" }],
    [{ zeit: "2026-11-18T23:00:00Z", material: "alt" }],
    "2026-11-19", (m) => m,
  );
  assert.deepEqual(result, { basis: "vorlesungen", material: ["neu", "vorher", "davor"] });
});

test("Uploadzeiten sind eine gekennzeichnete Basis ohne vergangene Vorlesung", () => {
  const result = aktuelleMaterialfolge(
    [{ datum: "2026-11-30", material: "zukuenftig" }],
    [{ zeit: "2026-10-18", material: "älter" }, { zeit: "2026-11-18", material: "neu" }, { zeit: "2026-11-19", material: "zukuenftig" }],
    "2026-11-19", (m) => m,
  );
  assert.deepEqual(result, { basis: "uploads", material: ["neu", "älter"] });
});

test("Materialauswahl prüft Typ und ID und dedupliziert Quellen", () => {
  const id = "91000000-0000-4000-8000-000000000001";
  const ref = { art: "whiteboard", id };
  assert.deepEqual(materialRefs([ref, ref], 2), [ref]);
  assert.deepEqual(materialRefs([ref, { art: "constructor", id }], 2), []);
  assert.deepEqual(materialRefs([ref, ref], 1), []);
  assert.equal(materialZiel({ art: "vorlesung", id, datum: "2026-02-31" }), null);
});

test("Die Frage aus Studio lädt den zuletzt behandelten Stoff auch ohne das Wort Crashkurs", () => {
  assert.equal(fragtNachLetztemStoff("erkläre mir was wir zuletzt in Datenbanken gemacht haben"), true);
  assert.equal(fragtNachLetztemStoff("Was haben wir in der letzten Vorlesung behandelt?"), true);
  assert.equal(fragtNachLetztemStoff("Welche Aufgaben habe ich zuletzt erledigt?"), false);
  assert.equal(fragtNachLetztemStoff("Erklär mir SQL-Joins"), false);
  const faecher = [{ name: "Datenbanken" }, { name: "Datenbanken II" }];
  assert.deepEqual(fachAusStofffrage("Was haben wir zuletzt in Datenbanken II gemacht?", faecher), faecher[1]);
  assert.equal(fachAusStofffrage("Was haben wir zuletzt in Datenbankensysteme gemacht?", faecher), undefined);
});
