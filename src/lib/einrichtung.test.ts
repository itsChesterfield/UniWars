import { test } from "node:test";
import assert from "node:assert/strict";
import { einrichtungZeigen, kontoNeuUndLeer, schritte, schrittBegrenzen, standLesen, standSchreiben, zusammenfassung, type KontoDaten } from "./einrichtung.ts";

const jetzt = new Date("2026-11-19T10:00:00Z");
const leer: KontoDaten = { seit: "2026-11-18T09:00:00Z", faecher: 0, aufgaben: 0, stundenplan: 0, hochschule: false, mensa: false };

test("Stand aus dem Cookie lesen und schreiben", () => {
  assert.deepEqual(standLesen(undefined), { art: "neu" });
  assert.deepEqual(standLesen("fertig"), { art: "fertig" });
  assert.deepEqual(standLesen("laeuft:3"), { art: "laeuft", schritt: 3 });
  assert.deepEqual(standLesen("laeuft:x"), { art: "neu" });
  assert.equal(standSchreiben({ art: "laeuft", schritt: 2 }), "laeuft:2");
  assert.equal(standSchreiben({ art: "fertig" }), "fertig");
});

test("nur neue, leere Konten", () => {
  assert.equal(kontoNeuUndLeer(leer, jetzt), true);
  assert.equal(kontoNeuUndLeer({ ...leer, faecher: 1 }, jetzt), false);
  assert.equal(kontoNeuUndLeer({ ...leer, aufgaben: 2 }, jetzt), false);
  assert.equal(kontoNeuUndLeer({ ...leer, hochschule: true }, jetzt), false);
  assert.equal(kontoNeuUndLeer({ ...leer, seit: "2026-09-01T00:00:00Z" }, jetzt), false);
  assert.equal(kontoNeuUndLeer({ ...leer, seit: null }, jetzt), false);
});

test("laufende Einrichtung geht vor, fertige nie wieder", () => {
  assert.equal(einrichtungZeigen({ art: "laeuft", schritt: 2 }, { ...leer, faecher: 3 }, jetzt), true);
  assert.equal(einrichtungZeigen({ art: "fertig" }, leer, jetzt), false);
  assert.equal(einrichtungZeigen({ art: "neu" }, leer, jetzt), true);
});

test("Schritte und Grenzen", () => {
  assert.deepEqual(schritte(false), ["hochschule", "stundenplan", "mensa", "faecher"]);
  assert.equal(schritte(true).length, 5);
  assert.equal(schrittBegrenzen(9, 4), 5);
  assert.equal(schrittBegrenzen(-1, 4), 0);
});

test("Zusammenfassung", () => {
  assert.equal(zusammenfassung({ hochschule: null, termine: 0, faecher: 0, mensa: null, kalender: false }), "Du kannst alles später in den Einstellungen ergänzen.");
  assert.equal(
    zusammenfassung({ hochschule: "FU Berlin", termine: 9, faecher: 1, mensa: "Mensa Nord", kalender: true }),
    "FU Berlin, 1 Fach, 9 Termine im Stundenplan, Google Kalender verbunden, Mensa Nord. Alles lässt sich später in den Einstellungen ändern.",
  );
});
