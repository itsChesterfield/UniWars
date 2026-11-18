import { test } from "node:test";
import assert from "node:assert/strict";
import { festeFolge } from "./folge.ts";

test("festeFolge: hält die Reihenfolge, neue an ihren Platz, entfernte weg", () => {
  assert.deepEqual(festeFolge(null, ["b", "a"]), ["b", "a"]);
  // a wurde erledigt und sortiert nach hinten, bleibt aber vorn, solange festgehalten
  assert.deepEqual(festeFolge(["a", "b", "c"], ["b", "c", "a"]), ["a", "b", "c"]);
  assert.deepEqual(festeFolge(["a", "b", "c"], ["b", "x", "c"]), ["b", "x", "c"]);
  assert.deepEqual(festeFolge(["a", "b"], ["n", "a", "b"]), ["n", "a", "b"]);
});
