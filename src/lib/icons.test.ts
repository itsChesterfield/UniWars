import { test } from "node:test";
import assert from "node:assert/strict";
import { ICONS, istIconName, symbolTeile } from "./icons.ts";

test("Icons: jedes Symbol lässt sich lesen und bleibt im 24er-Raster", () => {
  for (const [name, kurz] of Object.entries(ICONS)) {
    const teile = symbolTeile(kurz);
    assert.ok(teile.length > 0, name);
    for (const t of teile) {
      if (t.art === "pfad") {
        assert.match(t.d, /^[Mm]/, `${name}: Pfad beginnt mit M`);
        assert.doesNotMatch(t.d, /NaN|undefined/, name);
        for (const zahl of t.d.match(/-?\d*\.?\d+/g) ?? []) assert.ok(Math.abs(Number(zahl)) <= 24, `${name}: ${zahl}`);
      } else {
        const werte = t.art === "rect" ? [t.x, t.y, t.b, t.h, t.r] : [t.x, t.y, t.r];
        for (const w of werte) assert.ok(Number.isFinite(w) && w >= 0 && w <= 24, `${name}: ${w}`);
      }
    }
  }
});

test("Icons: Namen statt Zeichen, keine Emojis im Satz", () => {
  assert.ok(istIconName("loeschen"));
  assert.ok(!istIconName("🗑"));
  assert.ok(!istIconName("toString"));
  for (const kurz of Object.values(ICONS)) assert.doesNotMatch(kurz, /\p{Extended_Pictographic}/u);
});
