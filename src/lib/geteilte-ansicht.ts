/**
 * Geteilte Ansicht: zwei Hubs nebeneinander oder übereinander (wie Windows Snap).
 * Hier nur die reine Logik ohne DOM, damit sie testbar bleibt.
 */

/** Auf welcher Seite des Bildschirms der zweite Hub liegt. */
export type Seite = "links" | "rechts" | "oben" | "unten";

export type Aufteilung = {
  /** Pfad des zweiten Hubs, z. B. "/notizen?id=…" */
  href: string;
  seite: Seite;
  /** Anteil des zweiten Hubs an der Fläche, 0.2 … 0.8 */
  anteil: number;
};

/** Datentyp beim Ziehen eines Hubs aus der Sidebar. */
export const HUB_DRAG_TYP = "application/x-uniwars-hub";
/** Datentyp beim Ziehen einer Markierung (z. B. aus dem PDF Reader in eine Notiz). */
export const ZITAT_DRAG_TYP = "application/x-uniwars-zitat";
/** Name des iframes für den zweiten Hub – bleibt bei Navigation im Frame erhalten. */
export const FRAME_NAME = "uniwars-zweite-ansicht";
/** Nachricht des zweiten Hubs an das Hauptfenster, wenn sich seine Adresse ändert. */
export const PFAD_NACHRICHT = "uniwars-zweite-ansicht-pfad";

/** Ereignis im Hauptfenster: "öffne diesen Pfad als zweite Ansicht" (siehe inZweiterAnsichtOeffnen). */
export const OEFFNEN_EREIGNIS = "uniwars-zweite-ansicht-oeffnen";

/** Läuft diese Seite gerade selbst als zweiter Hub im iframe? */
export function istEingebettet(): boolean {
  return typeof window !== "undefined" && window.name === FRAME_NAME;
}

/**
 * Einen Pfad neben der aktuellen Seite öffnen (z. B. Notiz neben der PDF).
 * Ist die aktuelle Seite selbst schon die zweite Ansicht, wird stattdessen die
 * Hauptansicht dorthin gewechselt – die zweite Ansicht bleibt dabei erhalten.
 */
export function inZweiterAnsichtOeffnen(href: string, seite: Seite = "rechts") {
  if (!istAppPfad(href)) return;
  if (istEingebettet()) {
    window.top?.location.assign(href);
    return;
  }
  window.dispatchEvent(new CustomEvent(OEFFNEN_EREIGNIS, { detail: { href, seite } }));
}

export const MIN_ANTEIL = 0.2;
export const MAX_ANTEIL = 0.8;
const SEITEN: Seite[] = ["links", "rechts", "oben", "unten"];

export function anteilBegrenzen(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.round(Math.min(MAX_ANTEIL, Math.max(MIN_ANTEIL, n)) * 1000) / 1000;
}

/** Nur Pfade innerhalb der App (kein "//andere-seite.de", kein "javascript:"). */
export function istAppPfad(href: unknown): href is string {
  return typeof href === "string" && href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/\\") && href.length < 2000;
}

export function istSeite(wert: unknown): wert is Seite {
  return typeof wert === "string" && (SEITEN as string[]).includes(wert);
}

export function istWaagrecht(seite: Seite): boolean {
  return seite === "links" || seite === "rechts";
}

export function gegenueber(seite: Seite): Seite {
  return { links: "rechts", rechts: "links", oben: "unten", unten: "oben" }[seite] as Seite;
}

/** Gespeicherte Aufteilung prüfen – alles Unbekannte wird verworfen. */
export function aufteilungLesen(roh: string | null): Aufteilung | null {
  if (!roh) return null;
  try {
    const wert = JSON.parse(roh) as Partial<Aufteilung>;
    if (!istAppPfad(wert.href) || !istSeite(wert.seite)) return null;
    return { href: wert.href, seite: wert.seite, anteil: anteilBegrenzen(Number(wert.anteil ?? 0.5)) };
  } catch {
    return null;
  }
}

/** Welche Ablagezone liegt dem Zeiger am nächsten? (x/y relativ zur Fläche) */
export function zoneAusPosition(x: number, y: number, breite: number, hoehe: number): Seite {
  if (breite <= 0 || hoehe <= 0) return "rechts";
  const abstand: [Seite, number][] = [
    ["links", x / breite],
    ["rechts", 1 - x / breite],
    // Waagrecht teilen ist auf breiten Bildschirmen der Normalfall: oben/unten
    // nur, wenn der Zeiger wirklich nah am Rand ist.
    ["oben", (y / hoehe) * 1.6],
    ["unten", (1 - y / hoehe) * 1.6],
  ];
  return abstand.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
}

/** Anteil des zweiten Hubs aus der Zeigerposition beim Ziehen des Trenners. */
export function anteilAusPosition(
  seite: Seite,
  zeiger: { x: number; y: number },
  flaeche: { left: number; top: number; width: number; height: number },
): number {
  const roh = {
    links: (zeiger.x - flaeche.left) / flaeche.width,
    rechts: (flaeche.left + flaeche.width - zeiger.x) / flaeche.width,
    oben: (zeiger.y - flaeche.top) / flaeche.height,
    unten: (flaeche.top + flaeche.height - zeiger.y) / flaeche.height,
  }[seite];
  return anteilBegrenzen(roh);
}

/** Eine Textstelle mit Herkunft, die zwischen Hubs gezogen werden kann. */
export type Zitat = {
  text: string;
  /** z. B. der Dateiname des PDFs */
  quelle: string;
  seite?: number | null;
  notiz?: string | null;
};

export function quellenAngabe(z: Zitat): string {
  return z.seite ? `${z.quelle}, S. ${z.seite}` : z.quelle;
}

/** Klartext-Fassung – landet überall dort, wo nur Text ankommt (andere Apps, Textfelder). */
export function zitatAlsText(z: Zitat): string {
  const zeilen = [`„${z.text.trim()}“ (${quellenAngabe(z)})`];
  if (z.notiz?.trim()) zeilen.push(`Notiz: ${z.notiz.trim()}`);
  return zeilen.join("\n");
}

export function zitatLesen(roh: string): Zitat | null {
  try {
    const wert = JSON.parse(roh) as Partial<Zitat>;
    if (typeof wert.text !== "string" || !wert.text.trim() || typeof wert.quelle !== "string") return null;
    return {
      text: wert.text.trim().slice(0, 5000),
      quelle: wert.quelle.slice(0, 300),
      seite: typeof wert.seite === "number" && wert.seite > 0 ? Math.floor(wert.seite) : null,
      notiz: typeof wert.notiz === "string" && wert.notiz.trim() ? wert.notiz.trim().slice(0, 2000) : null,
    };
  } catch {
    return null;
  }
}
