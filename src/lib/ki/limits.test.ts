import { test } from "node:test";
import assert from "node:assert/strict";
import { inAnzeigeEinheit, kiLimits, restText } from "./limits.ts";

test("Limits: Standardwerte aus dem Plan", () => {
  const l = kiLimits({});
  assert.equal(l.text.limit, 20);
  assert.equal(l.chat.limit, 40);
  assert.equal(l.audio.limit, 120 * 60);
  assert.equal(l.audio.einheit, "audio_sekunden");
  assert.equal(l.tts.limit, 50_000);
  assert.equal(l.gespraech.limit, 30 * 60);
  assert.deepEqual([l.text.zeitraum, l.chat.zeitraum, l.audio.zeitraum, l.tts.zeitraum, l.gespraech.zeitraum], ["tag", "tag", "monat", "monat", "monat"]);
});

test("Limits: per .env überschreibbar, alter Name KI_TAGESLIMIT gilt weiter, Unsinn wird ignoriert", () => {
  assert.equal(kiLimits({ KI_TAGESLIMIT: "7" }).text.limit, 7);
  assert.equal(kiLimits({ KI_TAGESLIMIT: "7", KI_LIMIT_TEXT_TAG: "9" }).text.limit, 9);
  assert.equal(kiLimits({ KI_LIMIT_AUDIO_MINUTEN_MONAT: "10" }).audio.limit, 600);
  for (const kaputt of ["", " ", "abc", "-5", "0", "2.5", "99999999"]) {
    assert.equal(kiLimits({ KI_LIMIT_CHAT_TAG: kaputt }).chat.limit, 40, `Wert ${JSON.stringify(kaputt)}`);
  }
});

test("Limits: Anzeige in Minuten (aufgerundet) und Resttext", () => {
  const l = kiLimits({});
  assert.equal(inAnzeigeEinheit(l.audio, 61), 2);
  assert.equal(restText(l.text, 6), "Heute noch 14 von 20 KI-Anfragen");
  assert.equal(restText(l.audio, 25 * 60), "Diesen Monat noch 95 von 120 Audio-Minuten");
  assert.equal(restText(l.tts, 1500), "Diesen Monat noch 48.500 von 50.000 Zeichen");
  assert.equal(restText(l.text, 25), "Heute noch 0 von 20 KI-Anfragen");
});
