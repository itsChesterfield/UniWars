import { test } from "node:test";
import assert from "node:assert/strict";
import { absolutesDatum, restzeitGross, restzeitText } from "./countdown.ts";

const jetzt = Date.parse("2026-11-20T10:00:00Z"); // Fr 11:00 in Berlin

test("Restzeit: Minuten, Stunden, Tage", () => {
  assert.deepEqual(restzeitGross("2026-11-20T10:00:30Z", jetzt), { wert: "1", einheit: "Minute", ueberfaellig: false });
  assert.deepEqual(restzeitGross("2026-11-20T22:59:00Z", jetzt), { wert: "13", einheit: "Stunden", ueberfaellig: false });
  assert.deepEqual(restzeitGross("2026-11-25T10:00:00Z", jetzt), { wert: "5", einheit: "Tage", ueberfaellig: false });
});

test("Restzeit: überfällig zeigt die Zeit seitdem, nie 0", () => {
  assert.deepEqual(restzeitGross("2026-11-20T09:40:00Z", jetzt), { wert: "20", einheit: "Minuten", ueberfaellig: true });
  assert.deepEqual(restzeitGross("2026-11-18T10:00:00Z", jetzt), { wert: "2", einheit: "Tage", ueberfaellig: true });
  assert.equal(restzeitText("2026-11-19T09:00:00Z", jetzt), "25 Stunden überfällig");
  assert.equal(restzeitText("2026-11-21T10:00:00Z", jetzt), "24 Stunden übrig");
});

test("Datum: ein Format, Berliner Zeit, Jahr nur wenn anders", () => {
  assert.equal(absolutesDatum("2026-11-20T22:59:00Z", jetzt), "20. Nov., 23:59");
  assert.equal(absolutesDatum("2026-11-25T10:00:00Z", jetzt), "25. Nov., 11:00");
  assert.equal(absolutesDatum("2026-12-15T09:00:00Z", jetzt), "15. Dez., 10:00");
  assert.equal(absolutesDatum("2027-01-15T09:00:00Z", jetzt), "15. Jan. 2027, 10:00");
});
