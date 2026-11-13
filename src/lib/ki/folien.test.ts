import { test } from "node:test";
import assert from "node:assert/strict";
import { folienParsen, folienPromptBauen, folieBereinigen, istFolienzahl } from "./folien.ts";
import { KiEingabe, KiKeineDaten } from "./fehler.ts";

const LANG = "Die Geldpolitik der EZB steuert das Preisniveau über den Leitzins. ".repeat(5);

test("KI-08: gültige Gliederung, Layoutnamen werden übersetzt", () => {
  const e = folienParsen(
    JSON.stringify({
      titel: "Geldpolitik",
      folien: [
        { layout: "titel", titel: "Geldpolitik", untertitel: "Referat" },
        { layout: "titel_text", titel: "Ziele", punkte: ["Preisstabilität", "Wachstum"] },
        { layout: "titel_bild", titel: "Zinskurve", punkte: ["wird ignoriert"] },
        { layout: "zweispaltig", titel: "EZB vs. Fed", punkte: ["EZB"], punkte_rechts: ["Fed"] },
      ],
    }),
    8,
    "x",
  );
  assert.equal(e.titel, "Geldpolitik");
  assert.deepEqual(e.folien.map((f) => f.layout), ["TITEL", "TEXT", "BILD", "ZWEISPALTIG"]);
  assert.equal(e.folien[0].untertitel, "Referat");
  assert.deepEqual(e.folien[2].punkte, [], "Bildfolie hat keine Stichpunkte");
  assert.deepEqual(e.folien[3].punkteRechts, ["Fed"]);
});

test("KI-08: erste Folie wird immer Titelfolie, Anzahl begrenzt, max. 6 Punkte", () => {
  const e = folienParsen(
    JSON.stringify({ folien: Array.from({ length: 15 }, (_, i) => ({ layout: "titel_text", titel: `F${i}`, punkte: Array.from({ length: 10 }, (_, j) => `P${j}`) })) }),
    5,
    "Notiztitel",
  );
  assert.equal(e.folien.length, 5);
  assert.equal(e.folien[0].layout, "TITEL");
  assert.equal(e.folien[0].titel, "Notiztitel");
  assert.equal(e.folien[1].punkte.length, 6);
});

test("KI-08: kaputt, leer, unbekanntes Layout", () => {
  assert.throws(() => folienParsen("{", 5, "x"), KiKeineDaten);
  assert.throws(() => folienParsen('{"folien":[{"layout":"titel_text"}]}', 5, "x"), KiKeineDaten);
  assert.equal(folieBereinigen({ layout: "spirale", titel: "X", punkte: ["a"] })?.layout, "TEXT");
  assert.equal(folieBereinigen({ layout: "TEXT", titel: "Y".repeat(500) })?.titel.length, 150);
});

test("KI-08: Prompt mit <quelle>-Marker und Regeln, nur 5/8/12", () => {
  const p = folienPromptBauen({ titel: "Geld", text: LANG }, 8);
  assert.match(p.nutzer, /<quelle>\n[\s\S]*\n<\/quelle>$/);
  assert.match(p.system, /genau 8 Folien/);
  assert.match(p.system, /erste Folie hat immer das Layout "titel"/);
  assert.throws(() => folienPromptBauen({ titel: "x", text: "zu kurz" }, 5), KiEingabe);
  assert.deepEqual([5, 8, 12, 10, "5"].map(istFolienzahl), [true, true, true, false, false]);
});
