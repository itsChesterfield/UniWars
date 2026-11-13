import { test } from "node:test";
import assert from "node:assert/strict";
import { berlinDatum, berlinMitternacht, berlinTageZwischen, berlinUhrzeit, berlinWochentag } from "./zeit.ts";
import { bewerten, boxAusIntervall, intervallText, istFaellig, reife, type KartenStand } from "./karteikarten/wiederholung.ts";
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

const NEU: KartenStand = { intervall_tage: 0, leichtigkeit: 2.5, wiederholungen: 0, fehler: 0 };

test("Spaced Repetition: neue Karte – Nochmal < Schwer < Gut < Einfach", () => {
  assert.deepEqual(bewerten(NEU, 1), { intervall_tage: 0, leichtigkeit: 2.3, wiederholungen: 0, fehler: 0 });
  assert.equal(bewerten(NEU, 2).intervall_tage, 1);
  assert.equal(bewerten(NEU, 3).intervall_tage, 2);
  assert.equal(bewerten(NEU, 4).intervall_tage, 4);
  assert.equal(bewerten(NEU, 4).leichtigkeit, 2.65);
});

test("Spaced Repetition: Intervalle wachsen mit 'Gut' immer weiter", () => {
  let k = NEU;
  const folge: number[] = [];
  for (let i = 0; i < 5; i++) {
    k = bewerten(k, 3);
    folge.push(k.intervall_tage);
  }
  assert.deepEqual(folge, [2, 5, 13, 33, 83]);
  // Reihenfolge bleibt bei jedem Stand erhalten
  for (const stand of [k, { ...k, leichtigkeit: 1.3 }, { ...NEU, wiederholungen: 1, intervall_tage: 2 }]) {
    const [s, g, e] = [2, 3, 4].map((b) => bewerten(stand, b as 2 | 3 | 4).intervall_tage);
    assert.ok(s < g && g < e, `${s} < ${g} < ${e}`);
  }
});

test("Spaced Repetition: Vergessen setzt zurück, zählt Fehler, Leichtigkeit hat Grenzen", () => {
  const gelernt: KartenStand = { intervall_tage: 30, leichtigkeit: 2.5, wiederholungen: 4, fehler: 0 };
  assert.deepEqual(bewerten(gelernt, 1), { intervall_tage: 0, leichtigkeit: 2.3, wiederholungen: 0, fehler: 1 });
  let schwer = gelernt;
  for (let i = 0; i < 20; i++) schwer = bewerten(schwer, 2);
  assert.equal(schwer.leichtigkeit, 1.3);
  let leicht = NEU;
  for (let i = 0; i < 30; i++) leicht = bewerten(leicht, 4);
  assert.equal(leicht.leichtigkeit, 5);
  assert.equal(leicht.intervall_tage, 3650);
});

test("Spaced Repetition: zu früh, am selben Tag und zu spät wiederholt", () => {
  const k: KartenStand = { intervall_tage: 10, leichtigkeit: 2.5, wiederholungen: 3, fehler: 0 };
  // pünktlich (nach 10 Tagen) = wie ohne Angabe
  assert.equal(bewerten(k, 3, 10).intervall_tage, 25);
  assert.equal(bewerten(k, 3, null).intervall_tage, 25);
  // nach der Hälfte der Zeit: nur der halbe Zuwachs (10 → 17,5)
  assert.equal(bewerten(k, 3, 5).intervall_tage, 18);
  // am selben Tag nochmal: kaum Veränderung, Leichtigkeit bleibt
  assert.deepEqual(bewerten(k, 3, 0), { intervall_tage: 11, leichtigkeit: 2.5, wiederholungen: 4, fehler: 0 });
  assert.equal(bewerten(k, 4, 0).leichtigkeit, 2.5);
  // 10 Tage zu spät und trotzdem gewusst: Bonus (10 + 5) × 2,5
  assert.equal(bewerten(k, 3, 20).intervall_tage, 38);
  // Reihenfolge Schwer < Gut < Einfach gilt in allen Fällen
  for (const t of [0, 1, 5, 10, 30, null]) {
    const [s2, g, e] = [2, 3, 4].map((b) => bewerten(k, b as 2 | 3 | 4, t).intervall_tage);
    assert.ok(s2 < g && g < e, `tageSeit ${t}: ${s2} < ${g} < ${e}`);
  }
});

/** Simuliert Tag für Tag: lernt eine Karte, wann immer sie fällig ist (oder jeden Tag). */
function simulieren(tage: number, antwort: (tag: number) => 2 | 3 | 4 | 1, jedenTag = false) {
  let k = NEU;
  let faellig = 0;
  let zuletzt: number | null = null;
  const lerntage: number[] = [];
  for (let tag = 0; tag < tage; tag++) {
    if (!jedenTag && tag < faellig) continue;
    k = bewerten(k, antwort(tag), zuletzt === null ? null : tag - zuletzt);
    zuletzt = tag;
    faellig = tag + Math.max(k.intervall_tage, 0);
    lerntage.push(tag);
  }
  return { k, lerntage };
}

