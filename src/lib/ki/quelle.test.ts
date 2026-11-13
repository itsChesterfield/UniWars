import { test } from "node:test";
import assert from "node:assert/strict";
import { quelleErkennungParsen, quellePromptBauen } from "./quelle.ts";
import { KiEingabe, KiKeineDaten } from "./fehler.ts";

const BUCH = "Müller, A. & Schmidt, B. (2021). Grundlagen der Informatik (3. Aufl.). Berlin: Springer. S. 45–60.";
const WEB = "Statistisches Bundesamt (2024): Verbraucherpreisindex. https://www.destatis.de/vpi (abgerufen am 3.11.2026)";

test("KI-09: Buch – alle Felder, die im Text stehen", () => {
  const e = quelleErkennungParsen(
    JSON.stringify({ typ: "buch", autoren: "Müller, A.; Schmidt, B.", titel: "Grundlagen der Informatik", jahr: 2021, verlag: "Springer", url: null, abgerufen_am: null, seiten: "45–60" }),
    BUCH,
  );
  assert.deepEqual(e.felder, { typ: "BUCH", autoren: "Müller, A.; Schmidt, B.", titel: "Grundlagen der Informatik", jahr: 2021, verlag: "Springer", seiten: "45–60" });
  assert.deepEqual(e.verworfen, []);
});

test("KI-09: Webseite mit URL und Abrufdatum (Datum ohne führende Nullen im Text)", () => {
  const e = quelleErkennungParsen(
    JSON.stringify({ typ: "WEBSEITE", autoren: "Statistisches Bundesamt", titel: "Verbraucherpreisindex", jahr: "2024", url: "https://www.destatis.de/vpi", abgerufen_am: "2026-11-03" }),
    WEB,
  );
  assert.equal(e.felder.url, "https://www.destatis.de/vpi");
  assert.equal(e.felder.abgerufenAm, "2026-11-03");
  assert.equal(e.felder.jahr, 2024);
  assert.equal(e.felder.autoren, "Statistisches Bundesamt");
});

test("KI-09: Erfundenes wird verworfen (Titel, Verlag, Jahr, URL, Seiten, Autor, Datum)", () => {
  const e = quelleErkennungParsen(
    JSON.stringify({
      typ: "BUCH",
      autoren: "Müller, A.; Erfunden, Z.",
      titel: "Ein ganz anderer Titel",
      jahr: 1999,
      verlag: "Oldenbourg",
      url: "https://erfunden.example",
      abgerufen_am: "2020-01-01",
      seiten: "100–120",
    }),
    BUCH,
  );
  assert.deepEqual(e.felder, { typ: "BUCH", autoren: "Müller, A." });
  assert.deepEqual(e.verworfen.sort(), ["abgerufenAm", "jahr", "seiten", "titel", "url", "verlag"].sort());
});

test("KI-09: URL ohne Verlag → Typ Webseite, wenn die KI keinen Typ nennt", () => {
  assert.equal(quelleErkennungParsen(JSON.stringify({ url: "https://www.destatis.de/vpi" }), WEB).felder.typ, "WEBSEITE");
});

test("KI-09: kaputt, leer, nur Typ → KiKeineDaten", () => {
  assert.throws(() => quelleErkennungParsen("{kaputt", BUCH), KiKeineDaten);
  assert.throws(() => quelleErkennungParsen("{}", BUCH), KiKeineDaten);
  assert.throws(() => quelleErkennungParsen('{"typ":"BUCH","titel":"erfunden"}', BUCH), (e) => e instanceof KiKeineDaten && /keine Quellenangabe/.test(e.nutzerMeldung));
});

test("KI-09: Eingabe zu kurz / zu lang, Prompt mit Marker und Regel", () => {
  assert.throws(() => quellePromptBauen("kurz"), KiEingabe);
  assert.throws(() => quellePromptBauen("x".repeat(3001)), KiEingabe);
  const p = quellePromptBauen(BUCH);
  assert.match(p.nutzer, /^<quelle>\n/);
  assert.match(p.system, /Erfinde nichts/);
});
