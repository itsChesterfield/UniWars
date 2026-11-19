/**
 * Befehlspalette (Strg/⌘+O): suchen, öffnen, erstellen – wie Spotlight.
 * Reine Logik (Bewertung der Treffer, Erkennen von „neue Notiz …“), testbar.
 */

export type SuchTreffer = {
  art: string;
  id: string;
  titel: string;
  href: string;
  icon: string;
  info: string;
  ausschnitt?: { davor: string; begriff: string; danach: string };
};

/** Was sich erstellen lässt */
export type ErstellArt =
  | "deadline"
  | "abgabe"
  | "termin"
  | "gruppenarbeit"
  | "pruefung"
  | "todo"
  | "notiz"
  | "stapel"
  | "quiz"
  | "podcast"
  | "whiteboard"
  | "mindmap"
  | "dokument"
  | "tabelle"
  | "praesentation"
  | "fach"
  | "note"
  | "aufnahme";

export const ERSTELLEN: { art: ErstellArt; name: string; icon: string; woerter: string[] }[] = [
  { art: "abgabe", name: "Abgabe / Deadline", icon: "⏰", woerter: ["deadline", "abgabe", "frist", "hausarbeit", "einreichen"] },
  { art: "pruefung", name: "Prüfung", icon: "🎓", woerter: ["prüfung", "pruefung", "klausur", "exam", "test"] },
  { art: "termin", name: "Termin", icon: "📅", woerter: ["termin", "treffen", "meeting", "sprechstunde"] },
  { art: "todo", name: "To-do", icon: "✅", woerter: ["todo", "to-do", "aufgabe", "erledigen"] },
  { art: "notiz", name: "Notiz", icon: "📝", woerter: ["notiz", "mitschrift", "note taking"] },
  { art: "stapel", name: "Karteikarten-Stapel", icon: "🗂️", woerter: ["stapel", "karteikarte", "karteikarten", "flashcard"] },
  { art: "quiz", name: "Quiz", icon: "🎯", woerter: ["quiz", "abfragen"] },
  { art: "podcast", name: "Lern-Podcast", icon: "🎧", woerter: ["podcast", "anhören"] },
  { art: "whiteboard", name: "Whiteboard", icon: "🖍️", woerter: ["whiteboard", "zeichnen", "board"] },
  { art: "mindmap", name: "MindMap", icon: "🧠", woerter: ["mindmap", "mind map"] },
  { art: "dokument", name: "Dokument", icon: "📄", woerter: ["dokument", "text", "word"] },
  { art: "tabelle", name: "Tabelle", icon: "📊", woerter: ["tabelle", "excel", "sheet"] },
  { art: "praesentation", name: "Präsentation", icon: "🖥️", woerter: ["präsentation", "praesentation", "folien", "powerpoint"] },
  { art: "gruppenarbeit", name: "Gruppenarbeit", icon: "👥", woerter: ["gruppenarbeit", "gruppe", "team"] },
  { art: "fach", name: "Fach", icon: "📚", woerter: ["fach", "modul", "kurs"] },
  { art: "note", name: "Note eintragen", icon: "💯", woerter: ["note", "noten", "bewertung", "grade"] },
  { art: "aufnahme", name: "Aufnahme starten", icon: "🎙️", woerter: ["aufnahme", "aufnehmen", "transkription", "vorlesung aufnehmen"] },
];

/** Groß/klein, Umlaute und Satzzeichen egal */
export function falten(s: string, kurz = false): string {
  return s
    .toLocaleLowerCase("de-DE")
    .replace(/ä/g, kurz ? "a" : "ae")
    .replace(/ö/g, kurz ? "o" : "oe")
    .replace(/ü/g, kurz ? "u" : "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Wie gut passt `text` zur Suche? 0 = gar nicht. Ganzer Anfang > Wortanfang > enthalten > Anfangsbuchstaben.
 */
export function bewertung(text: string, suche: string): number {
  // „pruefung“ und „prufung“ finden beide „Prüfung“
  return Math.max(bewertungMit(falten(text), falten(suche)), bewertungMit(falten(text, true), falten(suche, true)));
}

function bewertungMit(t: string, q: string): number {
  if (!q) return 1;
  if (!t) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.split(" ").some((w) => w.startsWith(q))) return 60;
  if (t.includes(q)) return 40;
  // Alle Wörter der Suche kommen vor (in beliebiger Reihenfolge)
  const teile = q.split(" ");
  if (teile.length > 1 && teile.every((teil) => t.includes(teil))) return 35;
  // Anfangsbuchstaben, z. B. "kk" → "Karteikarten" nicht, aber "pr" → "PDF Reader"
  const initialen = t
    .split(" ")
    .map((w) => w[0])
    .join("");
  if (q.length >= 2 && !q.includes(" ") && initialen.startsWith(q)) return 30;
  return 0;
}

const BEHALTEN = new Set(["hausarbeit", "klausur", "exam", "test", "treffen", "meeting", "sprechstunde", "mitschrift", "gruppe", "team", "modul", "kurs", "bewertung", "vorlesung aufnehmen", "einreichen", "erledigen", "abfragen", "anhören", "zeichnen"]);

const ANFANG = /^(?:\+|neu(?:e|er|es|en)?|erstell(?:e|en)?|anlegen|leg(?:e)?\s+an|add|new|create)\s+/i;

/**
 * „neue Notiz Statistik“, „+ deadline Hausarbeit 20.12.“, „klausur Mathe am 3.2.“ → was erstellt werden soll und der Rest als Titel.
 * Ohne Signalwort am Anfang zählt nur ein Typ-Wort ganz vorne („notiz …“, „todo …“).
 */
export function absichtErkennen(eingabe: string): { art: ErstellArt; titel: string } | null {
  let rest = eingabe.trim();
  const mitSignal = ANFANG.test(rest);
  rest = rest.replace(ANFANG, "");
  const klein = rest.toLocaleLowerCase("de-DE");
  for (const e of ERSTELLEN) {
    for (const w of [...e.woerter].sort((a, b) => b.length - a.length)) {
      if (klein === w || klein.startsWith(`${w} `) || klein.startsWith(`${w}:`)) {
        // Beschreibende Wörter („Hausarbeit Soziologie“) bleiben Teil des Titels, reine Typ-Wörter („notiz …“) nicht
        const titel = (BEHALTEN.has(w) ? rest : rest.slice(w.length)).replace(/^[:\s-]+/, "").trim();
        // ohne Signalwort nur, wenn danach noch ein Titel kommt (sonst ist es eher eine Suche)
        if (!mitSignal && !titel) return null;
        return { art: e.art, titel };
      }
    }
  }
  return null;
}

export const MAX_ZULETZT = 6;

/** Zuletzt gewählte Treffer (für die leere Palette), ohne Doppelte, neueste zuerst */
export function zuletztAktualisieren(liste: SuchTreffer[], neu: SuchTreffer): SuchTreffer[] {
  return [neu, ...liste.filter((x) => !(x.art === neu.art && x.id === neu.id))].slice(0, MAX_ZULETZT);
}
