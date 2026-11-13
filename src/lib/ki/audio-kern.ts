/**
 * KI-00b: Audio (Voxtral) – reine Logik ohne Next.js, testbar mit gemocktem fetch.
 * Im App-Code NICHT direkt importieren, sondern über `audio.ts` (server-only).
 *
 * Stand der Mistral-Doku (Voxtral 3, Okt. 2026, über die Websuche geprüft):
 *  - Transkription: POST /audio/transcriptions (multipart: model, file, language,
 *    timestamp_granularities=segment), Antwort { text, segments[{start,end,text}], usage }
 *  - Sprachausgabe: POST /audio/speech mit model, voice_id, response_format
 *    (mp3|wav|pcm|flac|opus) und optional stream. Die Antwort kann rohes Audio,
 *    JSON mit base64 `audio_data` oder ein Ereignisstrom mit base64-Stücken sein –
 *    alle drei Formen werden unterstützt. Vor Phase 13 mit echtem Key gegenprüfen.
 * Modell-IDs kommen ausschließlich aus der Umgebung.
 */
import { abbruchSteuerung, STANDARD_UMGEBUNG, statusFehler, sseDaten, type KiUmgebung } from "./anfrage.ts";
import { KiAbgebrochen, KiEingabe, KiKonfiguration, KiNichtVerfuegbar, KiZeitueberschreitung } from "./fehler.ts";

export type AudioKonfig = {
  basisUrl: string;
  apiKey: string | undefined;
  sttModell: string | undefined;
  ttsModell: string | undefined;
  stimme: string | undefined;
};

export type Segment = { start: number; ende: number; text: string };
export type Transkript = { text: string; segmente: Segment[]; sekunden: number | null };

export type TtsFormat = "mp3" | "opus" | "wav" | "pcm" | "flac";
export const TTS_MIME: Record<TtsFormat, string> = {
  mp3: "audio/mpeg",
  opus: "audio/ogg",
  wav: "audio/wav",
  pcm: "audio/L16",
  flac: "audio/flac",
};

/** Höchstlänge pro Vorlese-Aufruf (längere Texte teilt der Aufrufer auf) */
export const MAX_TTS_ZEICHEN = 4000;
const MIN_TRANSKRIPTION_MS = 60_000;
const MAX_TRANSKRIPTION_MS = 5 * 60_000;

/** Timeout für eine Transkription: 60 s Grundzeit + 1 s je Audiosekunde, höchstens 5 Minuten. */
export function transkriptionsTimeoutMs(sekunden?: number | null): number {
  if (!sekunden || !Number.isFinite(sekunden) || sekunden <= 0) return MAX_TRANSKRIPTION_MS;
  return Math.min(MAX_TRANSKRIPTION_MS, Math.max(MIN_TRANSKRIPTION_MS, MIN_TRANSKRIPTION_MS + sekunden * 1000));
}

function basis(konfig: AudioKonfig) {
  if (!konfig.apiKey?.trim()) throw new KiKonfiguration("Umgebungsvariable MISTRAL_API_KEY fehlt");
  return konfig.basisUrl.replace(/\/+$/, "");
}

type RohTranskript = {
  text?: unknown;
  segments?: { start?: unknown; end?: unknown; text?: unknown }[];
  usage?: { prompt_audio_seconds?: unknown };
};

/** Antwort der Transkription in ein sauberes Ergebnis übersetzen. */
export function transkriptLesen(daten: unknown): Transkript {
  const roh = (daten ?? {}) as RohTranskript;
  const segmente = (Array.isArray(roh.segments) ? roh.segments : [])
    .filter((s) => typeof s?.start === "number" && typeof s?.end === "number" && typeof s?.text === "string")
    .map((s) => ({ start: s.start as number, ende: s.end as number, text: (s.text as string).trim() }));
  const text = typeof roh.text === "string" ? roh.text.trim() : segmente.map((s) => s.text).join(" ");
  const ausUsage = typeof roh.usage?.prompt_audio_seconds === "number" ? roh.usage.prompt_audio_seconds : null;
  const sekunden = ausUsage ?? (segmente.length ? Math.ceil(segmente[segmente.length - 1].ende) : null);
  return { text, segmente, sekunden };
}

/** Sprache → Text. Ein Wiederholungsversuch bei 429/5xx/Netz (die Anfrage ist gefahrlos wiederholbar). */
export async function transkribierenMit(
  konfig: AudioKonfig,
  eingabe: { datei: Blob; dateiname: string; sprache?: "de" | "en"; zeitstempel?: boolean; geschaetzteSekunden?: number | null },
  umgebung: Partial<KiUmgebung> = {},
): Promise<Transkript> {
  const u = { ...STANDARD_UMGEBUNG, timeoutMs: transkriptionsTimeoutMs(eingabe.geschaetzteSekunden), ...umgebung };
  const url = `${basis(konfig)}/audio/transcriptions`;
  if (!konfig.sttModell) throw new KiKonfiguration("Umgebungsvariable KI_AUDIO_STT_MODELL fehlt");
  if (eingabe.datei.size === 0) throw new KiEingabe("Die Aufnahme ist leer.");

  const versuch = async (): Promise<{ ok: true; t: Transkript } | { ok: false; fehler: Error; wiederholbar: boolean }> => {
    const start = Date.now();
    const abbruch = abbruchSteuerung(u.timeoutMs);
    let status = 0;
    try {
      const form = new FormData();
      form.append("model", konfig.sttModell as string);
      form.append("file", eingabe.datei, eingabe.dateiname);
      if (eingabe.sprache) form.append("language", eingabe.sprache);
      if (eingabe.zeitstempel) form.append("timestamp_granularities", "segment");
      const antwort = await u.fetch(url, { method: "POST", headers: { authorization: `Bearer ${konfig.apiKey}` }, body: form, signal: abbruch.signal });
      status = antwort.status;
      const problem = statusFehler(status);
      if (problem) return { ok: false, ...problem };
      return { ok: true, t: transkriptLesen(await antwort.json()) };
    } catch (err) {
      if (abbruch.timeout()) return { ok: false, fehler: new KiZeitueberschreitung(), wiederholbar: false };
      return { ok: false, fehler: new KiNichtVerfuegbar(err instanceof Error ? err.message : "Netzwerkfehler"), wiederholbar: true };
    } finally {
      abbruch.aufraeumen();
      u.log({ modell: konfig.sttModell, art: "transkription", status: status || (abbruch.timeout() ? "timeout" : "netzwerk"), dauer_ms: Date.now() - start });
    }
  };

  let r = await versuch();
  if (!r.ok && r.wiederholbar) {
    await u.warten(u.wiederholenNachMs);
    r = await versuch();
  }
  if (!r.ok) throw r.fehler;
  return r.t;
}

