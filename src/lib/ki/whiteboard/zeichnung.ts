/**
 * KI-16: Zustand der Tafel, der mit jedem Protokoll-Ereignis waechst.
 *
 * Reiner Code ohne React. Der Client wendet eintreffende Ereignisse mit
 * `ereignisAnwenden` an. `sagen` gehoert in den Chat und `fertig` nur in die
 * Ablaufsteuerung, beide veraendern die Tafel nicht. Alle Zeichen-Ereignisse
 * werden in Ankunftsreihenfolge angehaengt (nur Anhaengen, nie Umsortieren),
 * damit der Index als stabiler Schluessel fuer die Mal-Animation taugt.
 */
import type { WbEreignis, WbZeichenEreignis } from "./protokoll.ts";

export type Zeichnung = { titel?: string; elemente: WbZeichenEreignis[] };

export const LEERE_ZEICHNUNG: Zeichnung = { elemente: [] };

/** Wendet ein Ereignis an und gibt eine neue Tafel zurueck (unveraenderlich). */
export function ereignisAnwenden(z: Zeichnung, e: WbEreignis): Zeichnung {
  switch (e.typ) {
    case "titel":
      return { ...z, titel: e.text };
    case "sagen":
    case "fertig":
      return z;
    default:
      return { ...z, elemente: [...z.elemente, e] };
  }
}
