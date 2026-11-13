import { test } from "node:test";
import assert from "node:assert/strict";
import { sprechenMit, transkribierenMit, transkriptionsTimeoutMs, transkriptLesen, type AudioKonfig } from "./audio-kern.ts";
import { KiAusgelastet, KiEingabe, KiKonfiguration, KiZeitueberschreitung } from "./fehler.ts";

const KONFIG: AudioKonfig = {
  basisUrl: "https://api.example.test/v1/",
  apiKey: "geheim",
  sttModell: "stt-test",
  ttsModell: "tts-test",
  stimme: "stimme-de",
};
const AUDIO = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/webm" });

function mock(antworten: (() => Response | Promise<Response>)[], extra: Record<string, unknown> = {}) {
  const aufrufe: { url: string; init: RequestInit }[] = [];
  const pausen: number[] = [];
  let i = 0;
  return {
    aufrufe,
    pausen,
    u: {
      fetch: (async (url: string, init: RequestInit) => {
        aufrufe.push({ url, init });
        return antworten[Math.min(i++, antworten.length - 1)]();
      }) as typeof fetch,
      warten: async (ms: number) => {
        pausen.push(ms);
      },
      log: () => {},
      ...extra,
    },
  };
}

async function bytes(strom: ReadableStream<Uint8Array>): Promise<number[]> {
  const liste: number[] = [];
  const leser = strom.getReader();
  while (true) {
    const { value, done } = await leser.read();
    if (done) return liste;
    liste.push(...value);
  }
}

const b64 = (zahlen: number[]) => btoa(String.fromCharCode(...zahlen));

// ---------------------------------------------------------------------------
// Transkription
// ---------------------------------------------------------------------------

test("Transkription: multipart mit model, file, language, Zeitstempel; Segmente und Sekunden", async () => {
  const { u, aufrufe } = mock([
    () =>
      Response.json({
        text: " Hallo Welt ",
        segments: [
          { start: 0, end: 1.2, text: " Hallo" },
          { start: 1.2, end: 2.6, text: "Welt " },
          { start: "x", end: 3, text: "kaputt" },
        ],
        usage: { prompt_audio_seconds: 3 },
      }),
  ]);
  const t = await transkribierenMit(KONFIG, { datei: AUDIO, dateiname: "a.webm", sprache: "de", zeitstempel: true }, u);
  assert.deepEqual(t, {
    text: "Hallo Welt",
    segmente: [
      { start: 0, ende: 1.2, text: "Hallo" },
      { start: 1.2, ende: 2.6, text: "Welt" },
    ],
    sekunden: 3,
  });
  assert.equal(aufrufe[0].url, "https://api.example.test/v1/audio/transcriptions");
  const form = aufrufe[0].init.body as FormData;
  assert.equal(form.get("model"), "stt-test");
  assert.equal(form.get("language"), "de");
  assert.equal(form.get("timestamp_granularities"), "segment");
  assert.equal((form.get("file") as File).name, "a.webm");
  assert.equal((aufrufe[0].init.headers as Record<string, string>).authorization, "Bearer geheim");
});

test("Transkription: Sekunden aus dem letzten Segment, wenn usage fehlt; ohne Text aus Segmenten", () => {
  assert.equal(transkriptLesen({ segments: [{ start: 0, end: 61.2, text: "x" }] }).sekunden, 62);
  assert.equal(transkriptLesen({ segments: [{ start: 0, end: 1, text: "a" }, { start: 1, end: 2, text: "b" }] }).text, "a b");
  assert.deepEqual(transkriptLesen(null), { text: "", segmente: [], sekunden: null });
});

test("Transkription: 429 → ein Retry, dann Erfolg; zweimal 429 → KiAusgelastet", async () => {
  const a = mock([() => new Response("{}", { status: 429 }), () => Response.json({ text: "ok" })]);
  assert.equal((await transkribierenMit(KONFIG, { datei: AUDIO, dateiname: "a.webm" }, a.u)).text, "ok");
  assert.deepEqual(a.pausen, [2000]);
  const b = mock([() => new Response("{}", { status: 429 })]);
  await assert.rejects(transkribierenMit(KONFIG, { datei: AUDIO, dateiname: "a.webm" }, b.u), KiAusgelastet);
  assert.equal(b.aufrufe.length, 2);
});

