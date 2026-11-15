/** Bereiche des Zentralen Hubs – jeweils eine eigene Seite, erreichbar über die Notch. */
export type Bereich = "uebersicht" | "termine" | "aufgaben" | "noten" | "fortschritt" | "faecher";

export const BEREICHE: { bereich: Bereich; href: string; name: string; untertitel: string }[] = [
  { bereich: "uebersicht", href: "/", name: "Übersicht", untertitel: "" },
  { bereich: "termine", href: "/termine", name: "Termine", untertitel: "Heute, Stundenplan und Kalender." },
  { bereich: "aufgaben", href: "/aufgaben", name: "Aufgaben", untertitel: "Deadlines, To-Dos und Prüfungen." },
  { bereich: "noten", href: "/noten", name: "Noten", untertitel: "Notenschnitt, Prognose und Rechner." },
  { bereich: "fortschritt", href: "/fortschritt", name: "Fortschritt", untertitel: "Lernzeit, Anwesenheit und Streak." },
  { bereich: "faecher", href: "/faecher", name: "Fächer", untertitel: "Deine Fächer für dieses Semester." },
];
