import { agentLauf } from "@/lib/ki/agent";
import { kiAnfrage, kiAnfrageStream } from "@/lib/ki/anbieter";
import {
  kontextBlock,
  kontextPruefen,
  laufenderEintrag,
  MAX_FRAGE_ZEICHEN,
  modellNachrichten,
  titelAusFrage,
  verlaufKuerzen,
  zusammenfassungPrompt,
  type Aktionskarte,
  type GespeicherteNachricht,
  type KontextEingabe,
  type ObjektArt,
} from "@/lib/ki/assistent";
import { KiEingabe, KiFehler } from "@/lib/ki/fehler";
import { chatBuchen, chatHeuteGenutzt, kiNutzer, nutzungAbschliessen, textVoraussetzungen, type Supabase } from "@/lib/ki/server";
import { kiFehlerAntwort } from "@/lib/ki/stream-antwort";
import { lesewerkzeuge } from "@/lib/ki/werkzeuge/lesen";
import { umfeldLaden, vorschlagswerkzeuge } from "@/lib/ki/werkzeuge/vorschlagen";
import type { Json } from "@/lib/supabase/types";

/**
 * KI-12: UniWars-Assistent. Antwort als Server-Sent Events:
 *   start {unterhaltungId} · status {text} · text {text} · karte {karte} · fehler {fehler} · fertig {nachrichtId, verbleibend}
 * Fehler VOR dem Stream (Limit, Einwilligung, Eingabe) kommen als JSON mit Fehlerstatus.
 */
export const maxDuration = 120;

const MAX_VERLAUF_LADEN = 200;

/** Titel des geöffneten Objekts – der Server lädt es selbst (RLS) und vertraut keinem Client-Inhalt. */
async function objektTitel(supabase: Supabase, objekt: KontextEingabe["objekt"]): Promise<{ art: ObjektArt; id: string; titel: string } | null> {
  if (!objekt) return null;
  const abfrage = async (): Promise<string | null | undefined> => {
    switch (objekt.art) {
      case "notiz":
        return (await supabase.from("notiz").select("titel").eq("id", objekt.id).maybeSingle()).data?.titel;
      case "stapel":
        return (await supabase.from("kk_stapel").select("name").eq("id", objekt.id).maybeSingle()).data?.name;
      case "dokument":
        return (await supabase.from("dokument").select("titel").eq("id", objekt.id).maybeSingle()).data?.titel;
      case "pdf":
        return (await supabase.from("datei").select("name").eq("id", objekt.id).maybeSingle()).data?.name;
      case "transkript":
        return (await supabase.from("transkript").select("titel").eq("id", objekt.id).maybeSingle()).data?.titel;
      case "praesentation":
        return (await supabase.from("praesentation").select("titel").eq("id", objekt.id).maybeSingle()).data?.titel;
      case "tabelle":
        return (await supabase.from("tabelle").select("titel").eq("id", objekt.id).maybeSingle()).data?.titel;
      case "mindmap":
        return (await supabase.from("mindmap").select("name").eq("id", objekt.id).maybeSingle()).data?.name;
    }
  };
  const titel = await abfrage().catch(() => null);
  return typeof titel === "string" ? { ...objekt, titel: titel || "Ohne Titel" } : null;
}

async function laufendeVorlesung(supabase: Supabase, jetzt: Date) {
  const { data } = await supabase.from("stundenplan_eintrag").select("id, fach_id, tag, start_zeit, end_zeit");
  const e = laufenderEintrag(data ?? [], jetzt);
  if (!e) return null;
  const { data: fach } = await supabase.from("fach").select("name").eq("id", e.fach_id).maybeSingle();
  return { fach: fach?.name ?? "Vorlesung", bis: e.end_zeit.slice(0, 5) };
}

