import { test } from "node:test";
import assert from "node:assert/strict";
import { rollZeichen, staffel } from "./rollen.ts";

test("staffel deckelt bei sechs", () => {
  assert.equal(staffel(0), 0);
  assert.equal(staffel(2), 60);
  assert.equal(staffel(10), 150);
});

test("rollZeichen: ohne Wechsel ein ruhiges Stück", () => {
  assert.deepEqual(rollZeichen(null, "3 / 8"), [{ neu: "3 / 8", alt: null, verzoegerung: 0 }]);
  assert.deepEqual(rollZeichen("3 / 8", "3 / 8"), [{ neu: "3 / 8", alt: null, verzoegerung: 0 }]);
});

test("rollZeichen: gleiche Länge rollt nur geänderte Zeichen, versetzt", () => {
  const r = rollZeichen("19", "20");
  assert.deepEqual(r, [
    { neu: "2", alt: "1", verzoegerung: 0 },
    { neu: "0", alt: "9", verzoegerung: 30 },
  ]);
  assert.equal(rollZeichen("3 / 8", "4 / 8").filter((z) => z.alt).length, 1);
});

test("rollZeichen: andere Länge rollt als ein Stück", () => {
  assert.deepEqual(rollZeichen("9 / 10", "10 / 10"), [{ neu: "10 / 10", alt: "9 / 10", verzoegerung: 0 }]);
});

test("festeFolge: hält die Reihenfolge, neue an ihren Platz, entfernte weg", async () => {
  const { festeFolge } = await import("./folge.ts");
  assert.deepEqual(festeFolge(null, ["b", "a"]), ["b", "a"]);
  // a wurde erledigt und sortiert nach hinten, bleibt aber vorn, solange festgehalten
  assert.deepEqual(festeFolge(["a", "b", "c"], ["b", "c", "a"]), ["a", "b", "c"]);
  assert.deepEqual(festeFolge(["a", "b", "c"], ["b", "x", "c"]), ["b", "x", "c"]);
  assert.deepEqual(festeFolge(["a", "b"], ["n", "a", "b"]), ["n", "a", "b"]);
});
