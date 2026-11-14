import { test } from "node:test";
import assert from "node:assert/strict";
import {
  absaetzeAlsText,
  absaetzeBilden,
  absaetzeLesen,
  aufnahmeFormat,
  aufnahmeName,
  gesamtStatus,
  haengt,
  naechsterTeil,
  notizTitel,
  offeneSekunden,
  textTeilen,
  zeitText,
  type TeilInfo,
} from "./transkript.ts";

const JETZT = Date.parse("2026-11-13T12:00:00Z");
const teil = (nr: number, status: TeilInfo["status"], gestartet: number | null = null, sekunden = 600): TeilInfo => ({
  nr,
  status,
  gestartet_am: gestartet === null ? null : new Date(JETZT - gestartet).toISOString(),
  sekunden,
});

test("Transkription: Zeitanzeige", () => {
  assert.equal(zeitText(0), "0:00");
  assert.equal(zeitText(65.7), "1:05");
  assert.equal(zeitText(3723), "1:02:03");
});

test("Transkription: Gesamtstatus aus Teilen, hängende Teile zählen als Fehler", () => {
  assert.equal(gesamtStatus([], JETZT), "ausstehend");
  assert.equal(gesamtStatus([teil(1, "fertig"), teil(2, "fertig")], JETZT), "fertig");
  assert.equal(gesamtStatus([teil(1, "fertig"), teil(2, "ausstehend")], JETZT), "in_bearbeitung");
  assert.equal(gesamtStatus([teil(1, "in_bearbeitung", 60_000)], JETZT), "in_bearbeitung");
  assert.equal(haengt(teil(1, "in_bearbeitung", 7 * 60_000), JETZT), true);
  assert.equal(gesamtStatus([teil(1, "in_bearbeitung", 7 * 60_000)], JETZT), "fehler");
  assert.equal(gesamtStatus([teil(1, "fehler"), teil(2, "ausstehend")], JETZT), "fehler");
});

test("Transkription: nächster Teil in Reihenfolge, offene Sekunden", () => {
  const teile = [teil(2, "ausstehend", null, 300), teil(1, "fertig"), teil(3, "fehler", null, 120)];
  assert.equal(naechsterTeil(teile, JETZT)?.nr, 2);
  assert.equal(naechsterTeil([teil(1, "fertig"), teil(2, "in_bearbeitung", 1000)], JETZT), null);
  assert.equal(offeneSekunden(teile, JETZT), 420);
});

test("Transkription: Absätze aus Segmenten (Pause, Länge, Satzende nach 45 s)", () => {
  const absaetze = absaetzeBilden([
    {
      nr: 2,
      text: "",
      segmente: [{ start: 0, ende: 4, text: "Zweiter Teil beginnt." }],
    },
    {
      nr: 1,
      text: "",
      segmente: [
        { start: 0, ende: 5, text: "Willkommen zur Vorlesung." },
        { start: 5.5, ende: 20, text: "Heute geht es um Inflation" },
        { start: 20.2, ende: 50, text: "und wie man sie misst." },
        { start: 50.1, ende: 60, text: "Der VPI ist ein Preisindex." },
        { start: 64, ende: 70, text: "Nach der Pause: Geldpolitik." },
      ],
    },
  ]);
  assert.deepEqual(
    absaetze.map((a) => [a.teil, a.start, a.text]),
    [
      [1, 0, "Willkommen zur Vorlesung. Heute geht es um Inflation und wie man sie misst."],
      [1, 50.1, "Der VPI ist ein Preisindex."],
      [1, 64, "Nach der Pause: Geldpolitik."],
      [2, 0, "Zweiter Teil beginnt."],
    ],
  );
  assert.equal(absaetze[0].ende, 50);
});

test("Transkription: ohne Segmente wird an Satzgrenzen geteilt", () => {
  const text = "Erster Satz. ".repeat(80);
  const absaetze = absaetzeBilden([{ nr: 1, text, segmente: [] }]);
  assert.ok(absaetze.length >= 2);
  assert.ok(absaetze.every((a) => a.start === null && a.text.length <= 700));
  assert.equal(absaetzeAlsText(absaetze).replace(/\s+/g, " "), text.trim());
});

test("Transkription: textTeilen hält die Höchstlänge ein, auch ohne Satzzeichen", () => {
  const stuecke = textTeilen("wort ".repeat(500), 300);
  assert.ok(stuecke.every((s) => s.length <= 300));
  assert.equal(stuecke.join(" ").split(" ").length, 500);
});

test("Transkription: Absätze vom Browser werden geprüft", () => {
  assert.deepEqual(absaetzeLesen([{ teil: 1, start: 2, ende: 3, text: "a" }]), [{ teil: 1, start: 2, ende: 3, text: "a" }]);
  assert.deepEqual(absaetzeLesen([{ teil: 1, start: "x", ende: -1, text: "a" }]), [{ teil: 1, start: null, ende: null, text: "a" }]);
  assert.equal(absaetzeLesen([{ teil: 0, text: "a" }]), null);
  assert.equal(absaetzeLesen([{ teil: 1, text: 5 }]), null);
  assert.equal(absaetzeLesen("x"), null);
  assert.equal(absaetzeLesen([{ teil: 1, text: "x".repeat(20) }], 10), null);
});

test("Transkription: Titel und Dateinamen", () => {
  const d = new Date("2026-11-13T13:03:00Z");
  assert.equal(notizTitel("Mathe 1", d), "Transkript – Mathe 1 – 13.11.2026");
  assert.equal(notizTitel(null, d, "Mitschrift"), "Mitschrift – 13.11.2026");
  assert.equal(aufnahmeName(d, 1, "webm"), "Aufnahme 13.11.2026 14-03.webm");
  assert.equal(aufnahmeName(d, 3, "m4a"), "Aufnahme 13.11.2026 14-03 (Teil 3).m4a");
});

test("Transkription: Aufnahmeformat nach Browser", () => {
  assert.deepEqual(aufnahmeFormat((m) => m.startsWith("audio/webm")), { mime: "audio/webm;codecs=opus", endung: "webm" });
  assert.deepEqual(aufnahmeFormat((m) => m === "audio/mp4"), { mime: "audio/mp4", endung: "m4a" });
  assert.equal(aufnahmeFormat(() => false), null);
});
