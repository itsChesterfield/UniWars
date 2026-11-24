/**
 * KI-16.5: Fest verdrahtete Beispiel-Ereignisse fuer Schritt 2 (Aufbau ohne KI)
 * und als Mock-Stream in Schritt 3. Ein Reflexbogen, verschraenkt aus Erklaer-
 * text (`sagen`) und Zeichnung (`knoten`, `kante`, `titel`).
 */
import type { WbEreignis } from "./protokoll.ts";

export const BEISPIEL_EREIGNISSE: WbEreignis[] = [
  { typ: "sagen", text: "Ein Reflex schuetzt den Koerper, noch bevor das Gehirn davon weiss." },
  { typ: "titel", text: "Der Reflexbogen" },
  { typ: "sagen", text: "Alles beginnt mit einem Reiz, zum Beispiel Hitze an der Hand." },
  { typ: "knoten", id: "reiz", label: "Reiz (Hitze)", form: "kasten" },
  { typ: "sagen", text: "Der Reiz trifft auf einen Rezeptor in der Haut." },
  { typ: "knoten", id: "rezeptor", label: "Rezeptor", form: "kasten" },
  { typ: "kante", von: "reiz", nach: "rezeptor" },
  { typ: "sagen", text: "Von dort laeuft das Signal ueber eine sensible Nervenbahn zum Rueckenmark." },
  { typ: "knoten", id: "sensibel", label: "sensible Bahn", form: "ellipse" },
  { typ: "kante", von: "rezeptor", nach: "sensibel" },
  { typ: "knoten", id: "rueckenmark", label: "Rueckenmark", form: "kasten" },
  { typ: "kante", von: "sensibel", nach: "rueckenmark" },
  { typ: "sagen", text: "Im Rueckenmark wird es direkt auf eine motorische Bahn umgeschaltet." },
  { typ: "knoten", id: "motorisch", label: "motorische Bahn", form: "ellipse" },
  { typ: "kante", von: "rueckenmark", nach: "motorisch" },
  { typ: "sagen", text: "Die steuert den Muskel, der die Hand sofort wegzieht." },
  { typ: "knoten", id: "muskel", label: "Muskel", form: "kasten" },
  { typ: "kante", von: "motorisch", nach: "muskel" },
  { typ: "fertig" },
];

/** Dieselben Ereignisse als NDJSON-Text (eine Zeile pro Ereignis). */
export const BEISPIEL_NDJSON: string = BEISPIEL_EREIGNISSE.map((e) => JSON.stringify(e)).join("\n");
