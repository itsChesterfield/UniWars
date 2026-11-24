import { test } from "node:test";
import assert from "node:assert/strict";
import { ereignisAnwenden, LEERE_ZEICHNUNG, type Zeichnung } from "./zeichnung.ts";

test("knoten wird hinzugefuegt", () => {
  const z = ereignisAnwenden(LEERE_ZEICHNUNG, { typ: "knoten", id: "a", label: "A", form: "kasten" });
  assert.deepEqual(z.knoten, [{ id: "a", label: "A", form: "kasten" }]);
});

test("knoten mit gleicher id wird aktualisiert, nicht doppelt", () => {
  let z = ereignisAnwenden(LEERE_ZEICHNUNG, { typ: "knoten", id: "a", label: "A", form: "kasten" });
  z = ereignisAnwenden(z, { typ: "knoten", id: "a", label: "A neu", form: "ellipse" });
  assert.equal(z.knoten.length, 1);
  assert.deepEqual(z.knoten[0], { id: "a", label: "A neu", form: "ellipse" });
});

test("kante wird hinzugefuegt, mit und ohne Label", () => {
  let z = ereignisAnwenden(LEERE_ZEICHNUNG, { typ: "kante", von: "a", nach: "b" });
  assert.deepEqual(z.kanten, [{ von: "a", nach: "b" }]);
  z = ereignisAnwenden(z, { typ: "kante", von: "b", nach: "c", label: "leitet" });
  assert.deepEqual(z.kanten[1], { von: "b", nach: "c", label: "leitet" });
});

test("gleiche Kante wird nicht doppelt", () => {
  let z = ereignisAnwenden(LEERE_ZEICHNUNG, { typ: "kante", von: "a", nach: "b" });
  z = ereignisAnwenden(z, { typ: "kante", von: "a", nach: "b", label: "neu" });
  assert.equal(z.kanten.length, 1);
  assert.deepEqual(z.kanten[0], { von: "a", nach: "b", label: "neu" });
});

test("titel wird gesetzt", () => {
  const z = ereignisAnwenden(LEERE_ZEICHNUNG, { typ: "titel", text: "Thema" });
  assert.equal(z.titel, "Thema");
});

test("sagen und fertig veraendern die Zeichnung nicht", () => {
  const start: Zeichnung = { titel: "T", knoten: [{ id: "a", label: "A", form: "kasten" }], kanten: [] };
  assert.equal(ereignisAnwenden(start, { typ: "sagen", text: "Hallo" }), start);
  assert.equal(ereignisAnwenden(start, { typ: "fertig" }), start);
});

test("Ausgangszeichnung bleibt unveraendert (unveraenderlich)", () => {
  ereignisAnwenden(LEERE_ZEICHNUNG, { typ: "knoten", id: "a", label: "A", form: "kasten" });
  assert.deepEqual(LEERE_ZEICHNUNG, { knoten: [], kanten: [] });
});
