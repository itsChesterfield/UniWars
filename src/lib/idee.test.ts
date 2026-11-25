import { test } from "node:test";
import assert from "node:assert/strict";
import { HUB_LABEL, IDEE_HUBS, hubAusPfad, ideeGueltig } from "./idee.ts";

test("Idee: Pfad wird auf den passenden Hub abgebildet", () => {
  assert.equal(hubAusPfad("/"), "hub");
  assert.equal(hubAusPfad("/?tab=heute"), "hub");
  assert.equal(hubAusPfad("/notizen"), "notizen");
  assert.equal(hubAusPfad("/notizen?id=7"), "notizen");
  assert.equal(hubAusPfad("/pdf-reader/123"), "pdf");
  assert.equal(hubAusPfad("/work-station/raum"), "workstation");
  assert.equal(hubAusPfad("/literaturverwaltung"), "literatur");
  assert.equal(hubAusPfad("/chat"), "chat");
});

test("Idee: Bereiche ohne Flagge liefern null", () => {
  assert.equal(hubAusPfad("/assistent"), null);
  assert.equal(hubAusPfad("/einstellungen"), null);
  assert.equal(hubAusPfad("/lernraum"), null);
});

test("Idee: jeder Hub hat ein Label", () => {
  for (const hub of IDEE_HUBS) assert.ok(HUB_LABEL[hub]?.length, hub);
  assert.equal(IDEE_HUBS.length, 14);
});

test("Idee: Titel ist Pflicht", () => {
  assert.equal(ideeGueltig("Neue Idee"), true);
  assert.equal(ideeGueltig("   "), false);
  assert.equal(ideeGueltig(""), false);
});
