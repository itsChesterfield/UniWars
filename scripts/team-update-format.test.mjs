import assert from "node:assert/strict";
import test from "node:test";
import { briefingAusKommentaren, briefingKommentar, briefingPruefen } from "./team-update-format.mjs";

const sha = "a".repeat(40);
const neuerSha = "b".repeat(40);
const briefing = { titel: "Das Profilmenü ist leichter erreichbar", punkte: ["Die **Einstellungen** öffnen direkt."] };
const kommentar = (stand, text = briefing, user = "github-actions[bot]") => ({
  user: { login: user }, body: briefingKommentar(stand, text),
});

test("Briefing erhält Text und erlaubten Fettdruck", () => {
  assert.deepEqual(briefingAusKommentaren([kommentar(sha)], sha), briefing);
});

test("Ein fehlender, fremder oder älterer Entwurf zählt nicht", () => {
  assert.equal(briefingAusKommentaren([kommentar(sha), kommentar(neuerSha, briefing, "fremd")], neuerSha), null);
});

test("Die jüngste Korrektur für denselben Stand gewinnt", () => {
  const korrektur = { ...briefing, titel: "Du erreichst das Profilmenü schneller" };
  assert.deepEqual(briefingAusKommentaren([kommentar(sha), kommentar(sha, korrektur)], sha), korrektur);
});

test("Briefings mit HTML, Links, Zugangsdaten oder ungültigen Listen werden abgelehnt", () => {
  const ungueltig = [
    ["<a href='https://privat.example'>Eintrag</a>"], ["[Link](javascript:alert)"], ["sk-beispiel"],
    ["**Unvollständig"], ["Zeile\nUmbruch"], ["X".repeat(221)], [], ["1", "2", "3", "4"],
  ];
  for (const punkte of ungueltig) assert.throws(() => briefingPruefen({ ...briefing, punkte }));
});