function base64Bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Ereignisstrom mit base64-Audiostücken (`audio_data`) → reiner Byte-Strom. */
function audioAusEreignissen(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const it = sseDaten(body)[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(c) {
      try {
        while (true) {
          const { value, done } = await it.next();
          if (done) {
            c.close();
            return;
          }
          const daten = (value ?? {}) as { audio_data?: unknown; type?: unknown; data?: { audio_data?: unknown } };
          const b64 = typeof daten.audio_data === "string" ? daten.audio_data : typeof daten.data?.audio_data === "string" ? daten.data.audio_data : null;
          if (b64) {
            c.enqueue(base64Bytes(b64));
            return;
          }
        }
      } catch (err) {
        c.error(new KiAbgebrochen(String(err)));
      }
    },
    cancel() {
      void it.return?.(undefined);
    },
  });
}

/** Text → Sprache. Liefert einen Byte-Strom zum direkten Abspielen. */
export async function sprechenMit(
  konfig: AudioKonfig,
  eingabe: { text: string; format?: TtsFormat; stream?: boolean; signal?: AbortSignal },
  umgebung: Partial<KiUmgebung> = {},
): Promise<{ audio: ReadableStream<Uint8Array>; mime: string; zeichen: number }> {
  const u = { ...STANDARD_UMGEBUNG, ...umgebung };
  const url = `${basis(konfig)}/audio/speech`;
  if (!konfig.ttsModell) throw new KiKonfiguration("Umgebungsvariable KI_AUDIO_TTS_MODELL fehlt");
  const text = eingabe.text.trim();
  if (!text) throw new KiEingabe("Es gibt nichts vorzulesen.");
  if (text.length > MAX_TTS_ZEICHEN) throw new KiEingabe("Der Text ist zu lang zum Vorlesen.");
  const format = eingabe.format ?? "mp3";

  const versuch = async () => {
    const start = Date.now();
    const abbruch = abbruchSteuerung(u.timeoutMs, eingabe.signal);
    let status = 0;
    try {
      const antwort = await u.fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${konfig.apiKey}` },
        body: JSON.stringify({
          model: konfig.ttsModell,
          input: text,
          ...(konfig.stimme ? { voice_id: konfig.stimme } : {}),
          response_format: format,
          ...(eingabe.stream ? { stream: true } : {}),
        }),
        signal: abbruch.signal,
      });
      status = antwort.status;
      const problem = statusFehler(status);
      if (problem) return { ok: false as const, ...problem };
      if (!antwort.body) return { ok: false as const, fehler: new KiNichtVerfuegbar("Antwort ohne Inhalt"), wiederholbar: false };
      // Timeout gilt bis zur Antwort; danach läuft der Strom ohne Zeitlimit weiter
      abbruch.aufraeumen();
      const typ = antwort.headers.get("content-type") ?? "";
      if (typ.includes("text/event-stream")) return { ok: true as const, audio: audioAusEreignissen(antwort.body) };
      if (typ.includes("json")) {
        const daten = (await antwort.json()) as { audio_data?: unknown };
        if (typeof daten.audio_data !== "string") return { ok: false as const, fehler: new KiNichtVerfuegbar("Antwort ohne Audio"), wiederholbar: false };
        const bytes = base64Bytes(daten.audio_data);
        return {
          ok: true as const,
          audio: new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(bytes);
              c.close();
            },
          }),
        };
      }
      return { ok: true as const, audio: antwort.body };
    } catch (err) {
      if (abbruch.timeout()) return { ok: false as const, fehler: new KiZeitueberschreitung(), wiederholbar: false };
      if (eingabe.signal?.aborted) return { ok: false as const, fehler: new KiAbgebrochen("vom Nutzer abgebrochen"), wiederholbar: false };
      return { ok: false as const, fehler: new KiNichtVerfuegbar(err instanceof Error ? err.message : "Netzwerkfehler"), wiederholbar: true };
    } finally {
      abbruch.aufraeumen();
      u.log({ modell: konfig.ttsModell, art: "sprechen", zeichen: text.length, status: status || "netzwerk", dauer_ms: Date.now() - start });
    }
  };

  let r = await versuch();
  if (!r.ok && r.wiederholbar && !eingabe.signal?.aborted) {
    await u.warten(u.wiederholenNachMs);
    r = await versuch();
  }
  if (!r.ok) throw r.fehler;
  return { audio: r.audio, mime: TTS_MIME[format], zeichen: text.length };
}
