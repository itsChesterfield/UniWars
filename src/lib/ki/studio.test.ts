import { test } from "node:test";
import assert from "node:assert/strict";
import { bereichPfad, studioDatenLesen } from "./studio.ts";

test("studioDatenLesen: kaputte Daten ergeben leere Listen", () => {
  const d = studioDatenLesen(null);
  assert.deepEqual(d.erledigt, []);
  assert.deepEqual(d.bloecke, []);
  const e = studioDatenLesen({ erledigt: "quatsch", bloecke: [{ typ: "unbekannt" }] });
  assert.deepEqual(e.erledigt, []);
});

test("bereichPfad: bekannte Bereiche, unbekannt = null", () => {
  assert.ok(bereichPfad("Notizen")?.startsWith("/"));
  assert.equal(bereichPfad("gibtsnicht"), null);
});
