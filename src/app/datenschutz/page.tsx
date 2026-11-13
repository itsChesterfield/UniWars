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

      <h2 id="ki">KI-Funktionen (Mistral AI)</h2>
      <p>
        <strong>Was passiert:</strong> Wenn du eine KI-Funktion nutzt – zum Beispiel „Karteikarten aus einer Notiz erstellen“ –,
        wird nur der Inhalt, den du dafür auswählst (Titel und Text der Notiz), an Mistral AI SAS, Paris, Frankreich (EU) gesendet
        und dort verarbeitet. Die Antwort (Vorschläge für Karteikarten) wird erst gespeichert, wenn du sie bestätigst.
      </p>
      <p>
        <strong>Rechtsgrundlage:</strong> deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Du erteilst sie vor der ersten Nutzung
        und kannst sie jederzeit in der Seitenleiste unter „KI-Funktionen“ widerrufen. Der Widerruf gilt für die Zukunft.
      </p>
      <p>
        <strong>Was wir speichern:</strong> Für das Tageslimit protokollieren wir pro Anfrage die Art der Funktion, den Zeitpunkt,
        die Anzahl der verarbeiteten Tokens und ob die Anfrage erfolgreich war – <em>nicht</em> den Inhalt deiner Notiz oder die
        Antwort der KI. Diese Einträge werden mit deinem Konto gelöscht.
      </p>
      <p>
        <strong>Ohne Einwilligung</strong> werden keine Inhalte an Mistral AI übertragen. Alle anderen Funktionen von UniWars
        kannst du uneingeschränkt nutzen.
      </p>
    </main>
  );
}
