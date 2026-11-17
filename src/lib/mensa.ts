/**
 * Mensa-Daten von OpenMensa (https://openmensa.org, freie API) aufbereiten – ohne Next.js, testbar.
 */
export type Mensa = { id: number; name: string; stadt: string | null };

export type Gericht = { name: string; kategorie: string; preis: number | null; vegan: boolean; vegetarisch: boolean };

export type Speiseplan = { mensa: string; datum: string; heute: boolean; gerichte: Gericht[] } | { mensa: string; datum: null; heute: false; gerichte: [] };

type RohGericht = { name?: unknown; category?: unknown; prices?: { students?: unknown } | null; notes?: unknown };

export function gerichteAufbereiten(roh: unknown, max = 8): Gericht[] {
  if (!Array.isArray(roh)) return [];
  return (roh as RohGericht[])
    .filter((g) => typeof g?.name === "string" && g.name.trim())
    .map((g) => {
      const notizen = Array.isArray(g.notes) ? g.notes.filter((n): n is string => typeof n === "string").map((n) => n.toLowerCase()) : [];
      const kategorie = typeof g.category === "string" ? g.category : "";
      const text = `${kategorie} ${notizen.join(" ")}`.toLowerCase();
      const vegan = /\bvegan/.test(text);
      const preis = typeof g.prices?.students === "number" ? g.prices.students : null;
      return {
        name: (g.name as string)
          .split("|")
          .map((t) => t.replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .join(" · "),
        kategorie,
        preis,
        vegan,
        vegetarisch: vegan || /vegetari|fleischlos|ovo|lacto/.test(text),
      };
    })
    .slice(0, max);
}

/** Nächster geöffneter Tag ab heute (Format YYYY-MM-DD) */
export function naechsterOffenerTag(tage: unknown, heute: string): string | null {
  if (!Array.isArray(tage)) return null;
  const offen = tage
    .filter((t): t is { date: string; closed: boolean } => typeof t?.date === "string" && t.closed === false)
    .map((t) => t.date)
    .filter((d) => d >= heute)
    .sort();
  return offen[0] ?? null;
}

export function preisText(preis: number | null): string {
  return preis === null ? "" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(preis);
}
