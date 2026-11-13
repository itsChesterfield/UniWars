/**
 * KI-00/KI-00b: Anbieterneutraler Aufruf einer OpenAI-kompatiblen Chat-API (z. B. Mistral).
 * Reine Logik ohne Next.js-Abhängigkeiten, damit sie mit gemocktem fetch testbar ist.
 * Im App-Code NICHT direkt importieren, sondern über `anbieter.ts` (server-only).
 *
 * - kiAnfrageMit:       eine Antwort am Stück (mit einem Retry bei 429/5xx/Netz)
 * - kiAnfrageStreamMit: Antwort als Strom von Ereignissen (SSE), ohne Retry
 * Beide können Werkzeuge (Tool Calling) und ganze Unterhaltungen verarbeiten.
 */
import { KiAbgebrochen, KiAusgelastet, KiFehler, KiKonfiguration, KiNichtVerfuegbar, KiZeitueberschreitung } from "./fehler.ts";

export type KiKonfig = {
  basisUrl: string;
  modell: string;
  apiKey: string | undefined;
};

export type WerkzeugAufruf = { id: string; name: string; argumente: string };

/** Nachricht im OpenAI-Format (Rollen wie bei der API). */
export type Nachricht =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: WerkzeugAufruf[] }
  | { role: "tool"; content: string; tool_call_id: string; name: string };

/** Beschreibung eines Werkzeugs für das Modell (JSON-Schema der Parameter). */
export type WerkzeugDefinition = {
  name: string;
  beschreibung: string;
  parameter: Record<string, unknown>;
};

export type KiOptionen = {
  /** Kurzform: System- und Nutzertext … */
  system?: string;
  nutzer?: string;
  /** … oder eine ganze Unterhaltung (wird hinter system/nutzer gehängt, falls beides gesetzt) */
  nachrichten?: Nachricht[];
  werkzeuge?: WerkzeugDefinition[];
  /** anderes Modell als in der Konfiguration (z. B. KI_MODELL_CHAT) */
  modell?: string;
  maxTokens: number;
  temperatur: number;
  /** Antwort als JSON-Objekt erzwingen */
  json?: boolean;
  /** Abbruch durch den Nutzer (z. B. "Stopp") */
  signal?: AbortSignal;
};

export type KiAntwort = { text: string; tokensEin: number; tokensAus: number; werkzeugAufrufe: WerkzeugAufruf[] };

export type KiUmgebung = {
  fetch: typeof fetch;
  /** Wartezeit vor dem einen Wiederholungsversuch */
  warten: (ms: number) => Promise<void>;
  log: (eintrag: Record<string, unknown>) => void;
  timeoutMs: number;
  wiederholenNachMs: number;
};

export const STANDARD_UMGEBUNG: KiUmgebung = {
  fetch: (...args) => fetch(...args),
  warten: (ms) => new Promise((r) => setTimeout(r, ms)),
  // Nie Key oder Inhalte loggen – nur Status, Modell, Dauer
  log: (eintrag) => console.info("[ki]", JSON.stringify(eintrag)),
  timeoutMs: 30_000,
  wiederholenNachMs: 2_000,
};

/** Grobe Schätzung, falls der Anbieter keine Token-Zahlen liefert (≈ 4 Zeichen pro Token). */
export function tokensSchaetzen(text: string): number {
  return Math.ceil(text.length / 4);
}

export function konfigPruefen(konfig: KiKonfig) {
  if (!konfig.apiKey?.trim()) throw new KiKonfiguration("Umgebungsvariable MISTRAL_API_KEY fehlt");
  if (!konfig.basisUrl || !konfig.modell) throw new KiKonfiguration("KI_BASIS_URL oder KI_MODELL fehlt");
}

/** Nachrichtenliste für die API (Werkzeugaufrufe ins OpenAI-Format übersetzt). */
export function nachrichtenBauen(optionen: KiOptionen): Record<string, unknown>[] {
  const liste: Nachricht[] = [];
  if (optionen.system) liste.push({ role: "system", content: optionen.system });
  if (optionen.nutzer) liste.push({ role: "user", content: optionen.nutzer });
  liste.push(...(optionen.nachrichten ?? []));
  return liste.map((n) =>
    n.role === "assistant" && n.tool_calls?.length
      ? {
          role: "assistant",
          content: n.content,
          tool_calls: n.tool_calls.map((a) => ({ id: a.id, type: "function", function: { name: a.name, arguments: a.argumente } })),
        }
      : n,
  );
}

