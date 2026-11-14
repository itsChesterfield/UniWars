import { test } from "node:test";
import assert from "node:assert/strict";
import { hatDaten, lernplanPrompt, mitGrund, tagesvorschlaegeLesen, MAX_VORSCHLAEGE, type Lagebild } from "./lernplan.ts";
import { agentLauf, type ModellAufruf, type Werkzeug } from "./agent.ts";
import { karteBauen, type Aktionskarte } from "./assistent.ts";
import type { StreamEreignis } from "./anfrage.ts";

const LEER: Lagebild = { faecher: [], pruefungen: [], deadlines: [], todos_offen: [], stapel: [], stundenplan_heute: [], lernzeit_7_tage: {} };
const LAGE: Lagebild = {
  faecher: [{ id: "f1", name: "Mathe 1" }],
  pruefungen: [{ titel: "Klausur Mathe 1", datum: "Donnerstag, 19.11.2026, 10:00 Uhr", fach: "Mathe 1" }],
  deadlines: [],
  todos_offen: [],
  stapel: [{ karten: 40, heute_faellig: 30 }],
  stundenplan_heute: [],
  lernzeit_7_tage: { minuten_gesamt: 20, pro_fach: { "Mathe 1": 20 } },
};

test("Lernplan: ohne Daten kein KI-Aufruf", () => {
  assert.equal(hatDaten(LEER), false);
  assert.equal(hatDaten({ ...LEER, stapel: [{ karten: 0 }] }), false);
  assert.equal(hatDaten(LAGE), true);
  assert.equal(hatDaten({ ...LEER, faecher: [{}] }), true);
});

test("Lernplan: Prompt mit Daten, höchstens 3, nichts erfinden", () => {
  const p = lernplanPrompt(LAGE, "Samstag, 14.11.2026");
  assert.match(p.system, /höchstens 3/);
  assert.match(p.system, /Erfinde keine/);
  assert.match(p.nutzer, /Heute ist Samstag, 14\.11\.2026/);
  assert.match(p.nutzer, /<quelle art="lagebild">[\s\S]*"heute_faellig": 30/);
});

test("Lernplan: Vorschläge mit Grund, höchstens 3 (Tool-Schleife mit gemocktem Modell)", async () => {
  const karten: Aktionskarte[] = [];
  const gruende = new Map<string, string>();
  const umfeld = { faecher: [{ id: "f1", name: "Mathe 1" }], stapel: [{ id: "s1", name: "Analysis", fach_id: "f1", faellig: 30 }], jetzt: new Date("2026-11-14T08:00:00Z") };
  const basis: Werkzeug = {
    name: "stapel_lernen_vorschlagen",
    beschreibung: "",
    parameter: { type: "object", properties: { stapel: { type: "string" } }, required: ["stapel"] },
    ausfuehren: async (args) => {
      karten.push({ id: `k${karten.length + 1}`, status: "offen", ...karteBauen("stapel_lernen", args, umfeld) } as Aktionskarte);
      return { vorschlag: "ok" };
    },
  };
  const w = mitGrund(basis, karten, gruende);
  assert.deepEqual((w.parameter as { required: string[] }).required, ["stapel", "grund"]);
  const aufruf = (id: string) => ({ id, name: "stapel_lernen_vorschlagen", argumente: JSON.stringify({ stapel: "Analysis", grund: "Mathe-Klausur in 5 Tagen, 30 Karten fällig" }) });
  const runden: StreamEreignis[][] = [
    [{ typ: "werkzeuge", aufrufe: [aufruf("1"), aufruf("2"), aufruf("3"), aufruf("4")] }, { typ: "ende", tokensEin: 1, tokensAus: 1, geschaetzt: false }],
    [{ typ: "ende", tokensEin: 1, tokensAus: 1, geschaetzt: false }],
  ];
  let r = 0;
  const rufen: ModellAufruf = async function* () {
    for (const e of runden[r++]) yield e;
  };
  for await (const e of agentLauf({ rufen, optionen: { maxTokens: 100, temperatur: 0 }, nachrichten: [{ role: "user", content: "?" }], werkzeuge: [w], maxRunden: 2 })) void e;
  assert.equal(karten.length, MAX_VORSCHLAEGE);
  assert.equal(gruende.get("k1"), "Mathe-Klausur in 5 Tagen, 30 Karten fällig");
  assert.deepEqual(karten[0], { id: "k1", status: "offen", typ: "stapel_lernen", stapel_id: "s1", stapel_name: "Analysis", faellig: 30 });
});

test("Lernplan: gespeicherte Vorschläge robust lesen", () => {
  const k = { id: "k1", status: "offen", typ: "lernsession", fach_id: null, fach_name: null, minuten: null };
  assert.equal(tagesvorschlaegeLesen([{ grund: "x", karte: k }, { grund: 1 }, null, { grund: "y" }]).length, 1);
  assert.deepEqual(tagesvorschlaegeLesen("kaputt"), []);
});
