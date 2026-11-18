import { test } from "node:test";
import assert from "node:assert/strict";
import { dauerText, minutenProFach, minutenProTag, wochenbeginn } from "./fortschritt.ts";

test("Fortschritt: Wochenbeginn ist Montag 0:00, auch am Sonntag", () => {
  assert.equal(wochenbeginn(new Date(2026, 10, 18, 15)).getDate(), 16);
  assert.equal(wochenbeginn(new Date(2026, 10, 22, 23)).getDate(), 16);
  assert.equal(wochenbeginn(new Date(2026, 10, 16, 0, 30)).getHours(), 0);
});

test("Fortschritt: Minuten pro Tag nur aus dieser Woche", () => {
  const montag = new Date(2026, 10, 16);
  const tage = minutenProTag(
    [
      { start: new Date(2026, 10, 16, 9).toISOString(), dauer_minuten: 50, fach_id: "a" },
      { start: new Date(2026, 10, 18, 9).toISOString(), dauer_minuten: 95, fach_id: null },
      { start: new Date(2026, 10, 22, 22).toISOString(), dauer_minuten: 10, fach_id: "a" },
      { start: new Date(2026, 10, 14, 9).toISOString(), dauer_minuten: 30, fach_id: "a" },
    ],
    montag,
  );
  assert.deepEqual(tage, [50, 0, 95, 0, 0, 0, 10]);
});

test("Fortschritt: Minuten pro Fach und Dauer als Text", () => {
  const liste = minutenProFach([
    { start: "", dauer_minuten: 30, fach_id: null },
    { start: "", dauer_minuten: 50, fach_id: "a" },
    { start: "", dauer_minuten: 20, fach_id: "a" },
  ]);
  assert.deepEqual(liste, [
    { fachId: "a", minuten: 70 },
    { fachId: null, minuten: 30 },
  ]);
  assert.equal(dauerText(175), "2 h 55 min");
  assert.equal(dauerText(45), "45 min");
  assert.equal(dauerText(180), "3 h");
});
