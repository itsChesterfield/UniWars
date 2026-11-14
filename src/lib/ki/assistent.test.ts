import { test } from "node:test";
import assert from "node:assert/strict";
import {
  datumAufloesen,
  fachFinden,
  karteBauen,
  kontextAusPfad,
  kontextBlock,
  kontextPruefen,
  laufenderEintrag,
  modellNachrichten,
  stundenplanTermine,
  titelAusFrage,
  verlaufKuerzen,
  werkzeugDatenLesen,
  zeitraum,
  type Aktionskarte,
  type GespeicherteNachricht,
} from "./assistent.ts";
import { agentLauf, type AgentEreignis, type ModellAufruf, type Werkzeug } from "./agent.ts";
import type { StreamEreignis } from "./anfrage.ts";
import { KiEingabe } from "./fehler.ts";

// Mittwoch, 18.11.2026, 10:00 Uhr in Berlin (MEZ = UTC+1)
const JETZT = new Date("2026-11-18T09:00:00Z");
const FAECHER = [
  { id: "f1", name: "Mathe 1" },
  { id: "f2", name: "Makroökonomie" },
];
const STAPEL = [{ id: "s1", name: "Analysis", fach_id: "f1", faellig: 15 }];
const UMFELD = { faecher: FAECHER, stapel: STAPEL, jetzt: JETZT };

test("Assistent: Kontext aus der Adresse (nur Hub und ID, keine Inhalte)", () => {
  const id = "33333333-3333-4333-8333-333333333333";
  assert.deepEqual(kontextAusPfad("/notizen", new URLSearchParams(`id=${id}`)), { hub: "notizen", objekt: { art: "notiz", id } });
  assert.deepEqual(kontextAusPfad(`/karteikarten/${id}/lernen`), { hub: "karteikarten", objekt: { art: "stapel", id } });
  assert.deepEqual(kontextAusPfad("/"), { hub: "dashboard", objekt: null });
  assert.deepEqual(kontextAusPfad("/irgendwas"), { hub: "dashboard" });
  assert.deepEqual(kontextPruefen({ hub: "notizen", objekt: { art: "notiz", id: "x; drop table" }, inhalt: "geheim" }), { hub: "notizen", objekt: null });
});

test("Assistent: Kontext-Block mit Datum (Berlin), Bereich, Objekt und laufender Vorlesung", () => {
  const k = kontextBlock({ jetzt: JETZT, hub: "notizen", objekt: { art: "notiz", id: "n1", titel: "VL 3 „Inflation“" }, laufend: { fach: "Mathe 1", bis: "11:30" } });
  assert.match(k, /Mittwoch, 18\.11\.2026, 10:00 Uhr/);
  assert.match(k, /ISO-Datum 2026-11-18/);
  assert.match(k, /Bereich der App: Notizen/);
  assert.match(k, /Geöffnet: Notiz „VL 3 {2}Inflation “ \(id n1\)/);
  assert.match(k, /läuft gerade: Mathe 1 \(bis 11:30 Uhr\)/);
  const plan = [{ id: "e1", fach_id: "f1", tag: "MI", start_zeit: "09:45:00", end_zeit: "11:15:00" }];
  assert.equal(laufenderEintrag(plan, JETZT)?.id, "e1");
  assert.equal(laufenderEintrag(plan, new Date("2026-11-18T10:30:00Z")), null);
});

test("Assistent: Datum auflösen – relativ, absolut, mit/ohne Uhrzeit (Europe/Berlin)", () => {
  // "Freitag" ohne Uhrzeit → Fr 20.11.2026, 23:59 Berlin
  assert.deepEqual(datumAufloesen("Freitag", JETZT), { iso: "2026-11-20T22:59:00.000Z", mitUhrzeit: false });
  assert.deepEqual(datumAufloesen("am Freitag", JETZT), { iso: "2026-11-20T22:59:00.000Z", mitUhrzeit: false });
  assert.deepEqual(datumAufloesen("morgen 14 Uhr", JETZT), { iso: "2026-11-19T13:00:00.000Z", mitUhrzeit: true });
  assert.deepEqual(datumAufloesen("2026-12-01", JETZT), { iso: "2026-12-01T22:59:00.000Z", mitUhrzeit: false });
  assert.deepEqual(datumAufloesen("2026-07-01T10:00", JETZT), { iso: "2026-07-01T08:00:00.000Z", mitUhrzeit: true }, "Sommerzeit");
  assert.deepEqual(datumAufloesen("24.12.", JETZT), { iso: "2026-12-24T22:59:00.000Z", mitUhrzeit: false });
  assert.deepEqual(datumAufloesen("am 3.11. um 10 Uhr", JETZT), { iso: "2027-11-03T09:00:00.000Z", mitUhrzeit: true }, "vergangen → nächstes Jahr");
  assert.deepEqual(datumAufloesen("24.12.2026 14:30", JETZT), { iso: "2026-12-24T13:30:00.000Z", mitUhrzeit: true });
  assert.equal(datumAufloesen("irgendwann", JETZT), null);
});

