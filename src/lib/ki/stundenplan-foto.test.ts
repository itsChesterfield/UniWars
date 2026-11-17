import { test } from "node:test";
import assert from "node:assert/strict";
import { dozentLesen, fachZuordnen, fotoParsen, fotoPromptBauen, tagLesen, zeitLesen } from "./stundenplan-foto.ts";

test("Stundenplan-Foto: Zeiten und Tage lesen", () => {
  assert.equal(zeitLesen("8:15"), "08:15");
  assert.equal(zeitLesen("08.15"), "08:15");
  assert.equal(zeitLesen("10 Uhr"), "10:00");
  assert.equal(zeitLesen("1345"), "13:45");
  assert.equal(zeitLesen("25:00"), null);
  assert.equal(zeitLesen("abends"), null);
  assert.equal(tagLesen("Montag"), "MO");
  assert.equal(tagLesen("Di."), "DI");
  assert.equal(tagLesen("FR"), "FR");
  assert.equal(tagLesen("Feiertag"), null);
});

test("Stundenplan-Foto: Antwort prüfen, sortieren, Duplikate weg", () => {
  const antwort = "```json\n" + JSON.stringify({
    eintraege: [
      { fach: "Statistik", tag: "MI", start: "10:00", ende: "11:30", raum: "H 2", dozent: null },
      { fach: "Mikroökonomie", tag: "Montag", start: "8.15", ende: "9.45", raum: "", dozent: "Prof. Meyer" },
      { fach: "Mikroökonomie", tag: "MO", start: "08:15", ende: "09:45" },
      { fach: "Kaputt", tag: "MO", start: "12:00", ende: "11:00" },
      { fach: "", tag: "DI", start: "12:00", ende: "13:00" },
    ],
  }) + "\n```";
  assert.deepEqual(fotoParsen(antwort), [
    { fach: "Mikroökonomie", tag: "MO", start: "08:15", ende: "09:45", raum: null, dozent: "Prof. Meyer" },
    { fach: "Statistik", tag: "MI", start: "10:00", ende: "11:30", raum: "H 2", dozent: null },
  ]);
  assert.deepEqual(fotoParsen("kein json"), []);
  assert.deepEqual(fotoParsen(JSON.stringify({ eintraege: "x" })), []);
});

test("Stundenplan-Foto: Fächer zuordnen", () => {
  const faecher = [
    { id: "1", name: "Mikroökonomie" },
    { id: "2", name: "Statistik I" },
    { id: "3", name: "BWL" },
  ];
  assert.equal(fachZuordnen("mikroökonomie", faecher)?.id, "1");
  assert.equal(fachZuordnen("Mikroökonomie VL", faecher)?.id, "1");
  assert.equal(fachZuordnen("Übung Mikroökonomie", faecher)?.id, "1");
  assert.equal(fachZuordnen("Statistik I Übung", faecher)?.id, "2");
  assert.equal(fachZuordnen("Recht", faecher), null);
  // Kurze Namen nicht per Präfix raten
  assert.equal(fachZuordnen("BWL-Grundlagen", faecher), null);
  assert.match(fotoPromptBauen(["BWL"]).nutzer, /"BWL"/);
});

test("KI-Anfrage: Bilder hängen an der Nutzernachricht", async () => {
  const { nachrichtenBauen } = await import("./anfrage.ts");
  const liste = nachrichtenBauen({ system: "S", nutzer: "Lies ab", bilder: ["data:image/jpeg;base64,AAA"], maxTokens: 10, temperatur: 0 });
  assert.deepEqual(liste[1], {
    role: "user",
    content: [
      { type: "text", text: "Lies ab" },
      { type: "image_url", image_url: "data:image/jpeg;base64,AAA" },
    ],
  });
  assert.deepEqual(nachrichtenBauen({ nutzer: "x", maxTokens: 1, temperatur: 0 })[0], { role: "user", content: "x" });
});

test("Dozent: Veranstaltungsarten werden nicht als Dozent übernommen", () => {
  assert.equal(dozentLesen("Seminaristischer Lehrvortrag"), null);
  assert.equal(dozentLesen("Lehrvertrag"), null);
  assert.equal(dozentLesen("PC-Übung"), null);
  assert.equal(dozentLesen("Prof. Dr. Klaus Meier"), "Prof. Dr. Klaus Meier");
});