/** Ältere Nachrichten einmal zusammenfassen und an der Unterhaltung speichern (Fehler sind unkritisch). */
async function zusammenfassungAktualisieren(
  supabase: Supabase,
  unterhaltung: { id: string; zusammenfassung: string | null },
  neue: GespeicherteNachricht[],
): Promise<string | null> {
  if (neue.length === 0) return unterhaltung.zusammenfassung;
  try {
    const p = zusammenfassungPrompt(unterhaltung.zusammenfassung, neue);
    const a = await kiAnfrage({ system: p.system, nutzer: p.nutzer, temperatur: 0.2, maxTokens: 500 }, "standard");
    const text = a.text.trim().slice(0, 3000);
    if (!text) return unterhaltung.zusammenfassung;
    await supabase
      .from("ki_unterhaltung")
      .update({ zusammenfassung: text, zusammengefasst_bis: neue[neue.length - 1].erstellt_am })
      .eq("id", unterhaltung.id);
    return text;
  } catch {
    return unterhaltung.zusammenfassung;
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await kiNutzer();
    await textVoraussetzungen(supabase, userId);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const frage = typeof body.frage === "string" ? body.frage.trim() : "";
    if (!frage) throw new KiEingabe("Bitte gib eine Frage ein.");
    if (frage.length > MAX_FRAGE_ZEICHEN) throw new KiEingabe("Die Nachricht ist zu lang.");
    const eingabeArt = body.eingabeArt === "sprache" ? "sprache" : "text";
    const kontext = kontextPruefen(body.kontext);
    const jetzt = new Date();

    // Unterhaltung laden oder anlegen
    let unterhaltung: { id: string; zusammenfassung: string | null; zusammengefasst_bis: string | null };
    if (typeof body.unterhaltungId === "string" && body.unterhaltungId) {
      const { data } = await supabase.from("ki_unterhaltung").select("id, zusammenfassung, zusammengefasst_bis").eq("id", body.unterhaltungId).maybeSingle();
      if (!data) throw new KiEingabe("Unterhaltung nicht gefunden.");
      unterhaltung = data;
    } else {
      unterhaltung = { id: "", zusammenfassung: null, zusammengefasst_bis: null };
    }

    // Erst buchen (Limit vorab), dann speichern
    const buchung = await chatBuchen(supabase);
    if (!unterhaltung.id) {
      const { data, error } = await supabase
        .from("ki_unterhaltung")
        .insert({ user_id: userId, titel: titelAusFrage(frage) })
        .select("id, zusammenfassung, zusammengefasst_bis")
        .single();
      if (error) throw new Error(error.message);
      unterhaltung = data;
    }

    const { data: alteRoh } = await supabase
      .from("ki_nachricht")
      .select("rolle, inhalt, erstellt_am")
      .eq("unterhaltung_id", unterhaltung.id)
      .order("erstellt_am", { ascending: false })
      .limit(MAX_VERLAUF_LADEN);
    const alte = ((alteRoh ?? []) as GespeicherteNachricht[]).reverse();

    const { error: frageFehler } = await supabase
      .from("ki_nachricht")
      .insert({ user_id: userId, unterhaltung_id: unterhaltung.id, rolle: "nutzer", inhalt: frage, eingabe_art: eingabeArt });
    if (frageFehler) throw new Error(frageFehler.message);

    const [{ behalten, neuZusammenfassen }, objekt, laufend, umfeld] = await Promise.all([
      Promise.resolve(verlaufKuerzen(alte, unterhaltung.zusammengefasst_bis)),
      objektTitel(supabase, kontext.objekt),
      laufendeVorlesung(supabase, jetzt),
      umfeldLaden(supabase),
    ]);
    const zusammenfassung = await zusammenfassungAktualisieren(supabase, unterhaltung, neuZusammenfassen);

    const karten: Aktionskarte[] = [];
    const werkzeuge = [...lesewerkzeuge(supabase, jetzt), ...vorschlagswerkzeuge({ ...umfeld, jetzt }, karten)];
    const nachrichten = modellNachrichten({
      kontext: kontextBlock({ jetzt, hub: kontext.hub, objekt, laufend }),
      zusammenfassung,
      behalten,
      frage,
    });

    const abbruch = new AbortController();
    request.signal.addEventListener("abort", () => abbruch.abort(), { once: true });
    const encoder = new TextEncoder();
    const db = supabase;
    const gespraech = unterhaltung.id;

    const strom = new ReadableStream<Uint8Array>({
      async start(controller) {
        let offen = true;
        const senden = (daten: Record<string, unknown>) => {
          if (!offen) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(daten)}\n\n`));
          } catch {
            offen = false;
          }
        };
        senden({ typ: "start", unterhaltungId: gespraech });

        let text = "";
        let tokens = { tokensEin: 0, tokensAus: 0 };
        let erfolgreich = false;
        let fehlerText: string | null = null;
        const aufrufe: { name: string; fehler?: string }[] = [];
        let gesendeteKarten = 0;
        try {
          for await (const e of agentLauf({
            rufen: (o) => kiAnfrageStream(o, "chat"),
            optionen: { maxTokens: 1500, temperatur: 0.4, signal: abbruch.signal },
            nachrichten,
            werkzeuge,
          })) {
            if (e.typ === "status") senden({ typ: "status", text: e.text });
            else if (e.typ === "text") {
              text += e.text;
              senden({ typ: "text", text: e.text });
            } else if (e.typ === "werkzeug") {
              aufrufe.push({ name: e.name, ...(e.fehler ? { fehler: e.fehler } : {}) });
              while (gesendeteKarten < karten.length) senden({ typ: "karte", karte: karten[gesendeteKarten++] });
            } else if (e.typ === "fehler") {
              fehlerText = e.fehler.nutzerMeldung;
              senden({ typ: "fehler", fehler: fehlerText });
            } else if (e.typ === "ende") {
              tokens = { tokensEin: e.tokensEin, tokensAus: e.tokensAus };
              erfolgreich = !fehlerText;
            }
          }
        } catch (err) {
          fehlerText = abbruch.signal.aborted
            ? "Abgebrochen."
            : err instanceof KiFehler
              ? err.nutzerMeldung
              : "Da ist etwas schiefgelaufen. Bitte versuch es noch einmal.";
          if (!(err instanceof KiFehler) && !abbruch.signal.aborted) console.error("[ki] assistent", err instanceof Error ? err.message : err);
          senden({ typ: "fehler", fehler: fehlerText });
        }

        // Antwort speichern (auch Teilantworten nach Abbruch), Nutzung abschließen
        const inhalt = text.trim() || (karten.length ? "" : fehlerText ? `_(${fehlerText})_` : "");
        const { data: gespeichert } = await db
          .from("ki_nachricht")
          .insert({
            user_id: userId,
            unterhaltung_id: gespraech,
            rolle: "assistent",
            inhalt: inhalt.slice(0, 60_000),
            werkzeug_daten: aufrufe.length || karten.length ? ({ aufrufe, karten } as unknown as Json) : null,
          })
          .select("id")
          .single();
        await db.from("ki_unterhaltung").update({ geaendert_am: new Date().toISOString() }).eq("id", gespraech);
        await nutzungAbschliessen(db, buchung.nutzungId, { ...tokens, erfolgreich });
        const verbleibend = Math.max(0, buchung.limit - (await chatHeuteGenutzt(db)));
        senden({ typ: "fertig", nachrichtId: gespeichert?.id ?? null, verbleibend });
        if (offen) controller.close();
      },
      cancel() {
        abbruch.abort();
      },
    });

    return new Response(strom, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store, no-transform",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err) {
    return kiFehlerAntwort(err);
  }
}
