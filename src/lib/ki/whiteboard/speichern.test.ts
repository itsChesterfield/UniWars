import { test } from "node:test";
import assert from "node:assert/strict";
import { zeichnungZuElementen } from "./speichern.ts";
import { ereignisAnwenden, LEERE_ZEICHNUNG } from "./zeichnung.ts";
import { BEISPIEL_EREIGNISSE } from "./beispiel.ts";
import { elementeLesen } from "../../whiteboard/elemente.ts";

test("Beispielszene wird zu gueltigen Whiteboard-Elementen", () => {
  const z = BEISPIEL_EREIGNISSE.reduce(ereignisAnwenden, LEERE_ZEICHNUNG);
  const elemente = zeichnungZuElementen(z);
  // Alle erzeugten Elemente ueberstehen die Pruefung der Whiteboard-Infrastruktur.
  const gelesen = elementeLesen({ elemente });
  assert.equal(gelesen.length, elemente.length, "Elemente wurden beim Speichern verworfen");
  assert.ok(elemente.length > 0);
});

test("Titel wird zu einem Text-Element", () => {
  const z = ereignisAnwenden(LEERE_ZEICHNUNG, { typ: "titel", text: "Thema" });
  const elemente = zeichnungZuElementen(z);
  assert.equal(elemente.length, 1);
  assert.equal(elemente[0].typ, "text");
});

test("Pfeil mit Label wird zu Linie plus Text", () => {
  const z = ereignisAnwenden(LEERE_ZEICHNUNG, { typ: "pfeil", x1: 0, y1: 0, x2: 100, y2: 0, label: "Licht" });
  const elemente = zeichnungZuElementen(z);
  const typen = elemente.map((e) => e.typ);
  assert.deepEqual(typen, ["linie", "text"]);
  assert.equal(elemente[0].typ === "linie" && elemente[0].pfeil, true);
});

test("Ein Sinnbild wird zu mehreren Stift-Strichen", () => {
  const z = ereignisAnwenden(LEERE_ZEICHNUNG, { typ: "bild", symbol: "haus", x: 200, y: 200, groesse: 120 });
  const elemente = zeichnungZuElementen(z);
  assert.ok(elemente.length >= 2, "Haus hat mehrere Striche");
  assert.ok(elemente.every((e) => e.typ === "stift"));
});

test("unbekanntes Sinnbild wird zu Kreis plus Name", () => {
  const z = ereignisAnwenden(LEERE_ZEICHNUNG, { typ: "bild", symbol: "gibtsnicht", x: 100, y: 100, groesse: 80 });
  const elemente = zeichnungZuElementen(z);
  assert.ok(elemente.some((e) => e.typ === "stift"));
  assert.ok(elemente.some((e) => e.typ === "text"));
});