function anfrageKoerper(konfig: KiKonfig, optionen: KiOptionen, stream: boolean): string {
  return JSON.stringify({
    model: optionen.modell || konfig.modell,
    messages: nachrichtenBauen(optionen),
    max_tokens: optionen.maxTokens,
    temperature: optionen.temperatur,
    ...(optionen.json ? { response_format: { type: "json_object" } } : {}),
    ...(optionen.werkzeuge?.length
      ? {
          tools: optionen.werkzeuge.map((w) => ({
            type: "function",
            function: { name: w.name, description: w.beschreibung, parameters: w.parameter },
          })),
          tool_choice: "auto",
        }
      : {}),
    ...(stream ? { stream: true } : {}),
  });
}

/** HTTP-Status → Fehler (oder null, wenn alles gut ist). */
export function statusFehler(status: number): { fehler: KiFehler; wiederholbar: boolean } | null {
  if (status === 429) return { fehler: new KiAusgelastet(), wiederholbar: true };
  if (status === 401 || status === 403) {
    return { fehler: new KiKonfiguration(`Anbieter lehnt den Schlüssel ab (HTTP ${status})`), wiederholbar: false };
  }
  if (status >= 500) return { fehler: new KiNichtVerfuegbar(`HTTP ${status}`), wiederholbar: true };
  if (status < 200 || status >= 300) return { fehler: new KiNichtVerfuegbar(`HTTP ${status}`), wiederholbar: false };
  return null;
}

/** Verknüpft Nutzer-Abbruch und Timeout zu einem Signal. */
export function abbruchSteuerung(timeoutMs: number, extern?: AbortSignal) {
  const steuerung = new AbortController();
  let durchTimeout = false;
  let timer = setTimeout(() => {
    durchTimeout = true;
    steuerung.abort();
  }, timeoutMs);
  const weiterleiten = () => steuerung.abort();
  if (extern?.aborted) steuerung.abort();
  extern?.addEventListener("abort", weiterleiten, { once: true });
  return {
    signal: steuerung.signal,
    timeout: () => durchTimeout,
    /** Timeout neu starten (z. B. nach jedem empfangenen Stück im Stream) */
    neuStarten: () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        durchTimeout = true;
        steuerung.abort();
      }, timeoutMs);
    },
    aufraeumen: () => {
      clearTimeout(timer);
      extern?.removeEventListener("abort", weiterleiten);
    },
  };
}

type RohAufruf = { id?: string; function?: { name?: string; arguments?: unknown } };

function aufrufeLesen(roh: unknown): WerkzeugAufruf[] {
  if (!Array.isArray(roh)) return [];
  return (roh as RohAufruf[])
    .filter((a) => a?.function?.name)
    .map((a, i) => ({
      id: typeof a.id === "string" && a.id !== "null" ? a.id : `aufruf${i}`,
      name: String(a.function?.name),
      argumente: typeof a.function?.arguments === "string" ? a.function.arguments : JSON.stringify(a.function?.arguments ?? {}),
    }));
}

type Versuch = { ok: true; antwort: KiAntwort } | { ok: false; fehler: Error; wiederholbar: boolean };

