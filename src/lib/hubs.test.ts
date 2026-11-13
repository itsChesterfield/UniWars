import { test } from "node:test";
import assert from "node:assert/strict";
import { berlinDatum, berlinMitternacht, berlinUhrzeit, berlinWochentag } from "./zeit.ts";
import { naechsteWiederholung, istFaellig } from "./karteikarten/leitner.ts";
import {
  WS_STANDARD,
  abschliessen,
  einstellungenLesen,
  pausieren,
  restzeit,
  startZustand,
  starten,
  ueberspringen,
  zuruecksetzen,
  alsUhr,
  dauerText,
} from "./work-station/timer.ts";
import { tabelleFehlt } from "./hubs/datenbank.ts";

test("Berlin-Zeit: Datum, Uhrzeit, Wochentag", () => {
  const d = new Date("2026-11-13T23:30:00Z"); // 14.11. 00:30 in Berlin (Winterzeit)
  assert.equal(berlinDatum(d), "2026-11-14");
  assert.equal(berlinUhrzeit(d), "00:30");
  assert.equal(berlinWochentag(d), "SA");
});

test("Berlin-Mitternacht auch über Zeitumstellung", () => {
  assert.equal(berlinMitternacht("2026-11-13").toISOString(), "2026-11-12T23:00:00.000Z");
  assert.equal(berlinMitternacht("2026-07-01").toISOString(), "2026-06-30T22:00:00.000Z");
  // 28.03.2026 + 1 Tag = 29.03. (Umstellung auf Sommerzeit in der Nacht)
  assert.equal(berlinMitternacht("2026-03-28", 1).toISOString(), "2026-03-28T23:00:00.000Z");
  assert.equal(berlinMitternacht("2026-03-29", 1).toISOString(), "2026-03-29T22:00:00.000Z");
  assert.equal(berlinMitternacht("2026-12-31", 1).toISOString(), "2026-12-31T23:00:00.000Z");
});

test("Leitner: gewusst eine Box höher, max 5; nicht gewusst zurück auf 1", () => {
  assert.deepEqual(naechsteWiederholung(1, "gewusst"), { box: 2, tage: 2 });
  assert.deepEqual(naechsteWiederholung(4, "gewusst"), { box: 5, tage: 16 });
  assert.deepEqual(naechsteWiederholung(5, "gewusst"), { box: 5, tage: 16 });
  assert.deepEqual(naechsteWiederholung(5, "nicht_gewusst"), { box: 1, tage: 1 });
  assert.deepEqual(naechsteWiederholung(2, "nicht_gewusst"), { box: 1, tage: 1 });
  // morgen 0 Uhr Berlin, gesehen am 13.11. um 11 Uhr
  assert.equal(berlinMitternacht(berlinDatum(new Date("2026-11-13T10:00:00Z")), 1).toISOString(), "2026-11-13T23:00:00.000Z");
  const jetzt = new Date("2026-11-13T10:00:00Z");
  assert.equal(istFaellig("2026-11-13T09:00:00Z", jetzt), true);
  assert.equal(istFaellig("2026-11-13T23:00:00Z", jetzt), false);
});

test("Work Station: Einstellungen werden begrenzt", () => {
  assert.deepEqual(einstellungenLesen(null), WS_STANDARD);
  assert.deepEqual(einstellungenLesen({ fokus: 200, kurzePause: 0, langePause: "20", runden: 9, ton: false }), {
    fokus: 90,
    kurzePause: 1,
    langePause: 20,
    runden: 8,
    ton: false,
  });
});

test("Work Station: Zyklus Fokus -> kurze Pause … -> lange Pause nach 4 Runden", () => {
  let z = startZustand(WS_STANDARD, "fach-1");
  const modi: string[] = [];
  const sitzungen: number[] = [];
  for (let i = 0; i < 9; i++) {
    z = starten(z, 1_000);
    const r = abschliessen(z);
    if (r.sitzung) sitzungen.push(r.sitzung.minuten);
    z = r.zustand;
    modi.push(z.modus);
  }
  assert.deepEqual(modi, ["kurz", "fokus", "kurz", "fokus", "kurz", "fokus", "lang", "fokus", "kurz"]);
  assert.deepEqual(sitzungen, [25, 25, 25, 25, 25]);
  assert.equal(z.fachId, "fach-1");
});

test("Work Station: Pause hält die Zeit an, Abbruch zählt erst ab 5 Minuten", () => {
  let z = startZustand();
  z = starten(z, 0);
  z = pausieren(z, 3 * 60_000);
  assert.equal(restzeit(z, 999_999_999), 22 * 60_000);
  assert.equal(zuruecksetzen(z, 0).sitzung, null);

  z = starten(z, 10 * 60_000); // Fortsetzen nach Pause
  const r = zuruecksetzen(z, 13 * 60_000); // 3 + 3 = 6 Minuten gelaufen
  assert.deepEqual(r.sitzung, { start: 0, minuten: 6, abgeschlossen: false });
  assert.equal(r.zustand.restMs, 25 * 60_000);
  assert.equal(r.zustand.laeuft, false);

  const s = ueberspringen(starten(startZustand(), 0), 60_000);
  assert.equal(s.sitzung, null);
  assert.equal(s.zustand.modus, "kurz");
});

