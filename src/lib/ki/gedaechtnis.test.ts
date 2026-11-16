import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aehnlich,
  ampel,
  beherrschungNeu,
  eintraegeLesen,
  gewicht,
  kennenlernenEintraege,
  kennenlernenStatus,
  kompetenzText,
  kontextText,
  lernErgebnisLesen,
  lohntSichLernen,
  rhythmusText,
  rueckblick,
  statusFuer,
  zusammenfassenLesen,
  type Eintrag,
} from "./gedaechtnis.ts";

const jetzt = new Date("2026-11-16T12:00:00Z");
const e = (id: string, inhalt: string, extra: Partial<Eintrag> = {}): Eintrag => ({
  id,
  bereich: "rahmen",
  inhalt,
  quelle: "gespraech",
  sicherheit: 0.9,
  status: "aktiv",
  fest: false,
  zuletzt_genutzt: null,
  erstellt_am: "2026-11-10T00:00:00Z",
  ...extra,
});

test("eintraegeLesen prüft Bereich, Quelle, Status", () => {
  const l = eintraegeLesen([{ id: "1", bereich: "quatsch", inhalt: "x", quelle: "?", status: "?", sicherheit: 3 }, { id: "", inhalt: "y" }]);
  assert.equal(l.length, 1);
  assert.equal(l[0].bereich, "rahmen");
  assert.equal(l[0].sicherheit, 1);
});

test("gewicht: alte Einträge verblassen, feste nicht", () => {
  const neu = gewicht(e("1", "a"), jetzt);
  const alt = gewicht(e("2", "a", { erstellt_am: "2026-02-01T00:00:00Z", bereich: "interesse" }), jetzt);
  const fest = gewicht(e("3", "a", { erstellt_am: "2020-01-01T00:00:00Z", fest: true }), jetzt);
  assert.ok(neu > alt);
  assert.ok(alt < 0.5);
  assert.ok(fest >= 0.8);
});

test("aehnlich erkennt Duplikate", () => {
  assert.ok(aehnlich("arbeitet dienstags im Nebenjob", "arbeitet dienstags im Nebenjob als Kellner"));
  assert.ok(!aehnlich("mag Fußball", "studiert Informatik"));
});

test("kontextText: nur aktive, nach Gewicht, im Budget, gruppiert", () => {
  const liste = [
    e("1", "studiert Informatik", { fest: true }),
    e("2", "mag Fußball-Beispiele", { bereich: "lernstil" }),
    e("3", "Vorschlag", { status: "vorschlag" }),
    e("4", "uralt", { erstellt_am: "2024-01-01T00:00:00Z", bereich: "interesse" }),
  ];
  const k = kontextText(liste, "Erklär mir Rekursion", jetzt);
  assert.match(k.text, /Studium und Alltag: studiert Informatik/);
  assert.match(k.text, /Lernstil: mag Fußball-Beispiele/);
  assert.ok(!k.text.includes("Vorschlag") && !k.text.includes("uralt"));
  assert.deepEqual(new Set(k.ids), new Set(["1", "2"]));
  assert.ok(kontextText(liste, "", jetzt, 30).ids.length <= 1);
});

test("lohntSichLernen", () => {
  assert.ok(lohntSichLernen("Ich arbeite dienstags immer im Café"));
  assert.ok(!lohntSichLernen("danke!"));
  assert.ok(!lohntSichLernen("Was ist eine Varianz?"));
});

test("lernErgebnisLesen: Duplikate raus, Sensibles nur als Vorschlag, IDs geprüft", () => {
  const bekannt = [e("a1", "arbeitet dienstags im Nebenjob")];
  const r = lernErgebnisLesen(
    JSON.stringify({
      neu: [
        { bereich: "rahmen", inhalt: "arbeitet dienstags im Nebenjob", sicherheit: 0.9 },
        { bereich: "interesse", inhalt: "spielt Handball", sicherheit: 0.9 },
        { bereich: "rahmen", inhalt: "hat ADHS", sicherheit: 0.9 },
        { bereich: "lernstil", inhalt: "mag vielleicht Bilder", sicherheit: 0.5 },
        { bereich: "unsinn", inhalt: "x" },
      ],
      ersetzen: [{ id: "a1", inhalt: "arbeitet mittwochs" }, { id: "gibtsnicht", inhalt: "y" }],
      vergessen: ["a1", "fremd"],
    }),
    bekannt,
  );
  assert.deepEqual(r.neu.map((n) => [n.inhalt, n.status]), [
    ["spielt Handball", "aktiv"],
    ["hat ADHS", "vorschlag"],
    ["mag vielleicht Bilder", "vorschlag"],
  ]);
  assert.deepEqual(r.ersetzen, [{ id: "a1", inhalt: "arbeitet mittwochs" }]);
  assert.deepEqual(r.vergessen, ["a1"]);
  assert.deepEqual(lernErgebnisLesen("kaputt", bekannt), { neu: [], ersetzen: [], vergessen: [] });
});