async function einVersuch(konfig: KiKonfig, optionen: KiOptionen, u: KiUmgebung): Promise<Versuch> {
  const start = Date.now();
  const abbruch = abbruchSteuerung(u.timeoutMs, optionen.signal);
  let status = 0;
  try {
    const antwort = await u.fetch(`${konfig.basisUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${konfig.apiKey}` },
      body: anfrageKoerper(konfig, optionen, false),
      signal: abbruch.signal,
    });
    status = antwort.status;
    const problem = statusFehler(status);
    if (problem) return { ok: false, ...problem };

    const daten = (await antwort.json()) as {
      choices?: { message?: { content?: unknown; tool_calls?: unknown } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const nachricht = daten.choices?.[0]?.message;
    const text = typeof nachricht?.content === "string" ? nachricht.content : "";
    const werkzeugAufrufe = aufrufeLesen(nachricht?.tool_calls);
    if (!text && werkzeugAufrufe.length === 0) {
      return { ok: false, fehler: new KiNichtVerfuegbar("Antwort ohne Text"), wiederholbar: false };
    }
    return {
      ok: true,
      antwort: { text, tokensEin: daten.usage?.prompt_tokens ?? 0, tokensAus: daten.usage?.completion_tokens ?? 0, werkzeugAufrufe },
    };
  } catch (err) {
    if (abbruch.timeout()) return { ok: false, fehler: new KiZeitueberschreitung(), wiederholbar: false };
    if (optionen.signal?.aborted) return { ok: false, fehler: new KiAbgebrochen("vom Nutzer abgebrochen"), wiederholbar: false };
    // Netzwerkfehler (DNS, Verbindung) wie 5xx behandeln
    return { ok: false, fehler: new KiNichtVerfuegbar(err instanceof Error ? err.message : "Netzwerkfehler"), wiederholbar: true };
  } finally {
    abbruch.aufraeumen();
    u.log({
      modell: optionen.modell || konfig.modell,
      status: status || (abbruch.timeout() ? "timeout" : "netzwerk"),
      dauer_ms: Date.now() - start,
    });
  }
}

/** Ein Aufruf mit höchstens einem automatischen Wiederholungsversuch (429 / 5xx / Netzwerk). */
export async function kiAnfrageMit(konfig: KiKonfig, optionen: KiOptionen, umgebung: Partial<KiUmgebung> = {}): Promise<KiAntwort> {
  const u = { ...STANDARD_UMGEBUNG, ...umgebung };
  konfigPruefen(konfig);

  let versuch = await einVersuch(konfig, optionen, u);
  if (!versuch.ok && versuch.wiederholbar && !optionen.signal?.aborted) {
    await u.warten(u.wiederholenNachMs);
    versuch = await einVersuch(konfig, optionen, u);
  }
  if (!versuch.ok) throw versuch.fehler;
  return versuch.antwort;
}

// ---------------------------------------------------------------------------
// Streaming (Server-Sent Events im OpenAI-Format)
// ---------------------------------------------------------------------------

export type StreamEreignis =
  | { typ: "text"; text: string }
  /** Modell möchte Werkzeuge aufrufen (kommt am Ende der Runde, vollständig zusammengesetzt) */
  | { typ: "werkzeuge"; aufrufe: WerkzeugAufruf[] }
  /** Abbruch mitten im Stream – bisheriger Text bleibt gültig */
  | { typ: "fehler"; fehler: KiFehler }
  | { typ: "ende"; tokensEin: number; tokensAus: number; geschaetzt: boolean };

/**
 * Zerlegt einen SSE-Byte-Strom in die JSON-Nutzlasten der `data:`-Zeilen.
 * Kommt mit Stücken zurecht, die mitten in einer Zeile enden. `[DONE]` beendet.
 */
export async function* sseDaten(strom: ReadableStream<Uint8Array>, onStueck?: () => void): AsyncGenerator<unknown> {
  const leser = strom.getReader();
  const dekoder = new TextDecoder();
  let puffer = "";
  try {
    while (true) {
      const { value, done } = await leser.read();
      if (done) break;
      onStueck?.();
      puffer += dekoder.decode(value, { stream: true });
      let umbruch: number;
      while ((umbruch = puffer.indexOf("\n")) !== -1) {
        const zeile = puffer.slice(0, umbruch).replace(/\r$/, "");
        puffer = puffer.slice(umbruch + 1);
        if (!zeile.startsWith("data:")) continue;
        const daten = zeile.slice(5).trim();
        if (daten === "[DONE]") return;
        if (!daten) continue;
        try {
          yield JSON.parse(daten);
        } catch {
          // unvollständige oder kaputte Zeile überspringen
        }
      }
    }
  } finally {
    leser.releaseLock();
  }
}

