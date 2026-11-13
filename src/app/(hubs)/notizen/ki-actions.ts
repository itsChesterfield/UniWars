"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { kiAnfrage, kiKonfiguriert, kiTageslimit } from "@/lib/ki/anbieter";
import { KiEingabe, KiFehler, KiKeineEinwilligung, KiKonfiguration, KiLimitErreicht, type KiFehlerTyp } from "@/lib/ki/fehler";
import { istErlaubteAnzahl, kartenParsen, MAX_SEITE_ZEICHEN, promptBauen, type Vorschlag } from "@/lib/ki/karten";
import { berlinDatum, berlinMitternacht } from "@/lib/zeit";

/**
 * KI-01 / KI-D1 / KI-L1: Server Actions für "Karteikarten aus Notiz".
 * Erwartbare Fehler kommen als Rückgabewert (nicht als Exception), damit die
 * deutsche Meldung auch im Produktivbetrieb im UI ankommt.
 */

export type KiErgebnis<T> = { ok: true; daten: T } | { ok: false; fehler: string; typ: KiFehlerTyp };

const ALLGEMEINER_FEHLER = "Da ist etwas schiefgelaufen. Bitte versuch es noch einmal.";

async function nutzer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new KiEingabe("Bitte melde dich erneut an.");
  return { supabase, userId: user.id };
}

type Supabase = Awaited<ReturnType<typeof nutzer>>["supabase"];

function pflichttext(wert: unknown, feld: string, max: number) {
  const text = typeof wert === "string" ? wert.trim() : "";
  if (!text) throw new KiEingabe(`${feld} darf nicht leer sein.`);
  if (text.length > max) throw new KiEingabe(`${feld} ist zu lang.`);
  return text;
}

/** Fehler in einen Rückgabewert verwandeln – Details nur ins Server-Log. */
function alsFehler(err: unknown): { ok: false; fehler: string; typ: KiFehlerTyp } {
  if (err instanceof KiFehler) {
    if (err.typ === "technisch") console.error("[ki]", err.name, err.message);
    return { ok: false, fehler: err.nutzerMeldung, typ: err.typ };
  }
  console.error("[ki] unerwartet", err instanceof Error ? err.message : err);
  return { ok: false, fehler: ALLGEMEINER_FEHLER, typ: "technisch" };
}

async function heuteGenutzt(supabase: Supabase): Promise<number> {
  const { count } = await supabase
    .from("ki_nutzung")
    .select("id", { count: "exact", head: true })
    .gte("erstellt_am", berlinMitternacht(berlinDatum()).toISOString());
  return count ?? 0;
}

async function eingewilligt(supabase: Supabase, userId: string): Promise<boolean> {
  const { data } = await supabase.from("settings").select("ki_einwilligung").eq("user_id", userId).maybeSingle();
  return Boolean(data?.ki_einwilligung);
}

// ---------------------------------------------------------------------------
// KI-D1: Einwilligung
// ---------------------------------------------------------------------------

export async function kiEinwilligen(): Promise<KiErgebnis<null>> {
  try {
    const { supabase, userId } = await nutzer();
    const { error } = await supabase.from("settings").update({ ki_einwilligung: new Date().toISOString() }).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, daten: null };
  } catch (err) {
    return alsFehler(err);
  }
}

export async function kiEinwilligungWiderrufen(): Promise<KiErgebnis<null>> {
  try {
    const { supabase, userId } = await nutzer();
    const { error } = await supabase.from("settings").update({ ki_einwilligung: null }).eq("user_id", userId);
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return { ok: true, daten: null };
  } catch (err) {
    return alsFehler(err);
  }
}

// ---------------------------------------------------------------------------
// KI-L1: Nutzung heute / Status für den Dialog
// ---------------------------------------------------------------------------

export async function kiNutzungHeute(): Promise<{ genutzt: number; limit: number }> {
  const { supabase } = await nutzer();
  return { genutzt: await heuteGenutzt(supabase), limit: kiTageslimit() };
}

export type KiStatus = {
  verfuegbar: boolean;
  eingewilligt: boolean;
  genutzt: number;
  limit: number;
  stapel: { id: string; name: string; fach_id: string | null }[];
};

/** Alles, was der Dialog beim Öffnen braucht – in einem Aufruf. */
export async function kiStatus(): Promise<KiErgebnis<KiStatus>> {
  try {
    const { supabase, userId } = await nutzer();
    const [genutzt, einwilligung, { data: stapel }] = await Promise.all([
      heuteGenutzt(supabase),
      eingewilligt(supabase, userId),
      supabase.from("kk_stapel").select("id, name, fach_id").order("geaendert_am", { ascending: false }),
    ]);
    return {
      ok: true,
      daten: { verfuegbar: kiKonfiguriert(), eingewilligt: einwilligung, genutzt, limit: kiTageslimit(), stapel: stapel ?? [] },
    };
  } catch (err) {
    return alsFehler(err);
  }
}

// ---------------------------------------------------------------------------
// KI-01: Vorschläge erzeugen (speichert NICHTS in kk_karte)
// ---------------------------------------------------------------------------

