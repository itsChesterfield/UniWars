import { test } from "node:test";
import assert from "node:assert/strict";
import { klausurCluster, phaseAktiv, standFuer, tagesplan, vorschlagZeigen, zustandLesen, VORLAUF_TAGE } from "./klausurphase.ts";

const jetzt = new Date("2026-11-20T10:00:00Z");
const p = (id: string, datum: string, fach = "f1", status = "ANSTEHEND") => ({ id, titel: `Klausur ${id}`, datum, fach_id: fach, status, raum: null });

test("Klausurphase: Klausuren der Phase sind die bis vier Wochen nach der ersten", () => {
  const c = klausurCluster([p("b", "2026-12-18T09:00:00Z", "f2"), p("a", "2026-12-04T09:00:00Z"), p("spaet", "2027-02-10T08:00:00Z"), p("alt", "2026-11-01T09:00:00Z"), p("fertig", "2026-12-05T09:00:00Z", "f1", "BESTANDEN")], jetzt);
  assert.ok(c);
  assert.deepEqual(c.klausuren.map((k) => k.id), ["a", "b"]);
  assert.equal(c.erste.id, "a");
  assert.equal(c.bis, "2026-12-18");
  assert.equal(c.tageBisErste, 14);
  assert.equal(klausurCluster([p("alt", "2026-11-01T09:00:00Z")], jetzt), null);
});

test("Klausurphase: Vorschlag ab drei Wochen vorher, nicht nach „Nicht jetzt“, nicht in laufender Phase", () => {
  const nah = klausurCluster([p("a", "2026-12-04T09:00:00Z")], jetzt);
  const fern = klausurCluster([p("a", "2026-12-15T09:00:00Z")], jetzt);
  assert.equal(VORLAUF_TAGE, 21);
  assert.equal(vorschlagZeigen(nah, null, jetzt), true);
  assert.equal(vorschlagZeigen(fern, null, jetzt), false);
  assert.equal(vorschlagZeigen(nah, { abgelehnt: "a" }, jetzt), false);
  // Neue erste Klausur: wieder fragen
  assert.equal(vorschlagZeigen(nah, { abgelehnt: "x" }, jetzt), true);
  assert.equal(vorschlagZeigen(nah, { bis: "2026-12-04" }, jetzt), false);
  assert.equal(vorschlagZeigen(null, null, jetzt), false);
});

test("Klausurphase: läuft bis einschließlich zum Tag der letzten Klausur", () => {
  assert.equal(phaseAktiv({ bis: "2026-11-20" }, jetzt), true);
  assert.equal(phaseAktiv({ bis: "2026-11-19" }, jetzt), false);
  assert.equal(phaseAktiv({ abgelehnt: "a" }, jetzt), false);
  assert.equal(phaseAktiv(null, jetzt), false);
});

test("Klausurphase: gespeicherten Zustand nur in gültiger Form übernehmen", () => {
  assert.deepEqual(zustandLesen({ bis: "2026-12-18" }), { bis: "2026-12-18" });
  assert.deepEqual(zustandLesen({ abgelehnt: "a" }), { abgelehnt: "a" });
  assert.equal(zustandLesen({ bis: "morgen" }), null);
  assert.equal(zustandLesen({ abgelehnt: "x".repeat(100) }), null);
  assert.equal(zustandLesen("an"), null);
  assert.equal(zustandLesen(undefined), null);
});

const themen = [
  { fach_id: "f1", thema: "Agoraphobie", beherrschung: 0.38, fehlerbild: "verwechselt mit Panikstörung" },
  { fach_id: "f1", thema: "Panikstörung", beherrschung: 0.6, fehlerbild: null },
  { fach_id: "f1", thema: "Exposition", beherrschung: 0.85, fehlerbild: null },
];
const stapel = [
  { id: "k2", name: "Methodenlehre Definitionen", anzahl: 12, fachId: "f2" },
  { id: "k9", name: "Klein", anzahl: 2, fachId: "f2" },
];

test("Klausurphase: Stand aus Wissensstand, sonst aus fälligen Karten, sonst noch nicht angefangen", () => {
  const s1 = standFuer("f1", themen, stapel);
  assert.equal(s1.text, "1 von 3 Themen sicher");
  assert.equal(s1.schwach?.thema, "Agoraphobie");
  assert.equal(s1.anteil, 1 / 3);
  const s2 = standFuer("f2", themen, stapel);
  assert.equal(s2.text, "14 Karteikarten fällig");
  assert.equal(s2.schwach, null);
  assert.equal(s2.anteil, null);
  assert.equal(standFuer("f3", themen, stapel).text, "noch nicht angefangen");
  assert.equal(standFuer("f3", themen, stapel).anteil, null);
});

test("Klausurphase: Tagesplan, zuerst die schwächsten Themen der nächsten Klausur, dann fällige Karten", () => {
  const c = klausurCluster([p("a", "2026-12-04T09:00:00Z", "f1"), p("b", "2026-12-18T09:00:00Z", "f2")], jetzt);
  assert.ok(c);
  const plan = tagesplan(c, themen, stapel, (id) => (id === "f1" ? "Klinische Psychologie" : "Methodenlehre"));
  assert.deepEqual(plan.map((x) => x.titel), ["Agoraphobie wiederholen", "14 Karteikarten"]);
  assert.equal(plan[0].unter, "Klinische Psychologie, verwechselt mit Panikstörung, etwa 25 Minuten");
  assert.equal(plan[1].href, "/karteikarten/k2/lernen");
  assert.equal(plan[1].unter, "Methodenlehre, fällig heute, etwa 7 Minuten");
  assert.equal(tagesplan(c, [], [], () => null).length, 0);
});
