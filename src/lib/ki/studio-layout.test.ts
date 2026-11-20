import { test } from "node:test";
import assert from "node:assert/strict";
import { STUDIO_BREITE, studioBreiteBegrenzen, studioBreiteLesen, studioMaximalbreite } from "./studio-layout.ts";

test("Studio lässt neben Panel und Symbolleiste Platz für die Arbeitsfläche", () => {
  assert.equal(studioMaximalbreite(1440, 216), 768);
  assert.equal(studioMaximalbreite(1440, 216 + 272), 496);
  assert.equal(studioMaximalbreite(1024, 64), 504);
  assert.equal(studioMaximalbreite(1920, 216), STUDIO_BREITE.breit);
  assert.ok(studioMaximalbreite(800, 64) < STUDIO_BREITE.schmal);
  assert.ok(studioMaximalbreite(1100, 64 + 272) < STUDIO_BREITE.schmal);
});

test("Studio begrenzt die sichtbare Breite auf den aktuellen Platz", () => {
  assert.equal(studioBreiteBegrenzen(300, 504), STUDIO_BREITE.schmal);
  assert.equal(studioBreiteBegrenzen(410.8, 504), 411);
  assert.equal(studioBreiteBegrenzen(690, 504), 504);
});

test("Studio liest die Wunschbreite und übernimmt die alte Einstellung", () => {
  assert.equal(studioBreiteLesen("693", "1"), 693);
  assert.equal(studioBreiteLesen(null, "1"), STUDIO_BREITE.breit);
  assert.equal(studioBreiteLesen("901", null), STUDIO_BREITE.standard);
  assert.equal(studioBreiteLesen("NaN", null), STUDIO_BREITE.standard);
  assert.equal(studioBreiteLesen(null, null), STUDIO_BREITE.standard);
});
