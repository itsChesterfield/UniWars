import { test } from "node:test";
import assert from "node:assert/strict";
import { KALENDER_NAME, titelDeadline, titelPruefung, titelStunde, titelTodo } from "./titel.ts";

test("Kalendertitel: Klartext ohne Emojis, erledigt mit Haken", () => {
  assert.equal(titelPruefung("Klausur Diagnostik", false), "Prüfung: Klausur Diagnostik");
  assert.equal(titelPruefung("Klausur Diagnostik", true), "✓ Prüfung: Klausur Diagnostik");
  assert.equal(titelDeadline("Hausarbeit", "ABGABE", false), "Abgabe: Hausarbeit");
  assert.equal(titelDeadline("Semesterbeitrag", "FRIST", false), "Abgabe: Semesterbeitrag");
  assert.equal(titelDeadline("Sprechstunde", "TERMIN", false), "Sprechstunde");
  assert.equal(titelDeadline("Treffen", "GRUPPENARBEIT", true), "✓ Gruppenarbeit: Treffen");
  assert.equal(titelTodo("Kapitel 3 lesen", false), "To-Do: Kapitel 3 lesen");
  assert.equal(titelStunde("Klinische Psychologie"), "Klinische Psychologie");
  assert.equal(titelStunde(undefined), "Vorlesung");
  assert.equal(KALENDER_NAME, "UniVerse");
  // keine Emojis mehr
  for (const t of [titelPruefung("a", false), titelDeadline("a", "TERMIN", false), titelTodo("a", false)]) assert.doesNotMatch(t, /\p{Extended_Pictographic}/u);
});
