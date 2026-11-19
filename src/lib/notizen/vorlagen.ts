/** Vorlagen für neue Notizen (Markdown). */

export type VorlageId = "leer" | "vorlesung" | "klausur" | "zusammenfassung" | "lernplan";

export const VORLAGEN: { id: VorlageId; name: string; beschreibung: string }[] = [
  { id: "leer", name: "Leere Notiz", beschreibung: "Einfach losschreiben" },
  { id: "vorlesung", name: "Vorlesungsmitschrift", beschreibung: "Thema, Kernaussagen, offene Fragen" },
  { id: "klausur", name: "Klausurvorbereitung", beschreibung: "Stoff, Checkliste, Formeln" },
  { id: "zusammenfassung", name: "Zusammenfassung", beschreibung: "Quelle, Kernpunkte, eigene Gedanken" },
  { id: "lernplan", name: "Lernplan", beschreibung: "Ziele und Aufgaben als Checkliste" },
];

export function vorlageInhalt(id: VorlageId): { titel: string; inhalt: string } {
  switch (id) {
    case "vorlesung":
      return {
        titel: "Vorlesung: ",
        inhalt: [
          "## Thema",
          "",
          "",
          "## Kernaussagen",
          "",
          "- ",
          "",
          "> [!merke]",
          ">",
          "> Das Wichtigste in einem Satz:",
          "",
          "## Offene Fragen",
          "",
          "- [ ] ",
          "",
        ].join("\n"),
      };
    case "klausur":
      return {
        titel: "Klausur: ",
        inhalt: [
          "## Termin & Infos",
          "",
          "- Datum: ",
          "- Hilfsmittel: ",
          "",
          "## Stoff",
          "",
          "- [ ] Kapitel 1",
          "- [ ] Kapitel 2",
          "",
          "## Formeln & Definitionen",
          "",
          "",
          "> [!warnung]",
          ">",
          "> Typische Fehler:",
          "",
        ].join("\n"),
      };
    case "zusammenfassung":
      return {
        titel: "Zusammenfassung: ",
        inhalt: ["## Quelle", "", "", "## Kernpunkte", "", "1. ", "", "## Eigene Gedanken", "", ""].join("\n"),
      };
    case "lernplan":
      return {
        titel: "Lernplan: ",
        inhalt: ["## Ziel", "", "", "## Diese Woche", "", "- [ ] ", "", "## Nächste Woche", "", "- [ ] ", ""].join("\n"),
      };
    default:
      return { titel: "", inhalt: "" };
  }
}
