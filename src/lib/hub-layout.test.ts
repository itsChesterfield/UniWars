import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GROESSEN,
  VOREINSTELLUNGEN,
  groesseSetzen,
  hubLayoutLesen,
  rasterPlan,
  sichtbarSetzen,
  sichtbare,
  standardLayout,
  umsetzen,
  verschieben,
  voreinstellungVon,
  type HubLayout,
} from "./hub-layout.ts";

test("Hub-Layout: Voreinstellungen enthalten jeden Baustein einmal und nur erlaubte Größen", () => {
  for (const layout of Object.values(VOREINSTELLUNGEN)) {
    assert.equal(new Set(layout.map(([id]) => id)).size, Object.keys(GROESSEN).length);
    for (const [id, , groesse] of layout) assert.ok(GROESSEN[id].includes(groesse), `${id} ${groesse}`);
  }
});

test("Hub-Layout lesen: leer, kaputt oder fremd ergibt „Ausgewogen“", () => {
  for (const roh of [null, undefined, "x", {}, [], [["gibtsnicht", true, "L"]], [[1, 2, 3]]]) {
    assert.deepEqual(hubLayoutLesen(roh), standardLayout());
  }
  assert.equal(voreinstellungVon(hubLayoutLesen(null)), "ausgewogen");
});

test("Hub-Layout lesen: Größe korrigieren, Doppeltes verwerfen, Fehlendes ausgeblendet anhängen", () => {
  const l = hubLayoutLesen([
    ["heute", 1, "S"],
    ["heute", true, "L"],
    ["vorschlag", false, "M"],
    ["quatsch", true, "L"],
  ]);
  assert.deepEqual(l.slice(0, 2), [
    ["heute", true, "M"],
    ["vorschlag", false, "M"],
  ]);
  assert.equal(l.length, 7);
  assert.deepEqual(sichtbare(l), ["heute"]);
});

test("Raster: „Ausgewogen“ ergibt fünf Zeilen ohne freien Platz", () => {
  const plan = rasterPlan(VOREINSTELLUNGEN.ausgewogen);
  assert.deepEqual(
    plan.map((p) => [p.id, p.zeile, p.spalte, p.frei]),
    [
      ["vorschlag", 0, 0, 0],
      ["naechstes", 1, 0, 0],
      ["fakten", 2, 0, 0],
      ["heute", 3, 0, 0],
      ["woche", 4, 0, 0],
    ],
  );
});

test("Raster: bleibt in der Zeile Platz, meldet der Baustein davor ihn als frei", () => {
  const layout: HubLayout = [
    ["vorschlag", true, "S"],
    ["heute", true, "L"],
    ["wiederholen", true, "S"],
    ["fakten", true, "M"],
    ["naechstes", true, "M"],
    ["woche", false, "L"],
  ];
  assert.deepEqual(
    rasterPlan(layout).map((p) => [p.id, p.zeile, p.spalte, p.frei]),
    [
      ["vorschlag", 0, 0, 2],
      ["heute", 1, 0, 0],
      ["wiederholen", 2, 0, 0],
      ["fakten", 2, 1, 0],
      ["naechstes", 3, 0, 1],
    ],
  );
});

test("Verschieben überspringt ausgeblendete Bausteine und hört am Rand auf", () => {
  const l = VOREINSTELLUNGEN.ruhig;
  assert.equal(verschieben(l, "vorschlag", -1), null);
  assert.equal(verschieben(l, "heute", 1), null);
  assert.equal(verschieben(l, "fakten", 1), null);
  assert.deepEqual(sichtbare(verschieben(l, "naechstes", 1)!), ["vorschlag", "heute", "naechstes"]);
  assert.deepEqual(sichtbare(l), ["vorschlag", "naechstes", "heute"]);
});

test("Umsetzen, Größe und Sichtbarkeit ändern das Original nicht", () => {
  const l = standardLayout();
  assert.deepEqual(sichtbare(umsetzen(l, "woche", "naechstes")), ["vorschlag", "woche", "naechstes", "fakten", "heute"]);
  assert.deepEqual(sichtbare(umsetzen(l, "naechstes", "heute")), ["vorschlag", "fakten", "heute", "naechstes", "woche"]);
  assert.equal(groesseSetzen(l, "heute", "S"), l);
  assert.equal(groesseSetzen(l, "heute", "L").find(([id]) => id === "heute")![2], "L");
  assert.deepEqual(sichtbare(sichtbarSetzen(l, "wiederholen", true)).at(-1), "wiederholen");
  assert.deepEqual(l, standardLayout());
});