type DeltaAufruf = { index?: number; id?: string; function?: { name?: string; arguments?: string } };
type StreamStueck = {
  choices?: { delta?: { content?: unknown; tool_calls?: DeltaAufruf[] }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
};

/**
 * Antwort als Strom. Kein Retry (bereits gezeigter Text ließe sich nicht zurücknehmen).
 * Fehler VOR dem ersten Stück werden geworfen; Fehler danach kommen als Ereignis
 * `fehler`, gefolgt von `ende` – der bis dahin empfangene Text bleibt erhalten.
 */
export async function* kiAnfrageStreamMit(
  konfig: KiKonfig,
  optionen: KiOptionen,
  umgebung: Partial<KiUmgebung> = {},
): AsyncGenerator<StreamEreignis> {
  const u = { ...STANDARD_UMGEBUNG, ...umgebung };
  konfigPruefen(konfig);
  const start = Date.now();
  const abbruch = abbruchSteuerung(u.timeoutMs, optionen.signal);
  let status = 0;
  let text = "";
  let usage: { prompt_tokens?: number; completion_tokens?: number } | null = null;
  // Werkzeugaufrufe kommen in Bruchstücken, zusammengesetzt über ihren Index
  const aufrufe = new Map<number, { id: string; name: string; argumente: string }>();

  try {
    let antwort: Response;
    try {
      antwort = await u.fetch(`${konfig.basisUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream", authorization: `Bearer ${konfig.apiKey}` },
        body: anfrageKoerper(konfig, optionen, true),
        signal: abbruch.signal,
      });
    } catch (err) {
      if (abbruch.timeout()) throw new KiZeitueberschreitung();
      if (optionen.signal?.aborted) throw new KiAbgebrochen("vom Nutzer abgebrochen");
      throw new KiNichtVerfuegbar(err instanceof Error ? err.message : "Netzwerkfehler");
    }
    status = antwort.status;
    const problem = statusFehler(status);
    if (problem) throw problem.fehler;
    if (!antwort.body) throw new KiNichtVerfuegbar("Antwort ohne Inhalt");

    try {
      for await (const roh of sseDaten(antwort.body, abbruch.neuStarten)) {
        const stueck = roh as StreamStueck;
        if (stueck.usage) usage = stueck.usage;
        const wahl = stueck.choices?.[0];
        const inhalt = wahl?.delta?.content;
        if (typeof inhalt === "string" && inhalt) {
          text += inhalt;
          yield { typ: "text", text: inhalt };
        }
        for (const [i, d] of (wahl?.delta?.tool_calls ?? []).entries()) {
          const index = typeof d.index === "number" ? d.index : i;
          const bisher = aufrufe.get(index) ?? { id: "", name: "", argumente: "" };
          if (d.id && d.id !== "null") bisher.id = d.id;
          if (d.function?.name) bisher.name += d.function.name;
          if (typeof d.function?.arguments === "string") bisher.argumente += d.function.arguments;
          aufrufe.set(index, bisher);
        }
      }
    } catch (err) {
      const intern = abbruch.timeout() ? "Timeout im Stream" : optionen.signal?.aborted ? "vom Nutzer abgebrochen" : String(err);
      yield { typ: "fehler", fehler: new KiAbgebrochen(intern) };
    }

    const fertig = [...aufrufe.entries()]
      .sort(([a], [b]) => a - b)
      .map(([i, a]) => ({ id: a.id || `aufruf${i}`, name: a.name, argumente: a.argumente || "{}" }))
      .filter((a) => a.name);
    if (fertig.length) yield { typ: "werkzeuge", aufrufe: fertig };

    const geschaetzt = !usage;
    yield {
      typ: "ende",
      tokensEin: usage?.prompt_tokens ?? tokensSchaetzen(JSON.stringify(nachrichtenBauen(optionen))),
      tokensAus: usage?.completion_tokens ?? tokensSchaetzen(text + fertig.map((a) => a.argumente).join("")),
      geschaetzt,
    };
  } finally {
    abbruch.aufraeumen();
    u.log({
      modell: optionen.modell || konfig.modell,
      status: status || (abbruch.timeout() ? "timeout" : "netzwerk"),
      stream: true,
      tokens_geschaetzt: !usage,
      dauer_ms: Date.now() - start,
    });
  }
}
