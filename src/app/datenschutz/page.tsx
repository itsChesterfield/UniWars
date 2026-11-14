import Link from "next/link";

export const metadata = { title: "Datenschutz · UniWars" };

// Öffentlich erreichbar (auch ohne Anmeldung). Abschnitte für die übrigen Dienste
// (Hosting, Datenbank, Analyse) sowie Verantwortlicher/Kontakt werden noch ergänzt.
export default function DatenschutzSeite() {
  return (
    <main className="rechtstext">
      <p>
        <Link href="/">← Zurück zu UniWars</Link>
      </p>
      <h1>Datenschutzerklärung</h1>
      <p className="muted">Diese Seite wird gerade vervollständigt. Hier findest du bereits die Angaben zu den KI-Funktionen.</p>

      {/*
        ENTWURF (Phase 16) – vor dem Go-live juristisch prüfen und mit dem AVV abgleichen:
        - bezahlter Mistral-Plan, Training mit API-Daten ausgeschlossen
        - AVV/DPA mit Mistral AI SAS abgeschlossen
        - KI_BASIS_URL zeigt auf den EU-Endpunkt (https://api.eu.mistral.ai/v1)
        - Speicherfristen bei Mistral (Missbrauchskontrolle) laut AVV ergänzen
      */}
      <h2 id="ki">KI-Funktionen (Mistral AI)</h2>
      <p>
        <strong>Anbieter:</strong> Für alle KI-Funktionen nutzen wir Mistral AI SAS, Paris, Frankreich, als Auftragsverarbeiter
        (Vertrag nach Art. 28 DSGVO). Die Verarbeitung findet in der EU statt. Mistral AI nutzt die übermittelten Daten nicht, um
        seine Modelle zu trainieren.
      </p>
      <p>
        <strong>Rechtsgrundlage:</strong> deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Du erteilst sie vor der ersten Nutzung
        und kannst sie jederzeit in der Seitenleiste unter „KI-Funktionen“ widerrufen. Der Widerruf gilt sofort und für die Zukunft:
        Danach werden keine Inhalte mehr an Mistral AI übertragen. Alle anderen Funktionen von UniWars kannst du ohne Einwilligung
        uneingeschränkt nutzen.
      </p>
      <p>
        <strong>Grundsatz:</strong> Die KI macht nur Vorschläge. Gespeichert wird erst, wenn du einen Vorschlag bestätigst.
        Von der KI erstellte Inhalte sind mit ✨ gekennzeichnet.
      </p>

      <h3>Funktionen in den Bereichen (z. B. Notizen, PDF Reader, Textverarbeitung)</h3>
      <p>
        Wenn du eine KI-Funktion startest – zum Beispiel „Karteikarten aus einer Notiz erstellen“ oder „Frage zum Skript“ –, wird
        nur der dafür nötige Inhalt übertragen (z. B. Titel und Text der Notiz, die ausgewählten PDF-Seiten oder deine Frage).
      </p>

      <h3>Assistent</h3>
      <p>
        Deine Fragen an den Assistenten werden an Mistral AI übertragen. Um sie zu beantworten, liest der Assistent bei Bedarf
        Daten aus deinem Konto und überträgt nur die passenden Ausschnitte: Fächer, Stundenplan, Prüfungen, Deadlines, To-dos,
        Stand deiner Karteikarten, Notizen (Suche und Inhalt einzelner Notizen), Lernzeit und Noten. Er sieht ausschließlich
        deine eigenen Daten.
      </p>
      <p>
        <strong>Speicherung:</strong> Deine Unterhaltungen mit dem Assistenten speichern wir in deinem Konto, damit du sie später
        wieder aufrufen kannst. Du kannst einzelne Unterhaltungen oder alle auf einmal löschen (auf der Seite „Assistent“
        oder in der Seitenleiste unter „KI-Verlauf“) – auch nachdem du deine Einwilligung widerrufen hast. Beim Löschen deines Kontos werden sie vollständig mitgelöscht.
      </p>

      <h3>Vorschläge für heute (Dashboard)</h3>
      <p>
        Einmal am Tag, wenn du das Dashboard öffnest, erstellt die KI bis zu drei Vorschläge für den Tag. Dafür wird eine
        Zusammenfassung übertragen: Fächer, Prüfungen der nächsten 21 Tage, offene Deadlines der nächsten 7 Tage, offene To-dos,
        Stand deiner Karteikarten, dein heutiger Stundenplan und deine Lernzeit der letzten 7 Tage. Ohne solche Daten findet keine
        Übertragung statt. Die Vorschläge speichern wir nur für den jeweiligen Tag; ältere werden beim nächsten Mal gelöscht.
        Du kannst das Widget unter „Dashboard anpassen“ ausblenden.
      </p>

      <p>
        <strong>Protokoll für die Kontingente:</strong> Pro Anfrage speichern wir die Art der Funktion, den Zeitpunkt, die Anzahl
        der verarbeiteten Tokens und ob die Anfrage erfolgreich war – <em>nicht</em> deine Inhalte oder die Antwort der KI.
        Diese Einträge werden mit deinem Konto gelöscht.
      </p>

      <h2 id="audio">Transkription und Sprachfunktionen</h2>
      <p>
        <strong>Rechtsgrundlage:</strong> eine eigene Einwilligung für Sprachfunktionen (zusätzlich zu der für KI-Funktionen),
        die du in der Seitenleiste unter „Sprachfunktionen“ jederzeit widerrufen kannst. Ohne sie werden keine Aufnahmen und
        keine Texte zum Vorlesen übertragen.
      </p>
      <p>
        <strong>Transkription:</strong> Wenn du eine Aufnahme transkribierst, wird die Audiodatei an Mistral AI (EU) gesendet und
        dort in Text umgewandelt. Aufnahmen aus dem Transkriptions-Hub speichern wir in deiner Dateiablage, den erkannten Text als
        Transkript. Beides kannst du jederzeit löschen.
      </p>
      <p>
        <strong>Diktieren:</strong> Die Aufnahme wird nur im Arbeitsspeicher deines Browsers gehalten, an Mistral AI gesendet und
        danach verworfen. Wir speichern sie nicht – nur der erkannte Text landet im Eingabefeld.
      </p>
      <p>
        <strong>Vorlesen:</strong> Der vorzulesende Text wird an Mistral AI gesendet, das daraus Sprache erzeugt. Die Audiodaten
        werden nicht gespeichert, sondern nur während der Sitzung in deinem Browser zwischengespeichert, damit erneutes Abspielen
        nichts kostet.
      </p>
      <p>
        <strong>Was wir protokollieren:</strong> für die Monatskontingente die Dauer der umgewandelten Aufnahmen in Sekunden bzw.
        die Anzahl der vorgelesenen Zeichen und den Zeitpunkt – nicht den Inhalt.
      </p>
    </main>
  );
}