test("Spaced Repetition: tägliche Nutzung über Wochen", () => {
  // Immer "Gut", nur fällige Karten: Abstände 2, 5, 13, 33 Tage
  const normal = simulieren(120, () => 3);
  assert.deepEqual(normal.lerntage, [0, 2, 7, 20, 53]);
  assert.equal(normal.k.leichtigkeit, 2.5);

  // Jeden Tag "Trotzdem alle lernen" mit "Gut": darf NICHT explodieren
  const taeglich = simulieren(30, () => 3, true);
  assert.equal(taeglich.lerntage.length, 30);
  // Wächst nur noch um 1–2 Tage pro Tag (ohne Korrektur wären es 2,5× pro Tag → 10 Jahre)
  assert.ok(taeglich.k.intervall_tage <= 60, `nach 30 Tagen täglich: ${taeglich.k.intervall_tage} Tage`);
  assert.equal(taeglich.k.leichtigkeit, 2.5);

  // Jeden Tag "Einfach": Leichtigkeit steigt nur langsam, Intervall bleibt im Rahmen
  const einfach = simulieren(30, () => 4, true);
  assert.ok(einfach.k.leichtigkeit < 3, `Leichtigkeit ${einfach.k.leichtigkeit}`);
  // ~3 Tage Zuwachs pro Tag statt Vervielfachung
  assert.ok(einfach.k.intervall_tage <= 100, `Intervall ${einfach.k.intervall_tage}`);

  // Einmal vergessen (an Tag 20), dann wieder "Gut": fängt kurz an und wächst wieder
  const vergessen = simulieren(150, (tag) => (tag === 20 ? 1 : 3));
  assert.equal(vergessen.k.fehler, 1);
  assert.deepEqual(vergessen.lerntage.slice(0, 6), [0, 2, 7, 20, 21, 23]);
  assert.ok(vergessen.k.leichtigkeit < 2.5);
});

test("Berlin-Kalendertage zwischen zwei Zeitpunkten", () => {
  // 23:50 → 00:10 Berlin (Winterzeit, UTC+1) = 1 Tag
  assert.equal(berlinTageZwischen(new Date("2026-11-13T22:50:00Z"), new Date("2026-11-13T23:10:00Z")), 1);
  assert.equal(berlinTageZwischen(new Date("2026-11-13T08:00:00Z"), new Date("2026-11-13T20:00:00Z")), 0);
  // über die Zeitumstellung (29.03.2026) hinweg
  assert.equal(berlinTageZwischen(new Date("2026-03-28T12:00:00Z"), new Date("2026-03-30T12:00:00Z")), 2);
  assert.equal(berlinTageZwischen(new Date("2026-11-01T12:00:00Z"), new Date("2026-12-01T12:00:00Z")), 30);
});

test("Spaced Repetition: Anzeige-Texte, Reife und alte Box", () => {
  assert.equal(intervallText(0), "10 Min.");
  assert.equal(intervallText(3), "3 T.");
  assert.equal(intervallText(21), "3 Wo.");
  assert.equal(intervallText(90), "3 Mon.");
  assert.equal(intervallText(540), "1,5 J.");
  assert.equal(reife({ intervall_tage: 0, zuletzt_gelernt: null }), "neu");
  assert.equal(reife({ intervall_tage: 0, zuletzt_gelernt: "2026-11-13T10:00:00Z" }), "lernen");
  assert.equal(reife({ intervall_tage: 5, zuletzt_gelernt: null }), "jung");
  assert.equal(reife({ intervall_tage: 40, zuletzt_gelernt: "2026-11-13T10:00:00Z" }), "sicher");
  assert.deepEqual([0, 1, 4, 10, 30].map(boxAusIntervall), [1, 2, 3, 4, 5]);
});

