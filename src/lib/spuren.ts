/**
 * Überlappende Termine eines Tages nebeneinander legen (wie in Kalender-Apps):
 * Jeder Termin bekommt eine Spur; Termine, die sich überschneiden, teilen sich die Breite.
 */
export type Spur = { spur: number; spuren: number };

export function spurenVerteilen<T extends { start: number; ende: number }>(termine: T[]): Map<T, Spur> {
  const sortiert = [...termine].sort((a, b) => a.start - b.start || b.ende - a.ende);
  const ergebnis = new Map<T, Spur>();
  let gruppe: T[] = [];
  let gruppenEnde = -Infinity;
  let spurEnden: number[] = [];

  const abschliessen = () => {
    const spuren = spurEnden.length;
    for (const t of gruppe) ergebnis.get(t)!.spuren = spuren;
    gruppe = [];
    spurEnden = [];
  };

  for (const t of sortiert) {
    if (t.start >= gruppenEnde) abschliessen();
    let spur = spurEnden.findIndex((ende) => ende <= t.start);
    if (spur === -1) {
      spur = spurEnden.length;
      spurEnden.push(t.ende);
    } else spurEnden[spur] = t.ende;
    ergebnis.set(t, { spur, spuren: 1 });
    gruppe.push(t);
    gruppenEnde = Math.max(gruppenEnde, t.ende);
  }
  abschliessen();
  return ergebnis;
}