test("statusFuer", () => {
  assert.equal(statusFuer(0.9, false), "aktiv");
  assert.equal(statusFuer(0.6, false), "vorschlag");
  assert.equal(statusFuer(1, true), "vorschlag");
});

test("zusammenfassenLesen: nur Gruppen ab 2 bekannten IDs, keine doppelt", () => {
  const l = [e("1", "a"), e("2", "b"), e("3", "c")];
  const g = zusammenfassenLesen(JSON.stringify({ gruppen: [{ ids: ["1", "2"], inhalt: "ab" }, { ids: ["2", "3"], inhalt: "bc" }, { ids: ["9", "3"], inhalt: "x" }] }), l);
  assert.deepEqual(g, [{ ids: ["1", "2"], inhalt: "ab" }]);
});

test("Kennenlernen: Einträge und Status", () => {
  const k = kennenlernenEintraege({ studium: "Informatik, 3. Semester", ziel: "", interessen: "Fußball" });
  assert.deepEqual(k.map((x) => x.inhalt), ["studiert Informatik, 3. Semester", "interessiert sich für Fußball"]);
  assert.equal(k[0].fest, true);
  assert.equal(kennenlernenStatus({}, jetzt), "neu");
  assert.equal(kennenlernenStatus({ erledigt_am: "2026-10-01T00:00:00Z" }, jetzt), "fertig");
  assert.equal(kennenlernenStatus({ erledigt_am: "2026-03-01T00:00:00Z" }, jetzt), "auffrischen");
  assert.equal(kennenlernenStatus({ uebersprungen_am: "2026-11-10T00:00:00Z" }, jetzt), "fertig");
});

test("Kompetenz: gleitender Mittelwert, Ampel, Text", () => {
  let s = beherrschungNeu(null, 1);
  assert.deepEqual(s, { beherrschung: 1, versuche: 1 });
  s = beherrschungNeu(s, 0);
  assert.equal(s.beherrschung, 0.5);
  for (let i = 0; i < 10; i++) s = beherrschungNeu(s, 0);
  assert.ok(s.beherrschung < 0.1);
  assert.equal(ampel(0.8), "sicher");
  assert.equal(ampel(0.5), "wackelt");
  assert.equal(ampel(0.1), "fehlt");
  const t = kompetenzText([
    { thema: "Varianz", fach: "Statistik", beherrschung: 0.2, versuche: 3, fehlerbild: "verwechselt mit Standardabweichung" },
    { thema: "Median", fach: "Statistik", beherrschung: 0.9, versuche: 3, fehlerbild: null },
  ]);
  assert.match(t, /Noch unsicher: Varianz \(Statistik\) – verwechselt/);
  assert.match(t, /Sitzt schon: Median/);
});

test("rhythmusText", () => {
  assert.equal(rhythmusText([{ start: "2026-11-10T19:00:00Z", dauer_minuten: 30 }]), null);
  const abends = Array.from({ length: 6 }, (_, i) => ({ start: `2026-11-1${i}T18:30:00Z`, dauer_minuten: 40 + i }));
  assert.match(rhythmusText(abends) ?? "", /abends.*ca\. 4\d Minuten/);
});

test("rueckblick: nur neue, aktive", () => {
  const l = [e("1", "neu"), e("2", "alt", { erstellt_am: "2026-01-01T00:00:00Z" }), e("3", "vorschlag", { status: "vorschlag" })];
  assert.deepEqual(rueckblick(l, jetzt).map((x) => x.id), ["1"]);
});
