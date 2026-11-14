/**
 * KI-00: Fehlerarten der KI-Schicht. Jeder Fehler trägt eine fertige deutsche
 * Meldung für den Nutzer und einen Typ für Analytics (ohne Inhalte).
 */

export type KiFehlerTyp =
  | "limit"
  | "ausgelastet"
  | "keine_karten"
  | "keine_daten"
  | "technisch"
  | "einwilligung"
  | "eingabe"
  | "zu_komplex"
  | "abgebrochen";

export class KiFehler extends Error {
  readonly nutzerMeldung: string;
  readonly typ: KiFehlerTyp;

  constructor(nutzerMeldung: string, typ: KiFehlerTyp, intern?: string) {
    super(intern ?? nutzerMeldung);
    this.name = new.target.name;
    this.nutzerMeldung = nutzerMeldung;
    this.typ = typ;
  }
}

const NICHT_VERFUEGBAR = "KI ist gerade nicht verfügbar.";

/** HTTP 429 vom Anbieter */
export class KiAusgelastet extends KiFehler {
  constructor() {
    super("Die KI ist gerade ausgelastet. Bitte versuch es in einer Minute erneut.", "ausgelastet");
  }
}

/** Key fehlt oder wird abgelehnt (401/403) – Details nur ins Server-Log */
export class KiKonfiguration extends KiFehler {
  constructor(intern: string) {
    super(NICHT_VERFUEGBAR, "technisch", intern);
  }
}

export class KiZeitueberschreitung extends KiFehler {
  constructor() {
    super("Die KI hat zu lange gebraucht. Versuch es mit einer kürzeren Notiz.", "technisch");
  }
}

/** HTTP 5xx, Netzwerkfehler oder unbrauchbare Antwort */
export class KiNichtVerfuegbar extends KiFehler {
  constructor(intern: string) {
    super(NICHT_VERFUEGBAR, "technisch", intern);
  }
}

export class KiKeineKarten extends KiFehler {
  constructor() {
    super("Aus dieser Notiz konnten keine Karteikarten erstellt werden.", "keine_karten");
  }
}

export class KiLimitErreicht extends KiFehler {
  constructor(limit: number, meldung?: string) {
    super(meldung ?? `Du hast dein KI-Limit für heute erreicht (${limit} Anfragen). Morgen geht es weiter.`, "limit");
  }
}

export class KiKeineEinwilligung extends KiFehler {
  /** Welche Einwilligung fehlt: Text-KI (KI-D1) oder zusätzlich Audio (KI-D2) */
  readonly art: "text" | "audio";
  constructor(art: "text" | "audio" = "text") {
    super(
      art === "audio"
        ? "Bitte bestätige zuerst, dass deine Aufnahmen zur Umwandlung an die KI gehen dürfen."
        : "Bitte bestätige zuerst, dass du die KI-Funktionen nutzen möchtest.",
      "einwilligung",
    );
    this.art = art;
  }
}

/** Ungültige Eingabe des Nutzers (z. B. Notiz zu kurz) – verbraucht keine Anfrage */
export class KiEingabe extends KiFehler {
  constructor(nutzerMeldung: string) {
    super(nutzerMeldung, "eingabe");
  }
}

/** Tool-Schleife hat nach der Höchstzahl an Runden noch keine Antwort */
export class KiZuKomplex extends KiFehler {
  constructor() {
    super("Das war zu kompliziert, versuch es mit einer kürzeren Frage.", "zu_komplex");
  }
}

/** Antwort wurde mittendrin abgebrochen (Netz, Timeout) – bisheriger Text bleibt erhalten */
export class KiAbgebrochen extends KiFehler {
  constructor(intern: string) {
    super("Die Antwort wurde unterbrochen. Bitte versuch es noch einmal.", "abgebrochen", intern);
  }
}

/** Das Material gibt für diese Funktion nichts her (KI-ALL-11: nichts erfinden) */
export class KiKeineDaten extends KiFehler {
  constructor(nutzerMeldung: string) {
    super(nutzerMeldung, "keine_daten");
  }
}
