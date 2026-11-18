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

test("markeLage: unter dem gewählten Eintrag, sonst keine", async () => {
  const { markeLage, gleicheLage } = await import("./segment.ts");
  const e = (links: number, gewaehlt = false, breite = 60) => ({ links, oben: 2, breite, hoehe: 30, gewaehlt });
  assert.deepEqual(markeLage([e(2), e(62.4, true, 80.6)]), { x: 62, y: 2, breite: 81, hoehe: 30 });
  assert.equal(markeLage([e(2), e(62)]), null);
  assert.equal(markeLage([e(2, true, 0)]), null);
  assert.ok(gleicheLage(markeLage([e(2, true)]), markeLage([e(2.2, true)])));
  assert.ok(!gleicheLage(markeLage([e(2, true)]), null));
});