test("Assistent: Zeitraum für Lese-Werkzeuge (Standard 7 Tage, begrenzt)", () => {
  assert.deepEqual(zeitraum(undefined, undefined, JETZT), { von: "2026-11-17T23:00:00.000Z", bis: "2026-11-25T23:00:00.000Z" });
  const z = zeitraum("2026-11-01", "2027-12-31", JETZT);
  assert.equal((new Date(z.bis).getTime() - new Date(z.von).getTime()) / 86_400_000, 180);
});

test("Assistent: Stundenplan wird zu Terminen der Woche", () => {
  const plan = [
    { id: "a", fach_id: "f1", tag: "MO", start_zeit: "08:00:00", end_zeit: "09:30:00" },
    { id: "b", fach_id: "f2", tag: "MI", start_zeit: "12:00:00", end_zeit: "13:30:00" },
  ];
  const { von, bis } = zeitraum("2026-11-16", "2026-11-22", JETZT);
  const t = stundenplanTermine(plan, von, bis);
  assert.deepEqual(t.map((x) => [x.eintrag.id, x.start]), [["a", "2026-11-16T07:00:00.000Z"], ["b", "2026-11-18T11:00:00.000Z"]]);
});

test("Assistent: Verlauf kürzen – 12 behalten, ältere einmal zusammenfassen", () => {
  const n = (i: number, rolle: GespeicherteNachricht["rolle"] = i % 2 ? "assistent" : "nutzer"): GespeicherteNachricht => ({
    rolle,
    inhalt: `Nachricht ${i}`,
    erstellt_am: new Date(Date.UTC(2026, 10, 18, 9, i)).toISOString(),
  });
  const kurz = verlaufKuerzen([n(0), n(1), n(2)], null);
  assert.equal(kurz.behalten.length, 3);
  assert.equal(kurz.neuZusammenfassen.length, 0);

  const lang = Array.from({ length: 20 }, (_, i) => n(i));
  lang.push(n(99, "werkzeug"));
  const r = verlaufKuerzen(lang, null);
  assert.deepEqual(r.behalten.map((x) => x.inhalt), Array.from({ length: 12 }, (_, i) => `Nachricht ${i + 8}`));
  assert.equal(r.neuZusammenfassen.length, 8, "8 ältere Nachrichten");
  // Bereits bis Nachricht 5 zusammengefasst → nur 6 und 7 sind neu
  const weiter = verlaufKuerzen(lang, n(5).erstellt_am);
  assert.deepEqual(weiter.neuZusammenfassen.map((x) => x.inhalt), ["Nachricht 6", "Nachricht 7"]);

  const m = modellNachrichten({ kontext: "Kontext X", zusammenfassung: "- Früher: Mathe", behalten: r.behalten, frage: "Und jetzt?" });
  assert.equal(m[0].role, "system");
  assert.match(m[0].content, /Kontext X[\s\S]*Kurzfassung des früheren Verlaufs:\n- Früher: Mathe/);
  assert.match(m[0].content, /IMMER mit den Lese-Werkzeugen/);
  assert.equal(m.length, 1 + 12 + 1);
  assert.deepEqual(m.at(-1), { role: "user", content: "Und jetzt?" });
});

test("Assistent: Titel aus der ersten Frage", () => {
  assert.equal(titelAusFrage("Was steht diese Woche an?"), "Was steht diese Woche an?");
  const lang = titelAusFrage("Kannst du mir bitte erklären, wie die Geldpolitik der EZB die Inflation beeinflusst und warum?");
  assert.ok(lang.length <= 60 && lang.endsWith("…"));
});

