// KI-00b: Audio-Einstieg für den App-Code (Diktieren, Transkription, Vorlesen).
// server-only: API-Key und Modell-IDs bleiben auf dem Server.
import "server-only";
import { sprechenMit, transkribierenMit, type AudioKonfig, type Transkript, type TtsFormat } from "@/lib/ki/audio-kern";

const umgebung = (name: string) => process.env[name]?.trim() || undefined;

export function audioKonfig(): AudioKonfig {
  return {
    basisUrl: umgebung("KI_BASIS_URL") ?? "https://api.mistral.ai/v1",
    apiKey: umgebung("MISTRAL_API_KEY"),
    sttModell: umgebung("KI_AUDIO_STT_MODELL"),
    ttsModell: umgebung("KI_AUDIO_TTS_MODELL"),
    stimme: umgebung("KI_AUDIO_STIMME"),
  };
}

/** Sind Spracherkennung bzw. Sprachausgabe eingerichtet? (für Button-Zustände) */
export function audioVerfuegbar(): { diktat: boolean; vorlesen: boolean } {
  const k = audioKonfig();
  return { diktat: Boolean(k.apiKey && k.sttModell), vorlesen: Boolean(k.apiKey && k.ttsModell) };
}

export function transkribieren(datei: Blob, sprache: "de" | "en", optionen: { dateiname?: string; zeitstempel?: boolean; geschaetzteSekunden?: number | null } = {}): Promise<Transkript> {
  return transkribierenMit(audioKonfig(), { datei, sprache, dateiname: optionen.dateiname ?? "aufnahme.webm", zeitstempel: optionen.zeitstempel, geschaetzteSekunden: optionen.geschaetzteSekunden });
}

/** Vorlesen; `sprecher: 2` nutzt die zweite Stimme (KI_AUDIO_STIMME_2) – für den Lern-Podcast */
export function sprechen(text: string, optionen: { format?: TtsFormat; signal?: AbortSignal; sprecher?: 1 | 2 } = {}) {
  const konfig = audioKonfig();
  const stimme = optionen.sprecher === 2 ? (umgebung("KI_AUDIO_STIMME_2") ?? konfig.stimme) : konfig.stimme;
  return sprechenMit({ ...konfig, stimme }, { text, format: optionen.format ?? "mp3", stream: true, signal: optionen.signal });
}
