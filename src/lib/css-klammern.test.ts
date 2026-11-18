import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Wächter für globals.css: Jede geöffnete Klammer muss geschlossen sein.
 * Nach einem Merge-Konflikt fehlte einmal eine „}“ – alles danach galt nur noch auf schmalen Bildschirmen
 * und der Build brach ab. Kommentare und Zeichenketten werden übersprungen.
 */
function klammernPruefen(css: string): { tiefe: number; zeile: number } {
  let tiefe = 0;
  let zeile = 1;
  let tiefsteZeile = 0;
  for (let i = 0; i < css.length; i++) {
    const z = css[i];
    if (z === "\n") zeile++;
    if (z === "/" && css[i + 1] === "*") {
      const ende = css.indexOf("*/", i + 2);
      if (ende < 0) break;
      zeile += css.slice(i, ende).split("\n").length - 1;
      i = ende + 1;
      continue;
    }
    if (z === '"' || z === "'") {
      const ende = css.indexOf(z, i + 1);
      if (ende < 0) break;
      i = ende;
      continue;
    }
    if (z === "{") tiefe++;
    if (z === "}") {
      tiefe--;
      if (tiefe < 0) return { tiefe, zeile };
    }
    if (tiefe === 0) tiefsteZeile = zeile;
  }
  return { tiefe, zeile: tiefsteZeile };
}

test("globals.css: alle Klammern sind geschlossen", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const { tiefe, zeile } = klammernPruefen(css);
  assert.equal(tiefe, 0, tiefe > 0 ? `${tiefe} Klammer(n) nicht geschlossen – zuletzt ausgeglichen in Zeile ${zeile}` : `Überzählige „}“ in Zeile ${zeile}`);
});

test("Klammerprüfung erkennt Fehler", () => {
  assert.equal(klammernPruefen("@media (x) { .a { b: c; }").tiefe, 1);
  assert.equal(klammernPruefen(".a { content: \"}\"; } /* { */").tiefe, 0);
  assert.equal(klammernPruefen(".a { } }").tiefe, -1);
});