export async function karteikartenVorschlagen(
  notizId: string,
  anzahl: number,
): Promise<KiErgebnis<{ karten: Vorschlag[]; gekuerzt: boolean; verbleibendHeute: number }>> {
  try {
    if (!istErlaubteAnzahl(anzahl)) throw new KiEingabe("Bitte wähle 5, 10 oder 15 Karten.");
    if (!kiKonfiguriert()) throw new KiKonfiguration("MISTRAL_API_KEY fehlt");
    const { supabase, userId } = await nutzer();

    if (!(await eingewilligt(supabase, userId))) throw new KiKeineEinwilligung();

    const { data: notiz } = await supabase.from("notiz").select("titel, inhalt").eq("id", notizId).maybeSingle();
    if (!notiz) throw new KiEingabe("Notiz nicht gefunden.");

    // Mindestlänge prüfen, BEVOR eine Anfrage vom Limit abgeht
    const prompt = promptBauen(notiz, anzahl);

    const limit = kiTageslimit();
    const { data: nutzungId, error: buchFehler } = await supabase.rpc("ki_nutzung_buchen", {
      p_funktion: "karteikarten",
      p_limit: limit,
    });
    if (buchFehler) {
      if (buchFehler.message.includes("KI_LIMIT")) throw new KiLimitErreicht(limit);
      throw new Error(`Buchung fehlgeschlagen: ${buchFehler.message}`);
    }

    let tokensEin = 0;
    let tokensAus = 0;
    let erfolgreich = false;
    try {
      const antwort = await kiAnfrage({ system: prompt.system, nutzer: prompt.nutzer, json: true, temperatur: 0.3, maxTokens: 2000 });
      tokensEin = antwort.tokensEin;
      tokensAus = antwort.tokensAus;
      const karten = kartenParsen(antwort.text, anzahl);
      erfolgreich = true;
      const genutzt = await heuteGenutzt(supabase);
      return { ok: true, daten: { karten, gekuerzt: prompt.gekuerzt, verbleibendHeute: Math.max(0, limit - genutzt) } };
    } finally {
      // Auch fehlgeschlagene Anfragen bleiben gebucht (zählen zum Limit)
      const { error } = await supabase.rpc("ki_nutzung_abschliessen", {
        p_id: nutzungId,
        p_tokens_ein: tokensEin,
        p_tokens_aus: tokensAus,
        p_erfolgreich: erfolgreich,
      });
      if (error) console.error("[ki] abschliessen fehlgeschlagen", error.message);
    }
  } catch (err) {
    return alsFehler(err);
  }
}

// ---------------------------------------------------------------------------
// KI-01: Bestätigte Vorschläge speichern
// ---------------------------------------------------------------------------

export type UebernahmeZiel = { stapelId: string } | { neuerStapel: { name: string; fachId: string | null } };

export async function vorschlaegeUebernehmen(
  ziel: UebernahmeZiel,
  karten: Vorschlag[],
): Promise<KiErgebnis<{ stapelId: string; stapelName: string; anzahl: number }>> {
  try {
    const { supabase, userId } = await nutzer();
    if (!Array.isArray(karten) || karten.length === 0) throw new KiEingabe("Wähle mindestens eine Karte aus.");
    if (karten.length > 15) throw new KiEingabe("Höchstens 15 Karten auf einmal.");
    // Erneut prüfen – der Client kann die Inhalte verändert haben
    const geprueft = karten.map((k) => ({
      vorderseite: pflichttext(k?.vorderseite, "Vorderseite", MAX_SEITE_ZEICHEN),
      rueckseite: pflichttext(k?.rueckseite, "Rückseite", MAX_SEITE_ZEICHEN),
    }));

    let stapelId: string;
    let stapelName: string;
    if ("neuerStapel" in ziel) {
      const { data, error } = await supabase
        .from("kk_stapel")
        .insert({ user_id: userId, name: pflichttext(ziel.neuerStapel.name, "Name des Stapels", 120), fach_id: ziel.neuerStapel.fachId || null })
        .select("id, name")
        .single();
      if (error) throw new Error(error.message);
      stapelId = data.id;
      stapelName = data.name;
    } else {
      const { data } = await supabase.from("kk_stapel").select("id, name").eq("id", ziel.stapelId).maybeSingle();
      if (!data) throw new KiEingabe("Stapel nicht gefunden.");
      stapelId = data.id;
      stapelName = data.name;
    }

    // Ein einziges insert; neue Karten starten als "Neu" (sofort fällig)
    const { error } = await supabase.from("kk_karte").insert(geprueft.map((k) => ({ ...k, user_id: userId, stapel_id: stapelId })));
    if (error) throw new Error(error.message);

    await supabase.from("kk_stapel").update({ geaendert_am: new Date().toISOString() }).eq("id", stapelId);
    revalidatePath("/karteikarten");
    revalidatePath(`/karteikarten/${stapelId}`);
    return { ok: true, daten: { stapelId, stapelName, anzahl: geprueft.length } };
  } catch (err) {
    return alsFehler(err);
  }
}
