/**
 * Lernraum (wie NotebookLM): Antworten aus den Quellen eines Fachs – mit Belegen,
 * erkennbarer Absicht, Lernprofil und Studio-Erzeugnissen. Reine Logik, testbar.
 */
import { einbetten, MATERIAL_REGEL, markerEntschaerfen } from "./material.ts";
import { alsObjekt, jsonLesen, text } from "./json.ts";
import { relevanz } from "./pdf-kontext.ts";

// ---------------------------------------------------------------------------
// Quellen und Kontext
// ---------------------------------------------------------------------------

export type LernQuelle = {
  /** Nummer im Lernraum (Q1, Q2 …) */
  nr: number;
  art: "pdf" | "notiz";
  id: string;
  titel: string;
  /** PDF: Text je Seite; Notiz: Abschnitte als "Seiten" ohne Seitenzahl */
  abschnitte: { seite: number; text: string }[];
};

/** Höchstmenge Quelltext pro Anfrage: "ganz" ≈ 115.000 Tokens (Kostenbremse), "auswahl" ≈ 23.000 */
export const MAX_KONTEXT_GANZ = 400_000;
export const MAX_KONTEXT_AUSWAHL = 80_000;
export const MAX_FRAGE = 2000;

/** Notizen in Abschnitte teilen (für die Auswahl), ~3.000 Zeichen je Abschnitt an Absatzgrenzen */
export function notizAbschnitte(inhalt: string, groesse = 3000): { seite: number; text: string }[] {
  const absaetze = inhalt.split(/\n{2,}/);
  const teile: string[] = [];
  let aktuell = "";
  for (const a of absaetze) {
    if (aktuell && aktuell.length + a.length > groesse) {
      teile.push(aktuell);
      aktuell = "";
    }
    aktuell += (aktuell ? "\n\n" : "") + a;
  }
  if (aktuell.trim()) teile.push(aktuell);
  return teile.map((t, i) => ({ seite: i + 1, text: t }));
}

export function quellenUmfang(quellen: LernQuelle[]): number {
  return quellen.reduce((n, q) => n + q.abschnitte.reduce((m, a) => m + a.text.length, 0), 0);
}

type Stueck = { q: LernQuelle; seite: number; text: string; schluessel: number };

/**
 * Kontext zusammenstellen. Passt alles ins Budget, geht alles mit (wie NotebookLM).
 * Sonst: relevanteste Seiten zur Frage (+ Nachbarseiten), bis das Budget voll ist.
 */
