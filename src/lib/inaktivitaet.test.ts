import { test } from "node:test";
import assert from "node:assert/strict";
import { aktivHalten, inaktivStand, INAKTIV_MS, wirdAktivGehalten } from "./inaktivitaet.ts";

test("inaktivStand: aktiv → Warnung 30 s vorher → abmelden nach 5 Min.", () => {
  const t = 1_000_000;
  assert.equal(inaktivStand(t, t + 60_000, false), "aktiv");
  assert.equal(inaktivStand(t, t + INAKTIV_MS - 10_000, false), "warnung");
  assert.equal(inaktivStand(t, t + INAKTIV_MS, false), "abmelden");
  assert.equal(inaktivStand(t, t + INAKTIV_MS * 3, true), "aktiv");
});

test("aktivHalten zählt Gründe", () => {
  aktivHalten("aufnahme", true);
  aktivHalten("podcast", true);
  aktivHalten("aufnahme", false);
  assert.equal(wirdAktivGehalten(), true);
  aktivHalten("podcast", false);
  assert.equal(wirdAktivGehalten(), false);
});
