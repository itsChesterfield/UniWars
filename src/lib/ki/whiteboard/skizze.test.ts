import { test } from "node:test";
import assert from "node:assert/strict";
import { seedAus, stiftZufall, kastenStrich, ellipseStrich, knotenStrich, linieStrich, pfeilStrich } from "./skizze.ts";

test("seedAus ist deterministisch und nicht negativ", () => {
  assert.equal(seedAus("reiz"), seedAus("reiz"));
  assert.notEqual(seedAus("reiz"), seedAus("rezeptor"));
  assert.ok(seedAus("x") >= 0);
});

test("stiftZufall ist deterministisch und liegt in -1..1", () => {
  const a = stiftZufall("k:a");
  const b = stiftZufall("k:a");
  for (let i = 0; i < 20; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= -1 && v <= 1);
  }
});

test("kastenStrich: gerade Anzahl Werte, in der Naehe der Box", () => {
  const p = kastenStrich(120, 56, stiftZufall("k:a"));
  assert.equal(p.length % 2, 0);
  assert.ok(p.length >= 8);
  for (let i = 0; i + 1 < p.length; i += 2) {
    assert.ok(p[i] >= -6 && p[i] <= 120 + 14, `x im Rahmen: ${p[i]}`);
    assert.ok(p[i + 1] >= -6 && p[i + 1] <= 56 + 6, `y im Rahmen: ${p[i + 1]}`);
  }
});

test("ellipseStrich: gerade Anzahl Werte, mehr als eine Umdrehung", () => {
  const p = ellipseStrich(120, 56, stiftZufall("k:b"));
  assert.equal(p.length % 2, 0);
  assert.ok(p.length >= 2 * 28);
});

test("knotenStrich waehlt Form", () => {
  assert.deepEqual(knotenStrich("kasten", 120, 56, stiftZufall("s")), kastenStrich(120, 56, stiftZufall("s")));
  assert.deepEqual(knotenStrich("ellipse", 120, 56, stiftZufall("s")), ellipseStrich(120, 56, stiftZufall("s")));
});

test("linieStrich startet und endet nahe den Vorgaben", () => {
  const p = linieStrich(0, 0, 100, 0, stiftZufall("e:a->b"));
  assert.ok(Math.hypot(p[0] - 0, p[1] - 0) < 4);
  assert.ok(Math.hypot(p[p.length - 2] - 100, p[p.length - 1] - 0) < 4);
});

test("pfeilStrich hat drei Punkte, Mitte ist die Spitze", () => {
  const p = pfeilStrich(0, 0, 100, 0);
  assert.equal(p.length, 6);
  assert.equal(p[2], 100);
  assert.equal(p[3], 0);
});
