// KI-00: Einziger Einstieg für KI-Aufrufe im App-Code.
// "server-only" bricht den Build ab, falls diese Datei je in einem Client-Bundle landet –
// der API-Key darf den Server nie verlassen.
import "server-only";
import {
  kiAnfrageMit,
  kiAnfrageStreamMit,
  kiWebsucheMit,
  type WebAntwort,
  type KiAntwort,
  type KiKonfig,
  type KiOptionen,
  type StreamEreignis,
} from "@/lib/ki/anfrage";
import { kiLimits } from "@/lib/ki/limits";
import { KiNichtVerfuegbar } from "@/lib/ki/fehler";

const umgebung = (name: string) => process.env[name]?.trim() || undefined;

/**
 * Wofür ein Modell gebraucht wird – jede Funktion kann per .env ein eigenes bekommen.
 * - schnell:  kleine Aufgaben (Absicht erkennen, Formeln, Literaturangaben) – sehr günstig
 * - standard: wie bisher KI_MODELL (Small)
 * - stark:    Erklären, ganze Skripte, Lernraum, Studio – das stärkste Modell
 * - chat/lang: Assistent bzw. lange Texte – standardmäßig ebenfalls das starke Modell
 * - bild:     Fotos (Stundenplan)
 */
export type ModellZweck = "standard" | "schnell" | "stark" | "chat" | "lang" | "bild";

/** Stärkstes Modell (Mistral Large 4 – „mistral-large-latest“ zeigt noch auf Large 3); KI_MODELL_STARK überschreibt. */
export const STARK_STANDARD = "mistral-large-4";
/** Chat (UniVerse Studio): ebenfalls das stärkste Modell – Premium; KI_MODELL_CHAT überschreibt. */
export const CHAT_STANDARD = STARK_STANDARD;
/** Ersatz, falls das gewünschte Modell nicht erreichbar ist oder den Namen nicht kennt */
export const ERSATZ_STANDARD = "mistral-large-latest";

/** Modell pro Zweck */
export function kiModell(zweck: ModellZweck = "standard"): string {
  const standard = umgebung("KI_MODELL") ?? "mistral-small-latest";
  const stark = umgebung("KI_MODELL_STARK") ?? STARK_STANDARD;
  if (zweck === "stark") return stark;
  if (zweck === "chat") return umgebung("KI_MODELL_CHAT") ?? CHAT_STANDARD;
  if (zweck === "lang") return umgebung("KI_MODELL_LANG") ?? stark;
  if (zweck === "schnell") return umgebung("KI_MODELL_SCHNELL") ?? "mistral-small-latest";
  // Bilder (z. B. Stundenplan-Foto) brauchen ein Modell mit Bildverständnis
  if (zweck === "bild") return umgebung("KI_MODELL_BILD") ?? umgebung("KI_MODELL") ?? "mistral-small-latest";
  return standard;
}

/** Ersatzmodell für die starken Zwecke (sonst keins) */
export function ersatzModell(zweck: ModellZweck): string | null {
  if (zweck !== "stark" && zweck !== "chat" && zweck !== "lang") return null;
  const ersatz = umgebung("KI_MODELL_ERSATZ") ?? (kiModell(zweck) === ERSATZ_STANDARD ? STARK_STANDARD : ERSATZ_STANDARD);
  return ersatz === kiModell(zweck) ? null : ersatz;
}

/** Lohnt sich ein Versuch mit dem Ersatzmodell? (Modell unbekannt/nicht verfügbar, nicht: Key, Limit, Abbruch) */
function ersatzSinnvoll(fehler: unknown): boolean {
  return fehler instanceof KiNichtVerfuegbar;
}

/** Anbieter, Modell und Key kommen ausschließlich aus der Umgebung (Anbieterwechsel = nur .env). */
export function kiKonfig(zweck: ModellZweck = "standard"): KiKonfig {
  return {
    basisUrl: umgebung("KI_BASIS_URL") ?? "https://api.mistral.ai/v1",
    modell: kiModell(zweck),
    apiKey: umgebung("MISTRAL_API_KEY"),
  };
}

/** Ist ein Key hinterlegt? (Für den Button-Zustand – sagt nichts darüber, ob er gültig ist.) */
export function kiKonfiguriert(): boolean {
  return Boolean(umgebung("MISTRAL_API_KEY"));
}

/** Tageslimit der Text-Funktionen (KI-01 … KI-11). */
export function kiTageslimit(): number {
  return kiLimits().text.limit;
}

export async function kiAnfrage(optionen: KiOptionen, zweck: ModellZweck = "standard"): Promise<KiAntwort> {
  try {
    return await kiAnfrageMit(kiKonfig(zweck), optionen);
  } catch (err) {
    const ersatz = ersatzModell(zweck);
    if (!ersatz || optionen.modell || !ersatzSinnvoll(err)) throw err;
    console.warn("[ki] starkes Modell nicht verfügbar – Ersatz", ersatz);
    return kiAnfrageMit({ ...kiKonfig(zweck), modell: ersatz }, optionen);
  }
}

export async function* kiAnfrageStream(optionen: KiOptionen, zweck: ModellZweck = "standard"): AsyncGenerator<StreamEreignis> {
  const haupt = kiAnfrageStreamMit(kiKonfig(zweck), optionen);
  const erstes = await haupt.next();
  const ersatz = ersatzModell(zweck);
  // Scheitert das starke Modell gleich zu Beginn, übernimmt das Ersatzmodell
  if (!erstes.done && erstes.value.typ === "fehler" && ersatz && !optionen.modell && ersatzSinnvoll(erstes.value.fehler)) {
    console.warn("[ki] starkes Modell nicht verfügbar – Ersatz", ersatz);
    yield* kiAnfrageStreamMit({ ...kiKonfig(zweck), modell: ersatz }, optionen);
    return;
  }
  if (!erstes.done) yield erstes.value;
  yield* haupt;
}

/** Antwort mit Websuche (Mistral recherchiert selbst); mit Ersatzmodell wie oben. */
export async function kiWebsuche(optionen: KiOptionen, zweck: ModellZweck = "stark"): Promise<WebAntwort> {
  try {
    return await kiWebsucheMit(kiKonfig(zweck), optionen);
  } catch (err) {
    const ersatz = ersatzModell(zweck);
    if (!ersatz || !ersatzSinnvoll(err)) throw err;
    return kiWebsucheMit({ ...kiKonfig(zweck), modell: ersatz }, optionen);
  }
}
