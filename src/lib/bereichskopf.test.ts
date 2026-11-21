import { test } from "node:test";
import assert from "node:assert/strict";
import { kopfAufgaben, kopfFortschritt, kopfListe, kopfNoten, kopfTermine, minutenDieseWoche, kartenLage, pdfLage } from "./bereichskopf.ts";

// Donnerstag, 19.11.2026, 13:00 Uhr in Berlin
const jetzt = new Date("2026-11-19T12:00:00Z");
const frist = (id: string, titel: string, faellig_am: string) =>
  ({ id, titel, faellig_am, erledigt: false, typ: "ABGABE", fach_id: null }) as never;

test("Aufgaben: Anzahl offen und das Erste mit Zeit", () => {
  const k = kopfAufgaben({ deadlines: [frist("a", "Hausarbeit abgeben", "2026-11-19T22:59:00Z")], todos: [], pruefungen: [] }, jetzt);
  assert.equal(k.zahl, 1);
  assert.equal(k.einheit, "offen");
  assert.equal(k.lage?.text, "Zuerst: Hausarbeit abgeben, heute 23:59.");
  assert.deepEqual(k.lage?.betont, ["Hausarbeit", "abgeben,"]);
});

test("Aufgaben: nichts offen", () => {
  assert.equal(kopfAufgaben({ deadlines: [], todos: [], pruefungen: [] }, jetzt).lage?.text, "Alles erledigt.");
});

test("Termine: nächste Veranstaltung heute mit Uhrzeit, laufende als „Gerade“", () => {
  const stunde = (id: string, start: string, ende: string) => ({ id, tag: "DO", start_zeit: start, end_zeit: ende, fach_id: id, raum: null });
  const d = { stundenplan: [stunde("m", "10:00", "11:30"), stunde("s", "14:00", "15:30")], deadlines: [], pruefungen: [], fachName: (id: string | null) => (id === "m" ? "Mathe" : "Statistik") };
  const k = kopfTermine(d, jetzt);
  assert.equal(k.zahl, 2);
  assert.equal(k.einheit, "heute");
  assert.equal(k.lage?.text, "Als Nächstes: Statistik um 14:00.");
  assert.equal(kopfTermine(d, new Date("2026-11-19T13:30:00Z")).lage?.text, "Gerade: Statistik.");
  assert.equal(kopfTermine(d, new Date("2026-11-19T16:00:00Z")).lage?.text, "Für heute ist alles vorbei.");
});

test("Noten: Schnitt mit Komma, ohne Schnitt die Anzahl", () => {
  assert.deepEqual(kopfNoten(1.66, 3), { zahl: "1,7", einheit: "Gesamtnote aus 3 Noten", lage: null });
  assert.equal(kopfNoten(null, 0).einheit, "Noten eingetragen");
});

test("Fortschritt: Serie und Lernzeit der Woche", () => {
  const k = kopfFortschritt(3, 95);
  assert.equal(k.zahl, 3);
  assert.equal(k.lage?.text, "Diese Woche 1 h 35 min gelernt.");
  assert.equal(kopfFortschritt(1, 0).einheit, "Tag in Folge");
});

test("Liste: keine Anzahl, zuletzt Bearbeitetes, ohne Titel mit Ersatz", () => {
  const k = kopfListe(
    [
      { titel: "Alt", geaendert: "2026-11-01T10:00:00Z" },
      { titel: "", geaendert: "2026-11-18T10:00:00Z" },
    ],
    "Unbenannt",
    ["Dokument", "Dokumente"],
  );
  assert.equal(k.zahl, null);
  assert.equal(k.einheit, "Dokumente");
  assert.equal(k.lage?.text, "Zuletzt bearbeitet: Unbenannt.");
  assert.equal(kopfListe([], "x", ["Dokument", "Dokumente"]).lage, null);
});

test("Lernminuten: nur die laufende Woche zählt", () => {
  const s = [
    { start: "2026-11-16T08:00:00Z", dauer_minuten: 30 },
    { start: "2026-11-19T08:00:00Z", dauer_minuten: 25 },
    { start: "2026-11-15T08:00:00Z", dauer_minuten: 50 },
  ];
  assert.equal(minutenDieseWoche(s, jetzt), 55);
});

test("Karteikarten: Stapel mit den meisten fälligen Karten", () => {
  assert.equal(kartenLage([{ name: "Statistik", faellig: 3 }, { name: "Testgütekriterien", faellig: 12 }]).text, "Heute dran: Testgütekriterien.");
  assert.equal(kartenLage([{ name: "Statistik", faellig: 0 }]).text, "Alles wiederholt. Zeit für Neues.");
});

test("PDF Reader: weiterlesen mit Seite, ohne Seite zuletzt geöffnet", () => {
  assert.equal(pdfLage({ name: "Skript Diagnostik.pdf", letzteSeite: 12 })?.text, "Weiterlesen: Skript Diagnostik, Seite 12.");
  assert.equal(pdfLage({ name: "Folien.pdf", letzteSeite: null })?.text, "Zuletzt geöffnet: Folien.");
  assert.equal(pdfLage(undefined), null);
});