test("Assistent: Aktionskarten werden geprüft und aufgelöst", () => {
  assert.equal(fachFinden(FAECHER, "mathe")?.id, "f1");
  assert.equal(fachFinden(FAECHER, "Makro")?.id, "f2");
  const d = karteBauen("deadline", { titel: "Übungsblatt 4", faellig_am: "Freitag", fach: "Mathe" }, UMFELD);
  assert.deepEqual(d, { typ: "deadline", titel: "Übungsblatt 4", faellig_am: "2026-11-20T22:59:00.000Z", fach_id: "f1", fach_name: "Mathe 1", deadline_typ: "ABGABE" });
  assert.throws(() => karteBauen("deadline", { titel: "X", faellig_am: "irgendwann" }, UMFELD), /Datum nicht erkannt/);
  assert.throws(() => karteBauen("todo", { titel: "Lesen", fach: "Chemie" }, UMFELD), (e: unknown) => e instanceof KiEingabe && /Mathe 1, Makroökonomie/.test(e.nutzerMeldung));
  const kk = karteBauen("karteikarten", { karten: [{ vorderseite: "A?", rueckseite: "B" }, { vorderseite: "", rueckseite: "x" }], stapel: "Analysis" }, UMFELD);
  assert.deepEqual(kk, { typ: "karteikarten", karten: [{ vorderseite: "A?", rueckseite: "B" }], stapel_id: "s1", stapel_name: "Analysis", fach_id: "f1" });
  assert.deepEqual(karteBauen("stapel_lernen", { stapel: "analysis" }, UMFELD), { typ: "stapel_lernen", stapel_id: "s1", stapel_name: "Analysis", faellig: 15 });
  assert.equal(karteBauen("lernsession", { fach: "Makro", minuten: 500 }, UMFELD).typ, "lernsession");
});

test("Assistent: Werkzeugdaten robust lesen", () => {
  const ok: Aktionskarte = { id: "k1", status: "offen", typ: "todo", titel: "T", fach_id: null, fach_name: null, prioritaet: "MITTEL" };
  const d = werkzeugDatenLesen({ aufrufe: [{ name: "todos_lesen" }, { x: 1 }], karten: [ok, { id: "k2", status: "kaputt", typ: "todo" }] });
  assert.equal(d.aufrufe.length, 1);
  assert.deepEqual(d.karten, [ok]);
  assert.deepEqual(werkzeugDatenLesen(null), { aufrufe: [], karten: [] });
});

test("Assistent: Tool-Schleife mit gemocktem Modell – Deadline-Karte mit korrektem Datum, nichts gespeichert", async () => {
  const karten: Aktionskarte[] = [];
  const vorschlagen: Werkzeug = {
    name: "deadline_vorschlagen",
    beschreibung: "Schlägt eine Deadline vor (speichert nichts)",
    parameter: { type: "object", properties: {} },
    statusText: "Bereite einen Vorschlag vor …",
    ausfuehren: async (args) => {
      const k = { id: `k${karten.length + 1}`, status: "offen" as const, ...karteBauen("deadline", args, UMFELD) };
      karten.push(k);
      return { vorschlag: k.id, hinweis: "Der Nutzer sieht eine Karte und entscheidet selbst." };
    },
  };
  const lesen: Werkzeug = { name: "faecher_auflisten", beschreibung: "", parameter: { type: "object", properties: {} }, ausfuehren: async () => FAECHER };
  const runden: StreamEreignis[][] = [
    [{ typ: "werkzeuge", aufrufe: [{ id: "1", name: "faecher_auflisten", argumente: "{}" }] }, { typ: "ende", tokensEin: 1, tokensAus: 1, geschaetzt: false }],
    [
      { typ: "werkzeuge", aufrufe: [{ id: "2", name: "deadline_vorschlagen", argumente: JSON.stringify({ titel: "Übungsblatt 4", faellig_am: "Freitag", fach: "f1" }) }] },
      { typ: "ende", tokensEin: 1, tokensAus: 1, geschaetzt: false },
    ],
    [{ typ: "text", text: "Hier ist ein Vorschlag für die Deadline." }, { typ: "ende", tokensEin: 1, tokensAus: 1, geschaetzt: false }],
  ];
  let runde = 0;
  const rufen: ModellAufruf = async function* () {
    for (const e of runden[runde++]) yield e;
  };
  const ereignisse: AgentEreignis[] = [];
  for await (const e of agentLauf({ rufen, optionen: { maxTokens: 100 }, nachrichten: [{ role: "user", content: "Leg mir eine Deadline für Übungsblatt 4 am Freitag in Mathe an" }], werkzeuge: [lesen, vorschlagen] })) {
    ereignisse.push(e);
  }
  assert.deepEqual(ereignisse.map((e) => e.typ), ["status", "werkzeug", "status", "werkzeug", "text", "ende"]);
  assert.equal(karten.length, 1);
  assert.equal(karten[0].typ === "deadline" && karten[0].faellig_am, "2026-11-20T22:59:00.000Z");
  assert.equal(karten[0].status, "offen", "Vorschlag ist offen – gespeichert wird erst nach Klick");
});
