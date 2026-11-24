import { test } from "node:test";
import assert from "node:assert/strict";
import { SYMBOLE, SYMBOL_NAMEN, sinnbildStriche } from "./symbole.ts";
import { stiftZufall } from "./skizze.ts";

test("Katalog hat mindestens 20 Sinnbilder", () => {
  assert.ok(SYMBOL_NAMEN.length >= 20, `nur ${SYMBOL_NAMEN.length}`);
});

test("jedes Sinnbild liefert Striche mit gerader Punktzahl", () => {
  for (const name of SYMBOL_NAMEN) {
    const striche = SYMBOLE[name](stiftZufall(`t:${name}`));
    assert.ok(Array.isArray(striche) && striche.length > 0, `${name} leer`);
    for (const s of striche) {
      assert.ok(s.length >= 4 && s.length % 2 === 0, `${name}: Strich mit ${s.length} Werten`);
      assert.ok(s.every((v) => Number.isFinite(v)), `${name}: unendlicher Wert`);
    }
  }
});

test("sinnbildStriche ist deterministisch bei gleichem Seed", () => {
  assert.deepEqual(sinnbildStriche("baum", stiftZufall("x")), sinnbildStriche("baum", stiftZufall("x")));
});

test("unbekanntes Sinnbild gibt null", () => {
  assert.equal(sinnbildStriche("gibtsnicht", stiftZufall("x")), null);
});

test("bekannte Namen sind erreichbar", () => {
  for (const name of ["mensch", "baum", "herz", "sonne", "pfeil-hoch"]) {
    assert.ok(sinnbildStriche(name, stiftZufall("x")), `${name} fehlt`);
  }
});
