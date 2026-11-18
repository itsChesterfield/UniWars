/**
 * Buchstaben steigen aus einer Maske (Hub-Bühne, Vorbild mistral.ai/about): Text in Wörter und Buchstaben
 * zerlegen, jeder Buchstabe bekommt eine Verzögerung und eine Starthöhe. Leicht versetzt, aber fest
 * (kein Zufall), damit Server und Browser gleich zeichnen.
 */
export type SteigBuchstabe = { zeichen: string; verzoegerung: number; hoehe: number };
export type SteigWort = { text: string; buchstaben: SteigBuchstabe[] };

export function zerlegen(text: string, start = 0, schritt = 15): SteigWort[] {
  let i = 0;
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((wort) => ({
      text: wort,
      buchstaben: Array.from(wort).map((zeichen) => {
        const n = i++;
        const versatz = ((n * 37) % 11) - 5;
        return { zeichen, verzoegerung: Math.max(0, start + n * schritt + versatz * 4), hoehe: 110 + ((n * 53) % 5) * 12 };
      }),
    }));
}

/** Dauer, bis der letzte Buchstabe angekommen ist (für nachfolgende Verzögerungen) */
export function steigDauer(woerter: SteigWort[], dauer = 620): number {
  const alle = woerter.flatMap((w) => w.buchstaben);
  return alle.length ? Math.max(...alle.map((b) => b.verzoegerung)) + dauer : 0;
}
