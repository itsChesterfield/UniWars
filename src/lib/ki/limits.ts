/**
 * KI-00b: Alle KI-Kontingente an einer Stelle. Jeder Wert ist per .env überschreibbar.
 * Ein Kontingent fasst Funktionen zusammen, die sich ein Limit teilen.
 */

export type Kontingent = "text" | "chat" | "audio" | "tts" | "gespraech";
export type Einheit = "anfrage" | "audio_sekunden" | "tts_zeichen" | "gespraech_sekunden";
export type Zeitraum = "tag" | "monat";

export type KontingentRegel = {
  einheit: Einheit;
  zeitraum: Zeitraum;
  /** Limit in der Einheit (Sekunden bzw. Zeichen bzw. Anfragen) */
  limit: number;
  /** Anzeige: Limit in der Einheit, die Nutzer verstehen (Minuten statt Sekunden) */
  anzeige: { wert: number; einheit: string };
};

type Umgebung = Record<string, string | undefined>;

function zahl(env: Umgebung, namen: string[], standard: number, max: number): number {
  for (const name of namen) {
    const wert = Number(env[name]?.trim());
    if (env[name]?.trim() && Number.isInteger(wert) && wert > 0 && wert <= max) return wert;
  }
  return standard;
}

/** Liest die Limits (Standardwerte aus dem Plan, Abschnitt 3.6). */
export function kiLimits(env: Umgebung = process.env): Record<Kontingent, KontingentRegel> {
  // KI_TAGESLIMIT gab es schon vor dem Vollausbau – bleibt als Alias gültig
  const text = zahl(env, ["KI_LIMIT_TEXT_TAG", "KI_TAGESLIMIT"], 20, 1000);
  const chat = zahl(env, ["KI_LIMIT_CHAT_TAG"], 40, 1000);
  const audioMin = zahl(env, ["KI_LIMIT_AUDIO_MINUTEN_MONAT"], 120, 10_000);
  const ttsZeichen = zahl(env, ["KI_LIMIT_TTS_ZEICHEN_MONAT"], 50_000, 10_000_000);
  const gespraechMin = zahl(env, ["KI_LIMIT_GESPRAECH_MINUTEN_MONAT"], 30, 10_000);
  return {
    text: { einheit: "anfrage", zeitraum: "tag", limit: text, anzeige: { wert: text, einheit: "KI-Anfragen" } },
    chat: { einheit: "anfrage", zeitraum: "tag", limit: chat, anzeige: { wert: chat, einheit: "Nachrichten" } },
    audio: { einheit: "audio_sekunden", zeitraum: "monat", limit: audioMin * 60, anzeige: { wert: audioMin, einheit: "Audio-Minuten" } },
    tts: { einheit: "tts_zeichen", zeitraum: "monat", limit: ttsZeichen, anzeige: { wert: ttsZeichen, einheit: "Zeichen" } },
    gespraech: { einheit: "gespraech_sekunden", zeitraum: "monat", limit: gespraechMin * 60, anzeige: { wert: gespraechMin, einheit: "Gesprächsminuten" } },
  };
}

/** Verbrauchte Menge in die Anzeige-Einheit umrechnen (Sekunden → Minuten, aufgerundet). */
export function inAnzeigeEinheit(regel: KontingentRegel, menge: number): number {
  return regel.einheit === "audio_sekunden" || regel.einheit === "gespraech_sekunden" ? Math.ceil(menge / 60) : menge;
}

/** "Heute noch 14 von 20 KI-Anfragen" / "Diesen Monat noch 95 von 120 Audio-Minuten" */
export function restText(regel: KontingentRegel, verbraucht: number): string {
  const rest = Math.max(0, regel.anzeige.wert - inAnzeigeEinheit(regel, verbraucht));
  return `${regel.zeitraum === "tag" ? "Heute" : "Diesen Monat"} noch ${rest.toLocaleString("de-DE")} von ${regel.anzeige.wert.toLocaleString("de-DE")} ${regel.anzeige.einheit}`;
}
