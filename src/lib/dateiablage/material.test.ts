import assert from "node:assert/strict";
import { test } from "node:test";
import { fachZuordnungen, materialVomPfad } from "./material.ts";

const ID = "00000000-0000-4000-8000-000000000003";

test("Materialbesuche erkennen PDF-Fundstellen und Originale anderer Hubs", () => {
  assert.equal(materialVomPfad(`/pdf-reader/${ID}`, new URLSearchParams("seite=12")), `datei:${ID}`);
  assert.equal(materialVomPfad("/notizen", new URLSearchParams({ id: ID })), `notiz:${ID}`);
  assert.equal(materialVomPfad(`/karteikarten/${ID}/lernen`, new URLSearchParams()), `stapel:${ID}`);
  assert.equal(materialVomPfad(`/transkription/podcast/${ID}`, new URLSearchParams()), `podcast:${ID}`);
  assert.equal(materialVomPfad("/dateiablage", new URLSearchParams({ ordner: ID })), null);
});

test("Fachzuordnungen ergänzen oder entfernen ein Fach am selben Original", () => {
  const zuordnung = { art: "whiteboard", material_id: ID };
  assert.deepEqual(fachZuordnungen("statistik", [{ ...zuordnung, fach_id: "methoden", ausgeblendet: false }]), ["statistik", "methoden"]);
  assert.deepEqual(fachZuordnungen("statistik", [{ ...zuordnung, fach_id: "statistik", ausgeblendet: true }]), []);
});
