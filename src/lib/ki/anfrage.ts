/**
 * KI-00: Anbieterneutraler Aufruf einer OpenAI-kompatiblen Chat-API (z. B. Mistral).
 * Reine Logik ohne Next.js-Abhängigkeiten, damit sie mit gemocktem fetch testbar ist.
 * Im App-Code NICHT direkt importieren, sondern über `anbieter.ts` (server-only).
 */
import { KiAusgelastet, KiKonfiguration, KiNichtVerfuegbar, KiZeitueberschreitung } from "./fehler.ts";

export type KiKonfig = {
  basisUrl: string;
  modell: string;
  apiKey: string | undefined;
};

export type KiOptionen = {
  system: string;
  nutzer: string;
  maxTokens: number;
  temperatur: number;
  /** Antwort als JSON-Objekt erzwingen */
  json?: boolean;
};

export type KiAntwort = { text: string; tokensEin: number; tokensAus: number };

export type KiUmgebung = {
  fetch: typeof fetch;
  /** Wartezeit vor dem einen Wiederholungsversuch */
  warten: (ms: number) => Promise<void>;
  log: (eintrag: Record<string, unknown>) => void;
  timeoutMs: number;
  wiederholenNachMs: number;
};

const STANDARD_UMGEBUNG: KiUmgebung = {
  fetch: (...args) => fetch(...args),
  warten: (ms) => new Promise((r) => setTimeout(r, ms)),
  // Nie Key oder Inhalte loggen – nur Status, Modell, Dauer
  log: (eintrag) => console.info("[ki]", JSON.stringify(eintrag)),
  timeoutMs: 30_000,
  wiederholenNachMs: 2_000,
};

type Versuch = { ok: true; antwort: KiAntwort } | { ok: false; fehler: Error; wiederholbar: boolean };

async function einVersuch(konfig: KiKonfig, optionen: KiOptionen, u: KiUmgebung): Promise<Versuch> {
  const start = Date.now();
  const abbruch = new AbortController();
  const timer = setTimeout(() => abbruch.abort(), u.timeoutMs);
  let status = 0;
  try {
    const antwort = await u.fetch(`${konfig.basisUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${konfig.apiKey}`,
      },
      body: JSON.stringify({
        model: konfig.modell,
        messages: [
          { role: "system", content: optionen.system },
          { role: "user", content: optionen.nutzer },
        ],
        max_tokens: optionen.maxTokens,
        temperature: optionen.temperatur,
        ...(optionen.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: abbruch.signal,
    });
    status = antwort.status;

    if (status === 429) return { ok: false, fehler: new KiAusgelastet(), wiederholbar: true };
    if (status === 401 || status === 403) {
      return { ok: false, fehler: new KiKonfiguration(`Anbieter lehnt den Schlüssel ab (HTTP ${status})`), wiederholbar: false };
    }
    if (status >= 500) return { ok: false, fehler: new KiNichtVerfuegbar(`HTTP ${status}`), wiederholbar: true };
    if (!antwort.ok) return { ok: false, fehler: new KiNichtVerfuegbar(`HTTP ${status}`), wiederholbar: false };

    const daten = (await antwort.json()) as {
      choices?: { message?: { content?: unknown } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = daten.choices?.[0]?.message?.content;
    if (typeof text !== "string") {
      return { ok: false, fehler: new KiNichtVerfuegbar("Antwort ohne Text"), wiederholbar: false };
    }
    return {
      ok: true,
      antwort: { text, tokensEin: daten.usage?.prompt_tokens ?? 0, tokensAus: daten.usage?.completion_tokens ?? 0 },
    };
  } catch (err) {
    if (abbruch.signal.aborted) return { ok: false, fehler: new KiZeitueberschreitung(), wiederholbar: false };
    // Netzwerkfehler (DNS, Verbindung) wie 5xx behandeln
    return { ok: false, fehler: new KiNichtVerfuegbar(err instanceof Error ? err.message : "Netzwerkfehler"), wiederholbar: true };
  } finally {
    clearTimeout(timer);
    u.log({ modell: konfig.modell, status: status || (abbruch.signal.aborted ? "timeout" : "netzwerk"), dauer_ms: Date.now() - start });
  }
}

/** Ein Aufruf mit höchstens einem automatischen Wiederholungsversuch (429 / 5xx / Netzwerk). */
export async function kiAnfrageMit(konfig: KiKonfig, optionen: KiOptionen, umgebung: Partial<KiUmgebung> = {}): Promise<KiAntwort> {
  const u = { ...STANDARD_UMGEBUNG, ...umgebung };
  if (!konfig.apiKey?.trim()) throw new KiKonfiguration("Umgebungsvariable MISTRAL_API_KEY fehlt");
  if (!konfig.basisUrl || !konfig.modell) throw new KiKonfiguration("KI_BASIS_URL oder KI_MODELL fehlt");

  let versuch = await einVersuch(konfig, optionen, u);
  if (!versuch.ok && versuch.wiederholbar) {
    await u.warten(u.wiederholenNachMs);
    versuch = await einVersuch(konfig, optionen, u);
  }
  if (!versuch.ok) throw versuch.fehler;
  return versuch.antwort;
}
