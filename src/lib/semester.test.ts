import { test } from "node:test";
import assert from "node:assert/strict";
import { naechstesSemester, semesterName, semesterStand, semesterZu, standardTermine } from "./semester.ts";

test("Semester: welches Semester läuft (Uni, FH, Schweiz)", () => {
  assert.equal(semesterZu("2026-11-17", "uni", "DE"), "2026W");
  assert.equal(semesterZu("2027-02-10", "uni", "DE"), "2026W");
  assert.equal(semesterZu("2027-05-01", "uni", "DE"), "2027S");
  assert.equal(semesterZu("2026-09-15", "fh", "DE"), "2026W");
  assert.equal(semesterZu("2026-09-15", "uni", "DE"), "2026S");
  assert.equal(semesterZu("2027-03-10", "fh", "DE"), "2027S");
  assert.equal(semesterZu("2026-09-01", "uni", "CH"), "2026W");
  assert.equal(naechstesSemester("2026W"), "2027S");
  assert.equal(semesterName("2026W", "DE", true), "WiSe 2026/27");
  assert.equal(semesterName("2027S", "CH"), "Frühjahrssemester 2027");
});

test("Semester: Standardtermine liegen auf Montag/Freitag und passen zur Hochschulart", () => {
  const uni = standardTermine("2026W", "uni", "DE");
  const fh = standardTermine("2026W", "fh", "DE");
  assert.equal(new Date(`${uni.vorlesung_beginn}T00:00:00Z`).getUTCDay(), 1);
  assert.equal(new Date(`${uni.vorlesung_ende}T00:00:00Z`).getUTCDay(), 5);
  assert.ok(uni.vorlesung_beginn.startsWith("2026-10"));
  assert.ok(uni.vorlesung_ende.startsWith("2027-02"));
  assert.ok(fh.vorlesung_beginn.startsWith("2026-09"));
  assert.ok(fh.vorlesung_ende.startsWith("2027-01"));
  assert.ok(uni.pruefung_beginn! > uni.vorlesung_ende);
});

test("Semester: Vorlesungswoche und Phase", () => {
  const t = { semester: "2026W", vorlesung_beginn: "2026-10-12", vorlesung_ende: "2027-02-05", pruefung_beginn: "2027-02-08", pruefung_ende: "2027-02-26", rueckmeldung_bis: null };
  assert.deepEqual(semesterStand(t, "2026-10-12").woche, 1);
  assert.deepEqual(semesterStand(t, "2026-11-17").woche, 6);
  assert.equal(semesterStand(t, "2026-10-01").phase, "vor_beginn");
  assert.equal(semesterStand(t, "2027-02-10").phase, "pruefungen");
  assert.equal(semesterStand(t, "2027-03-10").phase, "vorlesungsfrei");
  assert.equal(semesterStand(t, "2027-01-01").tageBisPruefungen, 38);
});
