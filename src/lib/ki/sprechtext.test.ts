import { test } from "node:test";
import assert from "node:assert/strict";
import { sprechStuecke, sprechtext } from "./sprechtext.ts";

test("Sprechtext: Markdown raus, Aufzählungen als Sätze", () => {
  const md = "## Diese Woche\n\n- **Hausarbeit** abgeben\n- Klausur *Mathe 1*\n\nMehr unter [Link](https://x.y).";
  assert.equal(sprechtext(md), "Diese Woche.\n\nHausarbeit abgeben. Klausur Mathe 1.\n\nMehr unter Link.");
});

test("Sprechtext: Code-Blöcke, Inline-Code, Tabellen, Checklisten", () => {
  const md = "So geht es:\n```python\nprint('hi')\n```\nNutze `len()`.\n\n| Fach | Note |\n|---|---|\n| Mathe | 1,7 |\n\n- [ ] Kapitel 3 lesen";
  const t = sprechtext(md);
  assert.match(t, /\(Codebeispiel, siehe Bildschirm\)/);
  assert.doesNotMatch(t, /print/);
  assert.match(t, /Nutze len\(\)\./);
  assert.match(t, /Fach, Note\. Mathe, 1,7\./);
  assert.match(t, /Kapitel 3 lesen\./);
  assert.doesNotMatch(t, /[*#`|[\]]/);
});

test("Sprechtext: einfache Formeln aussprechbar", () => {
  assert.equal(sprechtext("Die Ableitung von $x^2$ ist 2x."), "Die Ableitung von x Quadrat ist 2x.");
  assert.equal(sprechtext("\\frac{a}{b} ≈ 50 %"), "a geteilt durch b ungefähr 50 Prozent.");
  assert.equal(sprechtext("e^{-x}"), "e hoch -x.");
});

test("Sprechtext: Stücke – erstes kurz, Abkürzungen bleiben zusammen, nichts geht verloren", () => {
  const text = "Das ist z. B. ein kurzer Satz. " + "Hier kommt ein längerer Satz mit vielen Wörtern, die zusammen eine Weile dauern. ".repeat(12);
  const s = sprechStuecke(text);
  assert.ok(s[0].length <= 180, `erstes Stück ${s[0].length}`);
  assert.ok(s.slice(1).every((x) => x.length <= 500));
  assert.ok(s[0].startsWith("Das ist z. B. ein kurzer Satz."));
  assert.equal(s.join(" ").replace(/\s+/g, " "), text.trim().replace(/\s+/g, " "));
  const lang = sprechStuecke("wort ".repeat(200));
  assert.ok(lang.every((x) => x.length <= 500) && lang[0].length <= 180);
  assert.deepEqual(sprechStuecke(""), []);
});