export function kontextBauen(
  quellen: LernQuelle[],
  frage: string,
  budget: number,
  /** Seiten, die auf jeden Fall mitgehen (z. B. die gerade offene PDF-Seite ± 1) */
  bevorzugt: { quelle: number; seiten: number[] }[] = [],
): { text: string; umfang: "ganz" | "auswahl"; zeichen: number; seiten: Record<number, number[]> } {
  const stuecke: Stueck[] = [];
  for (const q of quellen) for (const a of q.abschnitte) if (a.text.trim()) stuecke.push({ q, seite: a.seite, text: a.text.trim(), schluessel: stuecke.length });

  let auswahl: Stueck[];
  let umfang: "ganz" | "auswahl" = "ganz";
  if (stuecke.reduce((n, s) => n + s.text.length, 0) <= budget) {
    auswahl = stuecke;
  } else {
    umfang = "auswahl";
    const punkte = relevanz(
      stuecke.map((s) => ({ seite: s.schluessel, text: s.text })),
      frage,
    );
    const sortiert = [...stuecke].sort((a, b) => (punkte.get(b.schluessel) ?? 0) - (punkte.get(a.schluessel) ?? 0));
    const gewaehlt = new Set<number>();
    let rest = budget;
    const nehmen = (s: Stueck | undefined) => {
      if (!s || gewaehlt.has(s.schluessel) || s.text.length > rest) return;
      gewaehlt.add(s.schluessel);
      rest -= s.text.length;
    };
    for (const b of bevorzugt) for (const seite of b.seiten) nehmen(stuecke.find((x) => x.q.nr === b.quelle && x.seite === seite));
    for (const s of sortiert) {
      if (rest <= 0) break;
      if ((punkte.get(s.schluessel) ?? 0) <= 0 && gewaehlt.size > 0) break;
      nehmen(s);
      // Nachbarseiten derselben Quelle für Zusammenhang
      nehmen(stuecke.find((x) => x.q === s.q && x.seite === s.seite - 1));
      nehmen(stuecke.find((x) => x.q === s.q && x.seite === s.seite + 1));
    }
    // Ohne Treffer: Anfang jeder Quelle (Überblick)
    if (gewaehlt.size === 0) for (const s of stuecke) nehmen(s);
    auswahl = stuecke.filter((s) => gewaehlt.has(s.schluessel));
  }

  const seiten: Record<number, number[]> = {};
  const bloecke: string[] = [];
  for (const q of quellen) {
    const teile = auswahl.filter((s) => s.q === q);
    if (!teile.length) continue;
    seiten[q.nr] = teile.map((t) => t.seite);
    const titel = markerEntschaerfen(q.titel).replace(/"/g, "'");
    const inhalt = teile
      .map((t) => (q.art === "pdf" ? einbetten(t.text, "seite", { nr: t.seite }) : markerEntschaerfen(t.text)))
      .join("\n");
    bloecke.push(`<quelle nr="${q.nr}" art="${q.art}" titel="${titel}">\n${inhalt}\n</quelle>`);
  }
  return { text: bloecke.join("\n\n"), umfang, zeichen: auswahl.reduce((n, s) => n + s.text.length, 0), seiten };
}

// ---------------------------------------------------------------------------
// Absicht erkennen (kleines Modell) – die KI stellt sich auf den Wunsch ein
// ---------------------------------------------------------------------------

export const MODI = ["erklaeren", "frage", "zusammenfassen", "vergleich", "pruefung", "lernplan", "quiz", "karteikarten", "plaudern"] as const;
export type Modus = (typeof MODI)[number];

export type Absicht = {
  modus: Modus;
  /** braucht einen Überblick über die ganzen Quellen (z. B. "fasse alles zusammen") */
  ganz: boolean;
  /** Websuche sinnvoll (aktuell, außerhalb des Skripts, ausdrücklicher Recherchewunsch) */
  web: boolean;
  /** dauerhafter Wunsch an die Erklärweise ("erklär immer mit Beispielen") */
  vorliebe: string | null;
};

export function absichtPrompt(frage: string, vorherigeFrage: string | null) {
  return {
    system: [
      "Du ordnest Nachrichten von Studierenden an ihren Lernbegleiter ein. Antworte NUR mit JSON:",
      `{"modus": ${MODI.map((m) => `"${m}"`).join("|")}, "ganz": boolean, "web": boolean, "vorliebe": string|null}`,
      "modus: erklaeren = etwas verstehen wollen; frage = konkrete Faktenfrage; zusammenfassen; vergleich = Unterschiede/Gemeinsamkeiten;",
      "pruefung = Prüfungsvorbereitung/was ist wichtig; lernplan = Lernen planen; quiz = abgefragt werden wollen; karteikarten = Karteikarten erstellen; plaudern = Smalltalk/Dank.",
      "ganz: true, wenn die Antwort einen Überblick über das ganze Material braucht (alles zusammenfassen, was kommt dran, Kapitelübersicht).",
      "web: true NUR bei ausdrücklichem Recherchewunsch (recherchiere, such im Internet, aktuelle Infos, Quellen aus dem Netz) oder klar aktuellen Themen (Gesetzesstand, Zahlen dieses Jahres, Neuigkeiten).",
      "vorliebe: nur wenn der Nutzer dauerhaft eine Erklärweise wünscht (z. B. 'erklär mir immer mit Beispielen', 'antworte kürzer'), als kurzer Satz; sonst null.",
    ].join("\n"),
    nutzer: `${vorherigeFrage ? `Vorherige Nachricht: ${vorherigeFrage.slice(0, 300)}\n` : ""}Nachricht: ${frage.slice(0, 1000)}`,
  };
}

/** Grobe Einschätzung ohne KI (Ersatz, falls die Einordnung scheitert) */
export function absichtSchaetzen(frage: string): Absicht {
  const f = frage.toLowerCase();
  const modus: Modus = /quiz|frag mich|abfragen|teste mich/.test(f)
    ? "quiz"
    : /karteikarte/.test(f)
      ? "karteikarten"
      : /zusammenfass|überblick|ueberblick/.test(f)
        ? "zusammenfassen"
        : /unterschied|vergleich|gegenüber/.test(f)
          ? "vergleich"
          : /prüfung|pruefung|klausur|was kommt dran/.test(f)
            ? "pruefung"
            : /lernplan|wie lerne|plan/.test(f)
              ? "lernplan"
              : /erklär|erklaer|versteh|wie funktioniert|warum/.test(f)
                ? "erklaeren"
                : "frage";
  return {
    modus,
    ganz: /alles|ganze|gesamte|komplett|überblick|was kommt dran/.test(f) || modus === "pruefung",
    web: /recherchier|internet|im netz|online|aktuell/.test(f),
    vorliebe: null,
  };
}

export function absichtLesen(antwort: string, frage: string): Absicht {
  const o = alsObjekt(jsonLesen(antwort));
  const ersatz = absichtSchaetzen(frage);
  const modus = (MODI as readonly string[]).includes(String(o.modus)) ? (o.modus as Modus) : ersatz.modus;
  const vorliebe = text(o.vorliebe, 200) || null;
  return {
    modus,
    ganz: typeof o.ganz === "boolean" ? o.ganz : ersatz.ganz,
    web: typeof o.web === "boolean" ? o.web : ersatz.web,
    vorliebe,
  };
}

// ---------------------------------------------------------------------------
// Lernprofil – wie die KI erklären soll
// ---------------------------------------------------------------------------

export type Lernprofil = {
  laenge: "kurz" | "normal" | "ausfuehrlich";
  niveau: "einfach" | "normal" | "fortgeschritten";
  beispiele: boolean;
  /** dauerhafte Wünsche in eigenen Worten (höchstens 8) */
  hinweise: string[];
};

export const PROFIL_STANDARD: Lernprofil = { laenge: "normal", niveau: "normal", beispiele: true, hinweise: [] };

export function profilLesen(roh: unknown): Lernprofil {
  const o = alsObjekt(roh);
  return {
    laenge: o.laenge === "kurz" || o.laenge === "ausfuehrlich" ? o.laenge : "normal",
    niveau: o.niveau === "einfach" || o.niveau === "fortgeschritten" ? o.niveau : "normal",
    beispiele: typeof o.beispiele === "boolean" ? o.beispiele : true,
    hinweise: Array.isArray(o.hinweise) ? o.hinweise.map((h) => text(h, 200)).filter(Boolean).slice(-8) : [],
  };
}

export type Rueckmeldung = "einfacher" | "schwieriger" | "kuerzer" | "ausfuehrlicher" | "beispiele" | "gut" | "schlecht";

/** Rückmeldung unter einer Antwort ins Profil übernehmen */
export function profilAnpassen(p: Lernprofil, r: Rueckmeldung, vorliebe?: string | null): Lernprofil {
  const neu = { ...p, hinweise: [...p.hinweise] };
  if (r === "einfacher") neu.niveau = p.niveau === "fortgeschritten" ? "normal" : "einfach";
  if (r === "schwieriger") neu.niveau = p.niveau === "einfach" ? "normal" : "fortgeschritten";
  if (r === "kuerzer") neu.laenge = p.laenge === "ausfuehrlich" ? "normal" : "kurz";
  if (r === "ausfuehrlicher") neu.laenge = p.laenge === "kurz" ? "normal" : "ausfuehrlich";
  if (r === "beispiele") neu.beispiele = true;
  if (vorliebe && !neu.hinweise.some((h) => h.toLowerCase() === vorliebe.toLowerCase())) neu.hinweise = [...neu.hinweise, vorliebe].slice(-8);
  return neu;
}

export function profilText(p: Lernprofil): string {
  const laenge = { kurz: "Halte dich kurz und auf den Punkt.", normal: "Mittlere Länge.", ausfuehrlich: "Erkläre ausführlich und gründlich." }[p.laenge];
  const niveau = {
    einfach: "Erkläre sehr einfach, ohne Fachjargon (oder erkläre jeden Fachbegriff), wie für Erstsemester.",
    normal: "Erkläre auf Uni-Niveau, Fachbegriffe kurz erklären.",
    fortgeschritten: "Der Nutzer ist fortgeschritten: präzise Fachsprache, keine Grundlagen wiederholen.",
  }[p.niveau];
  return [laenge, niveau, p.beispiele ? "Nutze konkrete Beispiele." : "", ...p.hinweise.map((h) => `Wunsch des Nutzers: ${h}`)].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Antwort-Prompt
// ---------------------------------------------------------------------------

export const FORMAT: Record<Modus, string> = {
  erklaeren: "Erkläre Schritt für Schritt: erst die Kernidee in 1–2 Sätzen, dann die Details, ein konkretes Beispiel, zum Schluss „**Kurz gesagt:**“ mit einem Satz.",
  frage: "Beantworte die Frage direkt im ersten Satz, danach die wichtigsten Details.",
  zusammenfassen: "Fasse mit Zwischenüberschriften (##) und Stichpunkten zusammen; das Wichtigste zuerst.",
  vergleich: "Vergleiche in einer Markdown-Tabelle (Kriterien als Zeilen), danach 2–3 Sätze Fazit.",
  pruefung: "Zeig, was prüfungsrelevant ist: Kernthemen, typische Aufgaben/Fragen, häufige Fehler, eine kurze Checkliste (- [ ]).",
  lernplan: "Erstelle einen konkreten Lernplan als Checkliste (- [ ]) mit Reihenfolge und Zeitschätzung je Schritt, an den Quellen orientiert.",
  quiz: "Stelle 5 Fragen zum Material (nummeriert); die Lösungen kommen erst ganz am Ende unter „**Lösungen**“.",
  karteikarten: "Erstelle 8 Karteikarten als Tabelle | Vorderseite | Rückseite |.",
  plaudern: "Antworte freundlich und kurz.",
};

export function antwortPrompt({
  fach,
  quellen,
  kontext,
  umfang,
  modus,
  profil,
  web,
}: {
  fach: string;
  quellen: LernQuelle[];
  kontext: string;
  umfang: "ganz" | "auswahl";
  modus: Modus;
  profil: Lernprofil;
  web: boolean;
}): string {
  const liste = quellen.map((q) => `Q${q.nr}: ${markerEntschaerfen(q.titel)} (${q.art === "pdf" ? "PDF" : "Notiz"})`).join("\n");
  return [
    `Du bist der Lernbegleiter im Lernraum für das Fach „${markerEntschaerfen(fach)}“. Du arbeitest wie NotebookLM: Grundlage sind die Quellen des Nutzers.`,
    "",
    "Regeln:",
    "1. Stütze dich zuerst auf die Quellen. Belege jede Aussage aus den Quellen direkt dahinter: [Q1 S. 12] bei PDFs (Seitenzahl aus <seite nr>), [Q2] bei Notizen. Nutze nur Nummern aus der Quellenliste, erfinde keine Belege.",
    "2. Reichen die Quellen nicht, ergänze dein eigenes Fachwissen, damit die Erklärung vollständig und verständlich wird – markiere solche Sätze am Ende mit [Ergänzt]. Widerspricht dein Wissen den Quellen, weise darauf hin.",
    web ? "3. Du darfst im Web recherchieren. Kennzeichne Erkenntnisse aus dem Web mit [Web] und nenne die Seite." : "3. Keine Websuche in dieser Antwort.",
    "4. Antworte auf Deutsch (oder in der Sprache der Frage), mit Markdown (Überschriften, Listen, **fett**, Tabellen).",
    umfang === "auswahl" ? "5. Du siehst nur die zur Frage passenden Seiten, nicht das ganze Material – sag das, wenn es für die Antwort wichtig ist." : "5. Du siehst das ganze Material.",
    "",
    `Format: ${FORMAT[modus]}`,
    `Erklärweise: ${profilText(profil)}`,
    "",
    MATERIAL_REGEL,
    "",
    "Quellenliste:",
    liste || "(keine Quellen – dann aus eigenem Wissen antworten und alles mit [Ergänzt] markieren)",
    "",
    kontext,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Belege in Antworten: [Q1 S. 12], [Q1 S. 12–14], [Q2], [Ergänzt], [Web]
// ---------------------------------------------------------------------------

export type Beleg = { quelle: number; seite: number | null; label: string };

const BELEG_MUSTER = /\[(Q\d+(?:\s*(?:S\.|Seite)?\s*\d+(?:\s*[–-]\s*\d+)?)?(?:\s*[,;]\s*Q?\d+(?:\s*(?:S\.|Seite)?\s*\d+(?:\s*[–-]\s*\d+)?)?)*)\]/g;

/** Alle Belege im Text (für Zählung und Links) */
export function belegeFinden(antwort: string): Beleg[] {
  const liste: Beleg[] = [];
  for (const m of antwort.matchAll(BELEG_MUSTER)) {
    let aktuelleQuelle = 0;
    for (const teil of m[1].split(/\s*[,;]\s*/)) {
      const t = /^(?:Q(\d+))?\s*(?:(?:S\.|Seite)?\s*(\d+)(?:\s*[–-]\s*(\d+))?)?$/.exec(teil.trim());
      if (!t) continue;
      if (t[1]) aktuelleQuelle = Number(t[1]);
      if (!aktuelleQuelle) continue;
      const seite = t[2] ? Number(t[2]) : null;
      liste.push({ quelle: aktuelleQuelle, seite, label: seite ? `S. ${t[2]}${t[3] ? `–${t[3]}` : ""}` : "" });
    }
  }
  return liste;
}

/**
 * Für die Anzeige: Belege werden zu Links (#beleg-Q-S), [Ergänzt]/[Web] zu Markierungen.
 * Der Markdown-Renderer zeigt sie als Chips; Klick öffnet die Quelle.
 */
export function belegeVerlinken(antwort: string, titelVon: (nr: number) => string | null): string {
  return antwort
    .replace(BELEG_MUSTER, (ganz, inhalt: string) => {
      const belege = belegeFinden(`[${inhalt}]`);
      if (!belege.length) return ganz;
      return belege
        .map((b) => {
          const titel = titelVon(b.quelle);
          if (!titel) return "";
          const kurz = titel.replace(/\.pdf$/i, "").slice(0, 28);
          return `[${kurz}${b.label ? ` · ${b.label}` : ""}](#beleg-${b.quelle}-${b.seite ?? 0})`;
        })
        .filter(Boolean)
        .join(" ");
    })
    .replace(/\[Ergänzt\]/gi, "[ergänzt](#ergaenzt)")
    .replace(/\[Web\]/gi, "[web](#web)");
}

// ---------------------------------------------------------------------------
// Überblick je Quelle (Source Guide) und Studio
// ---------------------------------------------------------------------------

export type Ueberblick = { zusammenfassung: string; themen: string[]; fragen: string[] };

export function ueberblickPrompt(titel: string, inhalt: string) {
  return {
    system: [
      "Du erstellst einen Überblick über eine Lernquelle eines Studierenden. Antworte NUR mit JSON:",
      '{"zusammenfassung": string (3–5 Sätze), "themen": string[] (4–8 Kernthemen, je 1–4 Wörter), "fragen": string[] (3 gute Fragen, die man zu dieser Quelle stellen könnte)}',
      "Sprache wie die Quelle. Nur Inhalte aus der Quelle.",
      MATERIAL_REGEL,
    ].join("\n"),
    nutzer: `Quelle: ${markerEntschaerfen(titel)}\n\n${einbetten(inhalt, "quelle")}`,
  };
}

export function ueberblickLesen(antwort: string): Ueberblick | null {
  const o = alsObjekt(jsonLesen(antwort));
  const zusammenfassung = text(o.zusammenfassung, 1500);
  if (!zusammenfassung) return null;
  const liste = (w: unknown, max: number, n: number) => (Array.isArray(w) ? w.map((x) => text(x, max)).filter(Boolean).slice(0, n) : []);
  return { zusammenfassung, themen: liste(o.themen, 60, 8), fragen: liste(o.fragen, 200, 4) };
}

export const STUDIO = {
  lernzettel: { name: "Lernzettel", icon: "📄", json: false },
  faq: { name: "FAQ", icon: "❓", json: false },
  briefing: { name: "Briefing", icon: "🧭", json: false },
  zeitleiste: { name: "Zeitleiste", icon: "🕒", json: false },
  quiz: { name: "Quiz", icon: "🎯", json: true },
  karteikarten: { name: "Karteikarten", icon: "🗂️", json: true },
} as const;
export type StudioArt = keyof typeof STUDIO;

export function istStudioArt(wert: unknown): wert is StudioArt {
  return typeof wert === "string" && wert in STUDIO;
}

const STUDIO_AUFTRAG: Record<StudioArt, string> = {
  lernzettel:
    "Erstelle einen Lernzettel (Markdown): Überschriften je Thema, die wichtigsten Definitionen fett, Formeln, Merksätze als > [!merke]-Box, am Ende eine Checkliste „Kann ich das?“ (- [ ]).",
  faq: "Erstelle ein FAQ (Markdown): 8–12 Fragen als ### Überschrift, darunter je eine prägnante Antwort.",
  briefing: "Erstelle ein Briefing (Markdown): ## Worum es geht (3 Sätze), ## Die wichtigsten Punkte (Stichpunkte), ## Zusammenhänge, ## Offene Fragen / Lücken im Material.",
  zeitleiste: "Erstelle eine Zeitleiste bzw. Ablaufübersicht (Markdown-Tabelle | Zeitpunkt/Schritt | Ereignis/Inhalt |). Gibt es keine zeitliche Abfolge, ordne die Inhalte in der logischen Reihenfolge des Stoffs.",
  quiz: 'Erstelle ein Quiz mit 8 Multiple-Choice-Fragen. NUR JSON: {"fragen":[{"frage":string,"optionen":[4 strings],"richtig":0-3,"erklaerung":string,"beleg":"Q1 S. 3"}]}',
  karteikarten: 'Erstelle 12 Karteikarten. NUR JSON: {"karten":[{"vorderseite":string,"rueckseite":string,"beleg":"Q1 S. 3"}]}',
};

export function studioPrompt(art: StudioArt, fach: string, quellen: LernQuelle[], kontext: string, profil: Lernprofil) {
  const liste = quellen.map((q) => `Q${q.nr}: ${markerEntschaerfen(q.titel)}`).join("\n");
  return {
    system: [
      `Du erstellst Lernmaterial für das Fach „${markerEntschaerfen(fach)}“ aus den Quellen eines Studierenden (wie NotebookLM).`,
      STUDIO_AUFTRAG[art],
      STUDIO[art].json ? "" : "Belege Aussagen mit [Q1 S. 12] bzw. [Q2]. Ergänzt du eigenes Wissen, markiere es mit [Ergänzt].",
      `Erklärweise: ${profilText(profil)}`,
      "Sprache: Deutsch (oder die Sprache der Quellen).",
      MATERIAL_REGEL,
    ]
      .filter(Boolean)
      .join("\n"),
    nutzer: `Quellenliste:\n${liste}\n\n${kontext}`,
  };
}

export type QuizFrage = { frage: string; optionen: string[]; richtig: number; erklaerung: string; beleg: string };
export type Karte = { vorderseite: string; rueckseite: string; beleg: string };

export function quizLesen(antwort: string): QuizFrage[] {
  const roh = alsObjekt(jsonLesen(antwort)).fragen;
  if (!Array.isArray(roh)) return [];
  return roh
    .map((r) => {
      const o = alsObjekt(r);
      const optionen = Array.isArray(o.optionen) ? o.optionen.map((x) => text(x, 300)).filter(Boolean).slice(0, 4) : [];
      const richtig = Number(o.richtig);
      return { frage: text(o.frage, 500), optionen, richtig, erklaerung: text(o.erklaerung, 800), beleg: text(o.beleg, 40) };
    })
    .filter((f) => f.frage && f.optionen.length >= 2 && Number.isInteger(f.richtig) && f.richtig >= 0 && f.richtig < f.optionen.length)
    .slice(0, 15);
}

export function kartenLesen(antwort: string): Karte[] {
  const roh = alsObjekt(jsonLesen(antwort)).karten;
  if (!Array.isArray(roh)) return [];
  return roh
    .map((r) => {
      const o = alsObjekt(r);
      return { vorderseite: text(o.vorderseite, 500), rueckseite: text(o.rueckseite, 1500), beleg: text(o.beleg, 40) };
    })
    .filter((k) => k.vorderseite && k.rueckseite)
    .slice(0, 30);
}

/** Belege in Wikilinks umwandeln, damit "Als Notiz speichern" auf die Quellen verlinkt */
export function belegeAlsWikilinks(markdown: string, quellen: { nr: number; art: "pdf" | "notiz"; titel: string }[]): string {
  return markdown
    .replace(BELEG_MUSTER, (ganz, inhalt: string) => {
      const belege = belegeFinden(`[${inhalt}]`);
      const teile = belege
        .map((b) => {
          const q = quellen.find((x) => x.nr === b.quelle);
          if (!q) return "";
          return q.art === "pdf" && b.seite ? `[[${q.titel}#S${b.seite}]]` : `[[${q.titel}]]`;
        })
        .filter(Boolean);
      return teile.length ? `(${teile.join(", ")})` : ganz;
    })
    .replace(/\s*\[Ergänzt\]/gi, " *(ergänzt)*")
    .replace(/\s*\[Web\]/gi, " *(Web)*");
}
