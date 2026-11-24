/**
 * KI-16: Zustand einer Zeichnung, der mit jedem Protokoll-Ereignis waechst.
 *
 * Reiner Code ohne React. Der Client wendet eintreffende Ereignisse mit
 * `ereignisAnwenden` an; `sagen` und `fertig` veraendern die Zeichnung nicht
 * (der Text gehoert in den Chat, `fertig` nur in die Ablaufsteuerung).
 */
import type { WbEreignis, KnotenForm } from "./protokoll.ts";

export type ZKnoten = { id: string; label: string; form: KnotenForm };
export type ZKante = { von: string; nach: string; label?: string };
export type Zeichnung = { titel?: string; knoten: ZKnoten[]; kanten: ZKante[] };

export const LEERE_ZEICHNUNG: Zeichnung = { knoten: [], kanten: [] };

/** Wendet ein Ereignis an und gibt eine neue Zeichnung zurueck (unveraenderlich). */
export function ereignisAnwenden(z: Zeichnung, e: WbEreignis): Zeichnung {
  switch (e.typ) {
    case "titel":
      return { ...z, titel: e.text };
    case "knoten": {
      const neu: ZKnoten = { id: e.id, label: e.label, form: e.form };
      const vorhanden = z.knoten.some((k) => k.id === e.id);
      const knoten = vorhanden ? z.knoten.map((k) => (k.id === e.id ? neu : k)) : [...z.knoten, neu];
      return { ...z, knoten };
    }
    case "kante": {
      const neu: ZKante = e.label ? { von: e.von, nach: e.nach, label: e.label } : { von: e.von, nach: e.nach };
      const vorhanden = z.kanten.some((k) => k.von === e.von && k.nach === e.nach);
      const kanten = vorhanden ? z.kanten.map((k) => (k.von === e.von && k.nach === e.nach ? neu : k)) : [...z.kanten, neu];
      return { ...z, kanten };
    }
    default:
      return z;
  }
}