test("Formatierung", () => {
  assert.equal(alsUhr(24 * 60_000 + 13_000), "24:13");
  assert.equal(alsUhr(0), "00:00");
  assert.equal(dauerText(100), "1 h 40 min");
  assert.equal(dauerText(45), "45 min");
});

test("Fehlende Tabelle wird erkannt", () => {
  assert.equal(tabelleFehlt({ code: "PGRST205", message: "Could not find the table" }), true);
  assert.equal(tabelleFehlt({ code: "42501", message: "permission denied" }), false);
  assert.equal(tabelleFehlt(null), false);
});

import { freierName, groesseText, speicherName, umbenannt, uploadPruefen, SPEICHER_LIMIT_BYTES } from "./dateiablage/dateien.ts";
import { autorenLesen, literaturverzeichnis, verzeichnisEintrag, zitatImText } from "./literatur/apa.ts";

test("Dateiablage: freier Name, Umbenennen behält Endung", () => {
  assert.equal(freierName("Skript.pdf", []), "Skript.pdf");
  assert.equal(freierName("Skript.pdf", ["skript.PDF"]), "Skript (2).pdf");
  assert.equal(freierName("Skript.pdf", ["Skript.pdf", "Skript (2).pdf"]), "Skript (3).pdf");
  assert.equal(freierName("Skript (2).pdf", ["Skript (2).pdf"]), "Skript (3).pdf");
  assert.equal(umbenannt("Folien.pptx", "Vorlesung 3"), "Vorlesung 3.pptx");
  assert.equal(umbenannt("Folien.pptx", "Vorlesung 3.pptx"), "Vorlesung 3.pptx");
  assert.equal(umbenannt("Folien.pptx", "  "), null);
  assert.equal(umbenannt("Folien.pptx", ".pptx"), null);
});

test("Dateiablage: Prüfung von Typ, Größe, Speicherlimit", () => {
  assert.deepEqual(uploadPruefen("a.pdf", 1000, 0), { ok: true, mime: "application/pdf" });
  assert.equal(uploadPruefen("a.exe", 1000, 0).ok, false);
  assert.equal(uploadPruefen("a.pdf", 26 * 1024 * 1024, 0).ok, false);
  assert.equal(uploadPruefen("a.pdf", 1000, SPEICHER_LIMIT_BYTES - 10).ok, false);
  assert.equal(uploadPruefen("Aufnahme.M4A", 1000, 0).ok, true);
});

test("Dateiablage: Anzeige und Speicherpfad", () => {
  assert.equal(groesseText(1288490189), "1,2 GB");
  assert.equal(groesseText(2 * 1024 * 1024 * 1024), "2,0 GB");
  assert.equal(groesseText(512), "512 B");
  assert.equal(speicherName("Übung Nr. 3 (Lösung).pdf"), "Ubung_Nr._3_Losung_.pdf");
});

test("APA: Zitat im Text und Verzeichnis", () => {
  const buch = { typ: "BUCH" as const, autoren: "Müller, Anna; Schmidt, Ben", titel: "Grundlagen der Informatik", jahr: 2023, verlag: "Springer" };
  assert.equal(zitatImText(buch), "(Müller & Schmidt, 2023)");
  assert.equal(verzeichnisEintrag(buch), "Müller, A., & Schmidt, B. (2023). Grundlagen der Informatik. Springer.");
  assert.equal(zitatImText({ autoren: "Müller, Anna", jahr: 2023, seiten: "45–60" }, true), "(Müller, 2023, S. 45–60)");
  assert.equal(zitatImText({ autoren: "A, B; C, D; E, F", jahr: 2020 }), "(A et al., 2020)");
  assert.deepEqual(autorenLesen("Anna Müller"), [{ nachname: "Müller", vornamen: "Anna" }]);
  const web = { typ: "WEBSEITE" as const, autoren: "Meier, Karl-Heinz", titel: "Was ist ein Automat?", jahr: 2024, url: "https://example.org/a", abgerufen_am: "2026-11-13" };
  assert.equal(verzeichnisEintrag(web), "Meier, K.-H. (2024). Was ist ein Automat? Abgerufen am 13. November 2026, von https://example.org/a");
  const artikel = { typ: "ARTIKEL" as const, autoren: "Zander, Lea", titel: "Neue Ansätze", jahr: 2021, verlag: "Informatik Spektrum, 44(2)", seiten: "10–20" };
  assert.equal(verzeichnisEintrag(artikel), "Zander, L. (2021). Neue Ansätze. Informatik Spektrum, 44(2), 10–20.");
  assert.deepEqual(literaturverzeichnis([artikel, buch]).map((e) => e.slice(0, 6)), ["Müller", "Zander"]);
});

import {
  alsCsv,
  anzeigen,
  auswerten,
  bezuegeVerschieben,
  einfuegen,
  excelFormel,
  loeschen,
  zahlLesen,
  type TabellenDaten,
} from "./tabellen/formeln.ts";

