/**
 * Lademarke „Umlauf“ (Prototyp Bewegung): Haarlinien-Bahn, ein Planet mit kurzer Spur um einen goldenen Punkt.
 * Ersetzt den Rand-Spinner. Reines CSS; bei reduzierter Bewegung steht der Planet still, die Marke bleibt sichtbar.
 */
export function Umlauf({ groesse = 32, label }: { groesse?: 16 | 32 | 64; label?: string }) {
  return (
    <span className={`umlauf u${groesse}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <span className="umlauf-bahn" />
      <span className="umlauf-mitte" />
      <span className="umlauf-planet spur2" />
      <span className="umlauf-planet spur1" />
      <span className="umlauf-planet" />
    </span>
  );
}
