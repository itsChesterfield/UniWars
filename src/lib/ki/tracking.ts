// KI-ALL-09: Analytics der KI-Funktionen – nur Zahlen und Typen, nie Inhalte.
// track() sendet nur mit Einwilligung zur Nutzungsanalyse.
import { track } from "@/lib/analytics";
import { fehlerTypFuerAnalytics } from "@/lib/ki/ergebnis";
import type { KiFehlerTyp } from "@/lib/ki/fehler";

export type KiFunktionsId = "ki01" | "ki02" | "ki03" | "ki04" | "ki05" | "ki06" | "ki07" | "ki08" | "ki09" | "ki10" | "ki11" | "ki12" | "ki13" | "ki14";

export function kiGestartet(funktion: KiFunktionsId) {
  track("ki_funktion_gestartet", { funktion });
}

export function kiVorschauAngezeigt(funktion: KiFunktionsId, anzahl: number, startMs: number) {
  track("ki_vorschau_angezeigt", { funktion, anzahl, dauer_ms: Math.round(performance.now() - startMs) });
}

export function kiVorschauUebernommen(funktion: KiFunktionsId, anzahlUebernommen: number, anzahlBearbeitet: number) {
  track("ki_vorschau_uebernommen", { funktion, anzahl_uebernommen: anzahlUebernommen, anzahl_bearbeitet: anzahlBearbeitet });
}

export function kiFehlerTracken(funktion: KiFunktionsId, typ: KiFehlerTyp) {
  const t = fehlerTypFuerAnalytics(typ);
  if (t) track("ki_fehler", { funktion, typ: t });
}