function tab(zellen: Record<string, string>): TabellenDaten {
  return { spalten: 10, zeilen: 20, zellen: Object.fromEntries(Object.entries(zellen).map(([k, w]) => [k, { w }])) };
}
function wert(zellen: Record<string, string>, ref: string, fmt?: "std" | "2" | "%") {
  return anzeigen(auswerten(tab(zellen)).get(ref), fmt);
}

test("Tabellen: Zahlen in deutscher Schreibweise", () => {
  assert.equal(zahlLesen("3,5"), 3.5);
  assert.equal(zahlLesen("1.234,5"), 1234.5);
  assert.equal(zahlLesen("2.5"), 2.5);
  assert.equal(zahlLesen("12%"), 0.12);
  assert.equal(zahlLesen("abc"), null);
  assert.equal(zahlLesen(""), null);
});

test("Tabellen: Formeln (TAB-04)", () => {
  const z = { A1: "2", A2: "3,5", A3: "4", B1: "Text" };
  assert.equal(wert({ ...z, C1: "=A1+A2*2" }, "C1"), "9");
  assert.equal(wert({ ...z, C1: "=(A1+A2)*2" }, "C1"), "11");
  assert.equal(wert({ ...z, C1: "=SUMME(A1:A3)" }, "C1"), "9,5");
  assert.equal(wert({ ...z, C1: "=MITTELWERT(A1:A3)" }, "C1", "2"), "3,17");
  assert.equal(wert({ ...z, C1: "=MIN(A1:A3)" }, "C1"), "2");
  assert.equal(wert({ ...z, C1: "=max(A1:A3; 10)" }, "C1"), "10");
  assert.equal(wert({ ...z, C1: "=ANZAHL(A1:B3)" }, "C1"), "3");
  assert.equal(wert({ ...z, C1: "=-A1/4" }, "C1"), "-0,5");
  assert.equal(wert({ ...z, C1: "=A1*1,5" }, "C1"), "3");
  assert.equal(wert({ ...z, C1: "=A1+D9" }, "C1"), "2"); // leere Zelle = 0
  assert.equal(wert({ A1: "0,25" }, "A1", "%"), "25 %");
});

test("Tabellen: Fehlerfälle ergeben #FEHLER", () => {
  const z = { A1: "2", B1: "Text" };
  for (const f of ["=A1+B1", "=A1/0", "=SUMME(A1", "=FOO(A1)", "=A1:A3", "=", "=1+", "=MITTELWERT(C1:C3)"]) {
    assert.equal(wert({ ...z, C1: f }, "C1"), "#FEHLER", f);
  }
  // Zirkelbezug
  assert.equal(wert({ A1: "=B1", B1: "=A1" }, "A1"), "#FEHLER");
  assert.equal(wert({ A1: "=A1+1" }, "A1"), "#FEHLER");
  // Folgefehler
  assert.equal(wert({ A1: "=1/0", B1: "=A1+1" }, "B1"), "#FEHLER");
});

test("Tabellen: Bezüge beim Einfügen/Löschen anpassen (TAB-03)", () => {
  assert.equal(bezuegeVerschieben("=SUMME(A1:A3)+B2", { art: "zeile", index: 1, delta: 1 }), "=SUMME(A1:A4)+B3");
  assert.equal(bezuegeVerschieben("=SUMME(A1:A3)+B2", { art: "zeile", index: 1, delta: -1 }), "=SUMME(A1:A2)+#FEHLER");
  assert.equal(bezuegeVerschieben("=C1*2", { art: "spalte", index: 0, delta: 1 }), "=D1*2");
  assert.equal(bezuegeVerschieben("=SUMME(B1:B1)", { art: "spalte", index: 1, delta: -1 }), "=SUMME(#FEHLER)");
  const d = tab({ A1: "1", A2: "2", A3: "=SUMME(A1:A2)" });
  const mehr = einfuegen(d, "zeile", 1)!;
  assert.equal(mehr.zeilen, 21);
  assert.equal(mehr.zellen.A3.w, "2");
  assert.equal(mehr.zellen.A4.w, "=SUMME(A1:A3)");
  assert.equal(anzeigen(auswerten(mehr).get("A4")), "3");
  const weniger = loeschen(d, "zeile", 0)!;
  assert.equal(weniger.zellen.A2.w, "=SUMME(A1:A1)");
  assert.equal(anzeigen(auswerten(weniger).get("A2")), "2");
});

test("Tabellen: Export CSV und Excel-Formeln (TAB-06)", () => {
  const csv = alsCsv(tab({ A1: "Name", B1: "Note", A2: "Max; Mustermann", B2: "1,7", B3: "=SUMME(B2:B2)" }));
  assert.equal(csv, '﻿Name;Note\r\n"Max; Mustermann";1,7\r\n;1,7');
  assert.equal(excelFormel("=SUMME(A1:A3; 2,5)*mittelwert(B1:B2)"), "SUM(A1:A3, 2.5)*AVERAGE(B1:B2)");
});
