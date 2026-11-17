/**
 * Hochschulen suchen und an der E-Mail-Adresse erkennen (ohne Next.js, testbar).
 * Die Liste kommt aus der Tabelle `hochschule` (Wikidata + Uni-Domains, DE/AT/CH).
 */

export type HochschuleKurz = {
  id: string;
  name: string;
  kurzname: string | null;
  ort: string | null;
  land: string;
  domains: string[];
};

/** Kleinbuchstaben, ohne Akzente; ä→ae usw., damit „Muenchen“ und „München“ gleich sind */
export function normalisieren(text: string): string {
  return text
    .toLocaleLowerCase("de-DE")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Kürzel aus der Domain, z. B. rwth-aachen.de → „rwth aachen“, w-hs.de → „w hs“ */
function domainWoerter(domains: string[]): string {
  return domains.map((d) => d.split(".").slice(0, -1).join(" ")).join(" ");
}

/** Anfangsbuchstaben der großgeschriebenen Wörter: „Ludwig-Maximilians-Universität München“ → „lmum“ */
function initialen(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter((w) => /^[A-ZÄÖÜ]/.test(w))
    .map((w) => w[0])
    .join("");
}

type Index = { h: HochschuleKurz; name: string; text: string; kuerzel: string[] };

const indexCache = new WeakMap<HochschuleKurz[], Index[]>();

function index(liste: HochschuleKurz[]): Index[] {
  const vorhanden = indexCache.get(liste);
  if (vorhanden) return vorhanden;
  const neu = liste.map((h) => {
    const kuerzel = [h.kurzname, initialen(h.name), ...h.domains.map((d) => d.split(".")[0])]
      .filter((k): k is string => Boolean(k))
      .map(normalisieren);
    return { h, name: normalisieren(h.name), text: normalisieren([h.name, h.kurzname, h.ort, domainWoerter(h.domains)].filter(Boolean).join(" ")), kuerzel };
  });
  indexCache.set(liste, neu);
  return neu;
}

/** Übliche Abkürzungen beim Suchen: „hs bochum“, „fh aachen“, „tu berlin“, „uni köln“ */
const ABKUERZUNGEN: Record<string, string[]> = {
  hs: ["hochschule"],
  fh: ["fachhochschule", "hochschule"],
  th: ["technische hochschule"],
  tu: ["technische universitaet"],
  uni: ["universitaet", "university"],
  ph: ["paedagogische hochschule"],
};

function wortPasst(text: string, kuerzel: string[], w: string): boolean {
  if (text.includes(` ${w}`) || kuerzel.some((k) => k.replace(/ /g, "") === w)) return true;
  return (ABKUERZUNGEN[w] ?? []).some((lang) => text.includes(` ${lang}`));
}

/**
 * Sucht beim Tippen: alle Wörter der Eingabe müssen vorkommen (als Wortanfang).
 * Kürzel wie „RWTH“, „LMU“, „TUM“ und Ortsnamen funktionieren ebenfalls.
 */
export function hochschuleSuchen(liste: HochschuleKurz[], eingabe: string, max = 8): HochschuleKurz[] {
  const q = normalisieren(eingabe);
  if (!q) return [];
  const woerter = q.split(" ");
  const treffer: { h: HochschuleKurz; punkte: number }[] = [];
  for (const e of index(liste)) {
    const textWoerter = ` ${e.text}`;
    if (!woerter.every((w) => wortPasst(textWoerter, e.kuerzel, w))) continue;
    let punkte = 0;
    if (e.kuerzel.some((k) => k.replace(/ /g, "") === q.replace(/ /g, ""))) punkte += 100;
    if (e.name.startsWith(q)) punkte += 50;
    if (` ${e.name}`.includes(` ${woerter[0]}`)) punkte += 20;
    // Bekannte Hochschulen (mit Domain) vor Kleinsteinrichtungen; kurze Namen vor langen
    if (e.h.domains.length) punkte += 10;
    punkte -= e.name.length / 40;
    treffer.push({ h: e.h, punkte });
  }
  return treffer
    .sort((a, b) => b.punkte - a.punkte || a.h.name.localeCompare(b.h.name, "de"))
    .slice(0, max)
    .map((t) => t.h);
}

export function istMailAdresse(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim());
}

export function domainAusMail(email: string): string | null {
  const teil = email.trim().toLowerCase().split("@");
  return teil.length === 2 && teil[1].includes(".") ? teil[1] : null;
}

/**
 * Hochschule zur Mail-Adresse: Die Domain oder eine Oberdomain muss bei der Hochschule stehen
 * (max@stud.hs-xyz.de → hs-xyz.de). Bei mehreren Treffern gewinnt die genaueste Domain.
 */
export function hochschuleZurMail<T extends { domains: string[]; name?: string }>(email: string, liste: T[]): T | null {
  const domain = domainAusMail(email);
  if (!domain) return null;
  // Gleichstand (z. B. Teilschulen mit derselben Domain): die Hauptinstitution mit kürzerem Namen
  let beste: { h: T; laenge: number } | null = null;
  for (const h of liste) {
    for (const d of h.domains) {
      if (!(domain === d || domain.endsWith(`.${d}`))) continue;
      if (!beste || d.length > beste.laenge || (d.length === beste.laenge && (h.name?.length ?? 0) < (beste.h.name?.length ?? 0))) beste = { h, laenge: d.length };
    }
  }
  return beste?.h ?? null;
}

/** Bestätigung gilt ein Jahr: Nach der Exmatrikulation verfällt das Uni-Konto meist. */
export const VERIFIZIERUNG_GUELTIG_MS = 365 * 86_400_000;
export const CODE_GUELTIG_MS = 15 * 60_000;
export const MAX_CODE_VERSUCHE = 5;
export const MAX_SENDUNGEN_PRO_STUNDE = 3;
