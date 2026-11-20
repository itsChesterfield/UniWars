/**
 * Handy: „Alles“ in der Tab-Leiste öffnet ein Raster aller Bereiche, gruppiert wie die Symbolleiste.
 * Reine Logik ohne React, damit sie testbar bleibt.
 */
import { symbolleistenGruppen, type Symbolleiste } from "./personalisierung.ts";

export type RasterEintrag = { id: string; ausgeblendet: boolean };
export type RasterGruppe = { name: string; eintraege: RasterEintrag[] };

/** Für den Vergleich: klein, ohne Akzente und Umlaut-Punkte, ohne Leerzeichen und Bindestriche. */
export function suchForm(s: string): string {
  return s
    .toLocaleLowerCase("de-DE")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s-]+/g, "");
}

/**
 * Alle Bereiche in der Reihenfolge der Symbolleiste. Ausgeblendete stehen am Ende ihrer Gruppe,
 * denn über „Alles“ bleiben sie erreichbar (DESIGN.md Abschnitt 6).
 */
export function rasterGruppen(s: Symbolleiste): RasterGruppe[] {
  return symbolleistenGruppen(s).map((g) => ({
    name: g.name,
    eintraege: [...g.eintraege.filter((e) => e.sichtbar), ...g.eintraege.filter((e) => !e.sichtbar)].map((e) => ({
      id: e.id,
      ausgeblendet: !e.sichtbar,
    })),
  }));
}

/**
 * Filtert nach der Eingabe. Ein Bereich passt, wenn einer seiner Namen (voller Name, Kurzname) die Eingabe enthält.
 * Gruppen ohne Treffer fallen weg.
 */
export function rasterFiltern(gruppen: RasterGruppe[], q: string, namen: (id: string) => string[]): RasterGruppe[] {
  const such = suchForm(q);
  if (!such) return gruppen;
  return gruppen
    .map((g) => ({ ...g, eintraege: g.eintraege.filter((e) => namen(e.id).some((n) => suchForm(n).includes(such))) }))
    .filter((g) => g.eintraege.length > 0);
}