test("Transkription: Timeout, fehlendes Modell, leere Aufnahme", async () => {
  const lange = mock(
    [
      () =>
        new Promise<Response>((_, reject) => {
          setTimeout(() => reject(new DOMException("abgebrochen", "AbortError")), 80);
        }),
    ],
    { timeoutMs: 20 },
  );
  await assert.rejects(transkribierenMit(KONFIG, { datei: AUDIO, dateiname: "a.webm" }, lange.u), KiZeitueberschreitung);
  const nie = mock([() => Response.json({})]);
  await assert.rejects(transkribierenMit({ ...KONFIG, sttModell: undefined }, { datei: AUDIO, dateiname: "a" }, nie.u), KiKonfiguration);
  await assert.rejects(transkribierenMit({ ...KONFIG, apiKey: "" }, { datei: AUDIO, dateiname: "a" }, nie.u), KiKonfiguration);
  await assert.rejects(transkribierenMit(KONFIG, { datei: new Blob([]), dateiname: "a" }, nie.u), KiEingabe);
  assert.equal(nie.aufrufe.length, 0);
});

test("Transkription: Timeout wächst mit der Audiolänge (1–5 Minuten)", () => {
  assert.equal(transkriptionsTimeoutMs(10), 70_000);
  assert.equal(transkriptionsTimeoutMs(0.5), 60_500);
  assert.equal(transkriptionsTimeoutMs(600), 300_000);
  assert.equal(transkriptionsTimeoutMs(undefined), 300_000);
});

// ---------------------------------------------------------------------------
// Sprachausgabe
// ---------------------------------------------------------------------------

test("Sprechen: Anfrage mit model, input, voice_id, Format; rohes Audio wird durchgereicht", async () => {
  const { u, aufrufe } = mock([() => new Response(new Uint8Array([9, 8, 7]), { status: 200, headers: { "content-type": "audio/mpeg" } })]);
  const r = await sprechenMit(KONFIG, { text: "  Hallo  ", format: "mp3", stream: true }, u);
  assert.deepEqual(await bytes(r.audio), [9, 8, 7]);
  assert.equal(r.mime, "audio/mpeg");
  assert.equal(r.zeichen, 5);
  assert.equal(aufrufe[0].url, "https://api.example.test/v1/audio/speech");
  assert.deepEqual(JSON.parse(String(aufrufe[0].init.body)), { model: "tts-test", input: "Hallo", voice_id: "stimme-de", response_format: "mp3", stream: true });
});

test("Sprechen: JSON mit base64 audio_data", async () => {
  const { u } = mock([() => Response.json({ audio_data: b64([1, 2, 255]) })]);
  assert.deepEqual(await bytes((await sprechenMit(KONFIG, { text: "x" }, u)).audio), [1, 2, 255]);
});

test("Sprechen: Ereignisstrom mit base64-Stücken wird zu einem Byte-Strom", async () => {
  const sse =
    `data: ${JSON.stringify({ type: "speech.audio.delta", audio_data: b64([1, 2]) })}\n\n` +
    `data: ${JSON.stringify({ type: "speech.audio.delta", audio_data: b64([3]) })}\n\n` +
    `data: ${JSON.stringify({ type: "speech.audio.done", usage: {} })}\n\n`;
  const { u } = mock([() => new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } })]);
  assert.deepEqual(await bytes((await sprechenMit(KONFIG, { text: "x", stream: true, format: "opus" }, u)).audio), [1, 2, 3]);
});

test("Sprechen: leerer/zu langer Text, fehlendes Modell; ohne Stimme kein voice_id", async () => {
  const { u, aufrufe } = mock([() => new Response(new Uint8Array([1]), { headers: { "content-type": "audio/mpeg" } })]);
  await assert.rejects(sprechenMit(KONFIG, { text: "   " }, u), KiEingabe);
  await assert.rejects(sprechenMit(KONFIG, { text: "a".repeat(4001) }, u), KiEingabe);
  await assert.rejects(sprechenMit({ ...KONFIG, ttsModell: undefined }, { text: "x" }, u), KiKonfiguration);
  assert.equal(aufrufe.length, 0);
  await sprechenMit({ ...KONFIG, stimme: undefined }, { text: "x" }, u);
  assert.equal(JSON.parse(String(aufrufe[0].init.body)).voice_id, undefined);
});
