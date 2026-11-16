import { test } from "node:test";
import assert from "node:assert/strict";
import { faelligText, minutenText, restUhr, wochenTage } from "./hub-texte.ts";

// Dienstag, 17.11.2026, 10:00 in Berlin
const jetzt = new Date("2026-11-17T09:00:00Z");

test("Fällig: heute, morgen, übermorgen, später", () => {
  assert.equal(faelligText("2026-11-17T22:59:00Z", jetzt), "heute um 23:59");
  assert.equal(faelligText("2026-11-18T22:59:00Z", jetzt), "morgen um 23:59");
  assert.equal(faelligText("2026-11-19T09:00:00Z", jetzt), "übermorgen um 10:00");
  assert.equal(faelligText("2026-12-09T09:00:00Z", jetzt), "am Mittwoch, 9. Dezember, um 10:00");
  assert.equal(faelligText("2026-12-08T23:00:00Z", jetzt), "am Mittwoch, 9. Dezember");
});

test("Fällig: überfällig", () => {
  assert.equal(faelligText("2026-11-17T07:00:00Z", jetzt), "seit 08:00 überfällig");
  assert.equal(faelligText("2026-11-16T18:00:00Z", jetzt), "seit gestern überfällig");
  assert.equal(faelligText("2026-11-13T18:00:00Z", jetzt), "seit 4 Tagen überfällig");
});

test("Restuhr und Minuten", () => {
  assert.equal(restUhr(7 * 3_600_000 + 42 * 60_000 + 10_500), "07:42:10");
  assert.equal(restUhr(-5), "00:00:00");
  assert.equal(minutenText(48), "48 min");
  assert.equal(minutenText(120), "2 h");
  assert.equal(minutenText(312), "5 h 12 min");
});

test("Wochentage: Montag bis Sonntag, auch kurz nach Mitternacht in Berlin", () => {
  assert.deepEqual(wochenTage(jetzt), ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]);
  assert.equal(wochenTage(new Date("2026-11-22T23:30:00Z"))[0], "2026-11-23");
});
