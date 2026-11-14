/**
 * KI-14: Text für das Vorlesen aufbereiten – Markdown raus, Aufzählungen als Sätze,
 * Code-Blöcke durch einen Hinweis ersetzen, einfache Formeln aussprechbar machen.
 * Danach in Stücke teilen: Das erste Stück ist kurz, damit das Vorlesen schnell startet.
 */

const CODE_HINWEIS = "(Codebeispiel, siehe Bildschirm)";

/** Häufige Zeichen in Formeln aussprechbar machen. */
function formelnVereinfachen(t: string): string {
  return t
    .replace(/\$\$?([^$]+)\$\$?/g, "$1")
    .replace(/(\w)\^2\b/g, "$1 Quadrat")
    .replace(/(\w)\^3\b/g, "$1 hoch drei")
    .replace(/(\w)\^\{?(-?\w+)\}?/g, "$1 hoch $2")
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 geteilt durch $2")
    .replace(/\\sqrt\{([^}]+)\}/g, "Wurzel aus $1")
    .replace(/\\(cdot|times)/g, " mal ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/≈/g, " ungefähr ")
    .replace(/≠/g, " ungleich ")
    .replace(/≤/g, " kleiner gleich ")
    .replace(/≥/g, " größer gleich ")
    .replace(/→|=>/g, " ergibt ")
    .replace(/(\d)\s*%/g, "$1 Prozent")
    .replace(/(\d)\s*€/g, "$1 Euro")
    .replace(/[{}]/g, "");
}

/** Markdown → gut vorlesbarer Fließtext. */
export function sprechtext(markdown: string): string {
  let t = markdown.replace(/\r\n/g, "\n");
  t = t.replace(/```[\s\S]*?(```|$)/g, `\n${CODE_HINWEIS}\n`);
  t = t.replace(/`([^`\n]+)`/g, "$1");
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  t = t.replace(/<[^>]+>/g, " ");

  const zeilen: string[] = [];
  for (const roh of t.split("\n")) {
    let z = roh.trim();
    if (/^\|?\s*:?-{2,}[-:|\s]*$/.test(z) && z.includes("|")) continue; // Trennzeile einer Tabelle
    if (!z || /^(-{3,}|\*{3,}|_{3,})$/.test(z)) {
      zeilen.push("");
      continue;
    }
    z = z.replace(/^#{1,6}\s+/, "");
    z = z.replace(/^>\s?/, "");
    const punkt = /^(?:[-*+•]|\d+[.)]|\[[ xX]\])\s+(?:\[[ xX]\]\s+)?/.exec(z);
    if (punkt) z = z.slice(punkt[0].length);
    if (z.includes("|")) z = z.split("|").map((x) => x.trim()).filter(Boolean).join(", ");
    z = z.replace(/(\*\*|__)(.+?)\1/g, "$2").replace(/(\*|_)(?=\S)(.+?)(?<=\S)\1/g, "$2").replace(/~~(.+?)~~/g, "$1");
    z = formelnVereinfachen(z).replace(/\s+/g, " ").trim();
    if (!z) continue;
    // Aufzählungen, Überschriften und Tabellenzeilen ohne Satzzeichen bekommen eins
    if (!/[.!?:;…)]$/.test(z)) z += ".";
    zeilen.push(z);
  }
  return zeilen
    .join("\n")
    .replace(/\n{2,}/g, "\n\n")
    .replace(/(?<!\n)\n(?!\n)/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** In Sätze teilen (Abkürzungen wie "z. B." bleiben zusammen). */
function saetze(text: string): string[] {
  const geschuetzt = text.replace(/\b(z|d|u|s|vgl|bzw|ca|Nr|Abb|Kap|Dr|Prof|etc|ggf|usw|bspw|Hrsg|evtl)\.\s/g, "$1·¶ ");
  return (geschuetzt.match(/[^.!?…\n]+(?:[.!?…]+["“”»)]*|\n+|$)/g) ?? [])
    .map((s) => s.replace(/·¶/g, ".").trim())
    .filter(Boolean);
}

/**
 * Stücke fürs Vorlesen: das erste höchstens ~180 Zeichen (schneller Start),
 * danach bis ~500 Zeichen. Überlange Sätze werden an Kommas bzw. Leerzeichen geteilt.
 */
export function sprechStuecke(text: string, erstesMax = 180, max = 500): string[] {
  const stuecke: string[] = [];
  let aktuell = "";
  const grenze = () => (stuecke.length === 0 ? erstesMax : max);
  const abschliessen = () => {
    if (aktuell.trim()) stuecke.push(aktuell.trim());
    aktuell = "";
  };
  for (const satz of saetze(text)) {
    let rest = satz;
    while (rest.length > grenze()) {
      abschliessen();
      const g = grenze();
      const komma = rest.lastIndexOf(", ", g);
      const leer = rest.lastIndexOf(" ", g);
      const schnitt = komma > g / 2 ? komma + 1 : leer > g / 2 ? leer : g;
      stuecke.push(rest.slice(0, schnitt).trim());
      rest = rest.slice(schnitt).trim();
    }
    if (aktuell && aktuell.length + rest.length + 1 > grenze()) abschliessen();
    aktuell = aktuell ? `${aktuell} ${rest}` : rest;
  }
  abschliessen();
  return stuecke;
}
