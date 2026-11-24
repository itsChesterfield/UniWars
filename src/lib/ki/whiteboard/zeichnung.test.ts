import { test } from "node:test";
import assert from "node:assert/strict";
import { ereignisAnwenden, LEERE_ZEICHNUNG } from "./zeichnung.ts";
import { BEISPIEL_EREIGNISSE } from "./beispiel.ts";

test("titel wird gesetzt, aendert die Elemente nicht", () => {
  const z = ereignisAnwenden(LEERE_ZEICHNUNG, { typ: "titel", text: "Thema" });
  assert.equal(z.titel, "Thema");
  assert.equal(z.elemente.length, 0);
});

test("Zeichen-Ereignisse werden in Reihenfolge angehaengt", () => {
  let z = ereignisAnwenden(LEERE_ZEICHNUNG, { typ: "bild", symbol: "baum", x: 1, y: 2, groesse: 100 });
  z = ereignisAnwenden(z, { typ: "pfeil", x1: 0, y1: 0, x2: 1, y2: 1 });
  z = ereignisAnwenden(z, { typ: "text", text: "A", x: 5, y: 5, groesse: 20 });
  z = ereignisAnwenden(z, { typ: "strich", punkte: [0, 0, 1, 1] });
  z = ereignisAnwenden(z, { typ: "linie", x1: 0, y1: 0, x2: 2, y2: 2 });
  assert.deepEqual(z.elemente.map((e) => e.typ), ["bild", "pfeil", "text", "strich", "linie"]);
});

test("sagen und fertig veraendern die Tafel nicht", () => {
  const z = ereignisAnwenden(LEERE_ZEICHNUNG, { typ: "bild", symbol: "baum", x: 1, y: 2, groesse: 100 });
  assert.equal(ereignisAnwenden(z, { typ: "sagen", text: "Hallo" }), z);
  assert.equal(ereignisAnwenden(z, { typ: "fertig" }), z);
});

test("Ausgangstafel bleibt unveraendert", () => {
  ereignisAnwenden(LEERE_ZEICHNUNG, { typ: "bild", symbol: "baum", x: 1, y: 2, groesse: 100 });
  assert.deepEqual(LEERE_ZEICHNUNG, { elemente: [] });
});

test("Beispielszene: Titel plus neun Elemente", () => {
  const z = BEISPIEL_EREIGNISSE.reduce(ereignisAnwenden, LEERE_ZEICHNUNG);
  assert.equal(z.titel, "Fotosynthese");
  assert.equal(z.elemente.length, 9);
});
