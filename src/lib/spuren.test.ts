import { test } from "node:test";
import assert from "node:assert/strict";
import { spurenVerteilen } from "./spuren.ts";

test("Spuren: Überschneidungen teilen sich die Breite, getrennte Termine nicht", () => {
  const a = { start: 735, ende: 930 }; // 12:15–15:30
  const b = { start: 735, ende: 825 }; // 12:15–13:45
  const c = { start: 840, ende: 930 }; // 14:00–15:30
  const d = { start: 585, ende: 675 }; // 09:45–11:15
  const s = spurenVerteilen([c, a, d, b]);
  assert.deepEqual(s.get(d), { spur: 0, spuren: 1 });
  assert.deepEqual(s.get(a), { spur: 0, spuren: 2 });
  assert.deepEqual(s.get(b), { spur: 1, spuren: 2 });
  assert.deepEqual(s.get(c), { spur: 1, spuren: 2 });
});

test("Spuren: direkt aufeinanderfolgende Termine überlappen nicht", () => {
  const a = { start: 0, ende: 90 };
  const b = { start: 90, ende: 180 };
  const s = spurenVerteilen([a, b]);
  assert.deepEqual([s.get(a), s.get(b)], [{ spur: 0, spuren: 1 }, { spur: 0, spuren: 1 }]);
});
