/**
 * Titel der Einträge im Google-Kalender. Klartext statt Emojis (Didi, 20.11.); die Art zeigt Google zusätzlich über die Farbe.
 * Erledigtes beginnt mit „✓ “.
 */
const erledigtVor = (erledigt: boolean) => (erledigt ? "✓ " : "");

export const titelPruefung = (titel: string, erledigt: boolean) => `${erledigtVor(erledigt)}Prüfung: ${titel}`;

export function titelDeadline(titel: string, typ: string, erledigt: boolean): string {
  const vor = typ === "TERMIN" ? "" : typ === "GRUPPENARBEIT" ? "Gruppenarbeit: " : "Abgabe: ";
  return `${erledigtVor(erledigt)}${vor}${titel}`;
}

export const titelTodo = (titel: string, erledigt: boolean) => `${erledigtVor(erledigt)}To-Do: ${titel}`;

/** Vorlesung aus dem Stundenplan: nur der Fachname */
export const titelStunde = (fach: string | undefined) => fach ?? "Vorlesung";

export const KALENDER_NAME = "UniVerse";
