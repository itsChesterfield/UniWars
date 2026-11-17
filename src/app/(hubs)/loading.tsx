/** Sofortige Rückmeldung beim Wechsel: Rahmen bleibt stehen, der Inhalt zeigt Platzhalter, bis die Daten da sind. */
export default function Laedt() {
  return (
    <div className="lade-skelett" role="status" aria-label="Wird geladen">
      <span className="lade-zeile breit" />
      <span className="lade-zeile" />
      <div className="lade-raster">
        <span className="lade-block" />
        <span className="lade-block" />
        <span className="lade-block" />
      </div>
      <span className="lade-block hoch" />
    </div>
  );
}