test("Fälligkeit und Berlin-Mitternacht", () => {
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

import { folienLesen, punkte, verschieben, designLesen } from "./praesentationen/folien.ts";

test("Präsentationen: Folien einlesen, Aufzählung, Reihenfolge", () => {
  const f = folienLesen([
    { id: "a", layout: "TITEL", titel: "Hallo", text: "Untertitel" },
    { layout: "QUATSCH", titel: 5, bild: "../../etc" },
    "kaputt",
  ]);
  assert.equal(f.length, 2);
  assert.equal(f[0].layout, "TITEL");
  assert.equal(f[1].layout, "TEXT");
  assert.equal(f[1].titel, "");
  assert.equal(f[1].bild, null);
  assert.equal(typeof f[1].id, "string");
  assert.deepEqual(folienLesen("nein"), []);
  assert.deepEqual(punkte("- Erstens\n\n• Zweitens\n  Drittens  "), ["Erstens", "Zweitens", "Drittens"]);
  assert.deepEqual(verschieben([1, 2, 3, 4], 0, 2), [2, 3, 1, 4]);
  assert.deepEqual(verschieben([1, 2, 3], 2, 0), [3, 1, 2]);
  assert.equal(designLesen("GOLD"), "GOLD");
  assert.equal(designLesen("x"), "HELL");
});

import * as mm from "./mindmap/knoten.ts";

test("MindMap: Start, Kinder, Geschwister, Verschieben, Löschen", () => {
  let d = mm.startDaten("Automaten");
  const root = mm.wurzel(d)!;
  assert.equal(root.text, "Automaten");
  const a = mm.kindHinzufuegen(d, root.id)!;
  d = a.daten;
  assert.equal(a.neu.x, mm.ABSTAND_X);
  const b = mm.kindHinzufuegen(d, root.id)!;
  d = b.daten;
  assert.equal(b.neu.y, a.neu.y + mm.ABSTAND_Y);
  const c = mm.geschwisterHinzufuegen(d, a.neu.id)!; // Enter am Kind -> weiteres Kind der Wurzel
  d = c.daten;
  assert.equal(c.neu.parent_id, root.id);
  const enkel = mm.kindHinzufuegen(d, a.neu.id)!;
  d = enkel.daten;
  assert.equal(enkel.neu.x, 2 * mm.ABSTAND_X);
  // Verschieben nimmt Kinder mit
  d = mm.verschieben(d, a.neu.id, 10, 20);
  assert.equal(d.knoten.find((k) => k.id === enkel.neu.id)!.x, 2 * mm.ABSTAND_X + 10);
  assert.equal(d.knoten.find((k) => k.id === b.neu.id)!.x, mm.ABSTAND_X);
  // Löschen nimmt Kinder mit, Wurzel nicht löschbar
  assert.equal(mm.nachkommen(d, a.neu.id).size, 1);
  assert.equal(mm.loeschen(d, root.id), null);
  d = mm.loeschen(d, a.neu.id)!;
  assert.equal(d.knoten.length, 3);
  // Einlesen repariert verwaiste Knoten
  const r = mm.datenLesen({ knoten: [{ id: "w", text: "W", x: 0, y: 0, farbe: "#d9a441", parent_id: null }, { id: "x", text: "X", x: 1, y: 1, farbe: "rot", parent_id: "weg" }] }, "N");
  assert.equal(r.knoten[1].parent_id, "w");
  assert.equal(r.knoten[1].farbe, "#d9a441");
  assert.equal(mm.datenLesen(null, "Neu").knoten[0].text, "Neu");
});

import * as wb from "./whiteboard/elemente.ts";

test("Whiteboard: Rahmen, Verschieben, Größe, Einlesen, Verlauf", () => {
  const stift: wb.Element = { id: "s", typ: "stift", farbe: "#2a2318", staerke: 2, punkte: [0, 0, 10, 5, 20, -5] };
  assert.deepEqual(wb.rahmen(stift), { x1: 0, y1: -5, x2: 20, y2: 5 });
  assert.deepEqual(wb.rahmen(wb.verschieben(stift, 5, 5)), { x1: 5, y1: 0, x2: 25, y2: 10 });
  const rect = wb.normalisieren({ id: "r", typ: "rechteck", farbe: "#2a2318", staerke: 4, x: 100, y: 100, b: -50, h: -20 });
  assert.deepEqual(wb.rahmen(rect), { x1: 50, y1: 80, x2: 100, y2: 100 });
  const groesser = wb.groesseAendern(rect, 150, 180) as wb.Form;
  assert.equal(groesser.b, 100);
  assert.equal(groesser.h, 100);
  const bild = wb.groesseAendern({ id: "b", typ: "bild", farbe: "#2a2318", staerke: 4, x: 0, y: 0, b: 200, h: 100, datei_id: "x" }, 400, 10, true) as wb.Bild;
  assert.equal(bild.b, 400);
  assert.equal(bild.h, 200);
  const linie = wb.groesseAendern({ id: "l", typ: "linie", farbe: "#2a2318", staerke: 2, x1: 0, y1: 0, x2: 1, y2: 1, pfeil: true }, 30, 40) as wb.Linie;
  assert.equal(linie.x2, 30);
  assert.equal(wb.punkteAusduennen([0, 0, 0.5, 0.5, 1, 1, 5, 5]).length, 4);
  assert.match(wb.stiftPfad([0, 0, 10, 10, 20, 0, 30, 10]), /^M 0 0 Q/);
  // Einlesen verwirft Kaputtes
  const e = wb.elementeLesen({ elemente: [stift, { typ: "boese" }, { typ: "text", text: "  " }, { typ: "bild", datei_id: "../x" }, { typ: "kreis", x: "1", farbe: "red" }] });
  assert.equal(e.length, 2);
  assert.equal(e[1].farbe, "#2a2318");
  // Verlauf auf 50 begrenzt
  let v: wb.Verlauf = { zurueck: [], vor: [[stift]] };
  for (let i = 0; i < 60; i++) v = wb.merken(v, []);
  assert.equal(v.zurueck.length, 50);
  assert.equal(v.vor.length, 0);
});
