import { test } from "node:test";
import assert from "node:assert/strict";
import { flugBilder, nachbar, pfeilFuerNotch } from "./notch.ts";
import { steigDauer, zerlegen } from "./steigen.ts";

const frei = { tag: "BODY", rolle: null, bearbeitbar: false, inDialog: false, inSegment: false };

test("nachbar läuft ringsum", () => {
  assert.equal(nachbar(0, 1, 6), 1);
  assert.equal(nachbar(5, 1, 6), 0);
  assert.equal(nachbar(0, -1, 6), 5);
});

test("Pfeile nur, wo sie sonst nichts tun", () => {
  assert.equal(pfeilFuerNotch(frei), true);
  assert.equal(pfeilFuerNotch({ ...frei, tag: "A" }), true);
  assert.equal(pfeilFuerNotch({ ...frei, tag: "INPUT" }), false);
  assert.equal(pfeilFuerNotch({ ...frei, bearbeitbar: true }), false);
  assert.equal(pfeilFuerNotch({ ...frei, inDialog: true }), false);
  assert.equal(pfeilFuerNotch({ ...frei, inSegment: true }), false);
  assert.equal(pfeilFuerNotch({ ...frei, tag: "DIV", rolle: "slider" }), false);
});

test("Flug: Mitte überspannt Start und Ziel, Ende sitzt auf dem Ziel", () => {
  const b = flugBilder({ x: 0, breite: 100 }, { x: 300, breite: 80 });
  assert.equal(b[0].transform, "translateX(0px) scaleX(1.25)");
  assert.equal(b[1].transform, "translateX(0px) scaleX(4.75)");
  assert.equal(b[2].transform, "translateX(300px) scaleX(1)");
  const zurueck = flugBilder({ x: 300, breite: 80 }, { x: 0, breite: 100 });
  assert.equal(zurueck[0].transform, "translateX(300px) scaleX(0.8)");
  assert.equal(zurueck[1].transform, "translateX(0px) scaleX(3.8)");
});

test("zerlegen: Wörter, Buchstaben, feste Versätze", () => {
  const w = zerlegen("Heute zählt", 100, 10);
  assert.deepEqual(w.map((x) => x.text), ["Heute", "zählt"]);
  assert.equal(w[1].buchstaben.length, 5);
  assert.deepEqual(zerlegen("Heute zählt", 100, 10), w);
  assert.ok(w.flatMap((x) => x.buchstaben).every((b) => b.verzoegerung >= 0 && b.hoehe >= 110));
  assert.ok(steigDauer(w) > 620);
  assert.equal(steigDauer([]), 0);
});
