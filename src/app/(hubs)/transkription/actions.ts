"use server";

import { revalidatePath } from "next/cache";
import { KiEingabe } from "@/lib/ki/fehler";
import { istErlaubteAnzahl, kartenParsen, kartenPromptBauen, type Vorschlag } from "@/lib/ki/karten";
import {
  abschnitte,
  anfragenFuerMitschrift,
  mitschriftLesen,
  mitschriftPrompt,
  teilMitschriftenPruefen,
  zusammenfuehrenPrompt,
} from "@/lib/ki/mitschrift";
import {
  alsFehler,
  audioStatus,
  kiNutzer,
  pflichttext,
  textAnfrageAusfuehren,
  textHeuteGenutzt,
  textVoraussetzungen,
  type AudioStatus,
  type KiErgebnis,
} from "@/lib/ki/server";
import { kiLimits } from "@/lib/ki/limits";
import type { Json } from "@/lib/supabase/types";
import { transkriptZusammensetzen } from "@/lib/transkription/server";
import {
  absaetzeAlsText,
  absaetzeLesen,
  MAX_AUFNAHME_SEKUNDEN,
  MAX_DATEI_SEKUNDEN,
  notizTitel,
  TEIL_SEKUNDEN,
  type Absatz,
  type TeilStatus,
} from "@/lib/transkription/transkript";

/**
 * Transkriptions-Hub (TRA-01 … TRA-05) und KI-04. Alle Aktionen laufen mit dem
 * Supabase-Client des Nutzers (RLS). Fehler kommen als Wert, damit die Meldung ankommt.
 */

type Ergebnis<T> = KiErgebnis<T>;

export type TeilStand = {
  id: string;
  nr: number;
  datei_id: string | null;
  sekunden: number;
  status: TeilStatus;
  fehler: string | null;
  gestartet_am: string | null;
  text: string;
};

export type TranskriptStand = { teile: TeilStand[]; absaetze: Absatz[]; text: string };

async function fachName(supabase: Awaited<ReturnType<typeof kiNutzer>>["supabase"], fachId: string | null) {
  if (!fachId) return null;
  const { data } = await supabase.from("fach").select("name").eq("id", fachId).maybeSingle();
  return data?.name ?? null;
}

/** Kontingent, Einwilligungen und Verfügbarkeit für die Anzeige vor dem Start (KI-ALL-03). */
export async function audioKiStatus(): Promise<Ergebnis<AudioStatus>> {
  try {
    const { supabase, userId } = await kiNutzer();
    return { ok: true, daten: await audioStatus(supabase, userId) };
  } catch (err) {
    return alsFehler(err);
  }
}

/** TRA-01/02: Transkript mit seinen Audioteilen anlegen (noch nichts transkribiert). */
export async function transkriptAnlegen(eingabe: {
  titel: string;
  fachId: string | null;
  quelle: "aufnahme" | "datei";
  sprache: "de" | "en";
  teile: { dateiId: string; sekunden: number }[];
}): Promise<Ergebnis<{ id: string }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const titel = pflichttext(eingabe.titel, "Titel", 200);
    const teile = Array.isArray(eingabe.teile) ? eingabe.teile : [];
    if (teile.length === 0 || teile.length > 30) throw new KiEingabe("Keine Aufnahme ausgewählt.");
    const maxTeil = eingabe.quelle === "aufnahme" ? TEIL_SEKUNDEN + 30 : MAX_DATEI_SEKUNDEN;
    for (const t of teile) {
      if (typeof t.dateiId !== "string" || !Number.isFinite(t.sekunden) || t.sekunden <= 0) throw new KiEingabe("Ungültige Aufnahme.");
      if (t.sekunden > maxTeil) throw new KiEingabe("Die Datei ist länger als 60 Minuten. Bitte teile sie vorher auf.");
    }
    if (teile.reduce((n, t) => n + t.sekunden, 0) > MAX_AUFNAHME_SEKUNDEN + 60) throw new KiEingabe("Eine Aufnahme darf höchstens 2 Stunden lang sein.");

    const { data: dateien } = await supabase.from("datei").select("id, mime_typ").in("id", teile.map((t) => t.dateiId));
    if ((dateien ?? []).length !== new Set(teile.map((t) => t.dateiId)).size || dateien?.some((d) => !d.mime_typ.startsWith("audio/"))) {
      throw new KiEingabe("Die Audiodatei wurde nicht gefunden.");
    }

    const { data: transkript, error } = await supabase
      .from("transkript")
      .insert({ user_id: userId, titel, fach_id: eingabe.fachId || null, quelle: eingabe.quelle, sprache: eingabe.sprache === "en" ? "en" : "de" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { error: teilFehler } = await supabase.from("transkript_teil").insert(
      teile.map((t, i) => ({
        user_id: userId,
        transkript_id: transkript.id,
        nr: i + 1,
        datei_id: t.dateiId,
        sekunden: Math.max(1, Math.ceil(t.sekunden)),
      })),
    );
    if (teilFehler) {
      await supabase.from("transkript").delete().eq("id", transkript.id);
      throw new Error(teilFehler.message);
    }
    revalidatePath("/transkription");
    return { ok: true, daten: { id: transkript.id } };
  } catch (err) {
    return alsFehler(err);
  }
}

/** Status für die Abfrage alle 3 Sekunden (TRA-03). */
export async function transkriptStand(id: string): Promise<Ergebnis<TranskriptStand>> {
  try {
    const { supabase } = await kiNutzer();
    const [{ data: teile, error }, { data: transkript }] = await Promise.all([
      supabase
        .from("transkript_teil")
        .select("id, nr, datei_id, sekunden, status, fehler, gestartet_am, text")
        .eq("transkript_id", id)
        .order("nr"),
      supabase.from("transkript").select("absaetze, text").eq("id", id).maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    if (!transkript) throw new KiEingabe("Transkript nicht gefunden.");
    return {
      ok: true,
      daten: {
        teile: (teile ?? []).map((t) => ({ ...t, status: t.status as TeilStatus })),
        absaetze: absaetzeLesen(transkript.absaetze) ?? [],
        text: transkript.text,
      },
    };
  } catch (err) {
    return alsFehler(err);
  }
}

export async function transkriptAendern(id: string, aenderung: { titel?: string; sprache?: "de" | "en"; fachId?: string | null }): Promise<Ergebnis<null>> {
  try {
    const { supabase } = await kiNutzer();
    const neu: { titel?: string; sprache?: string; fach_id?: string | null } = {};
    if (aenderung.titel !== undefined) neu.titel = pflichttext(aenderung.titel, "Titel", 200);
    if (aenderung.sprache !== undefined) neu.sprache = aenderung.sprache === "en" ? "en" : "de";
    if (aenderung.fachId !== undefined) neu.fach_id = aenderung.fachId || null;
    const { error } = await supabase.from("transkript").update(neu).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/transkription");
    return { ok: true, daten: null };
  } catch (err) {
    return alsFehler(err);
  }
}

/** TRA-04: bearbeitete Absätze speichern (Fließtext wird mitgeführt). */
export async function absaetzeSpeichern(id: string, absaetzeRoh: unknown): Promise<Ergebnis<null>> {
  try {
    const { supabase } = await kiNutzer();
    const absaetze = absaetzeLesen(absaetzeRoh);
    if (!absaetze) throw new KiEingabe("Der Text ist zu lang.");
    const { error } = await supabase
      .from("transkript")
      .update({ absaetze: absaetze as unknown as Json, text: absaetzeAlsText(absaetze) })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true, daten: null };
  } catch (err) {
    return alsFehler(err);
  }
}

/** TRA-05: Rohtext als neue Notiz „Transkript – Fach – Datum“. */
export async function alsNotizSpeichern(id: string): Promise<Ergebnis<{ notizId: string }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const { data: t } = await supabase.from("transkript").select("text, fach_id, erstellt_am").eq("id", id).maybeSingle();
    if (!t) throw new KiEingabe("Transkript nicht gefunden.");
    if (!t.text.trim()) throw new KiEingabe("Das Transkript ist noch leer.");
    const titel = notizTitel(await fachName(supabase, t.fach_id), new Date(t.erstellt_am));
    const { data, error } = await supabase
      .from("notiz")
      // Spracherkennung ist eine KI-Funktion → gekennzeichnet (KI-ALL-04)
      .insert({ user_id: userId, titel, inhalt: t.text.slice(0, 200_000), fach_id: t.fach_id, ki_erzeugt: true, quelle_transkript_id: id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/notizen");
    return { ok: true, daten: { notizId: data.id } };
  } catch (err) {
    return alsFehler(err);
  }
}

/** Absätze bilden, falls das nach der Umwandlung nicht geklappt hat (z. B. Abbruch des Servers). */
export async function transkriptAbschliessen(id: string): Promise<Ergebnis<{ vollstaendig: boolean }>> {
  try {
    const { supabase } = await kiNutzer();
    return { ok: true, daten: { vollstaendig: await transkriptZusammensetzen(supabase, id) } };
  } catch (err) {
    return alsFehler(err);
  }
}

/** Transkript löschen – die Audiodateien bleiben in der Dateiablage. */
export async function transkriptLoeschen(id: string): Promise<Ergebnis<null>> {
  try {
    const { supabase } = await kiNutzer();
    const { error } = await supabase.from("transkript").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/transkription");
    return { ok: true, daten: null };
  } catch (err) {
    return alsFehler(err);
  }
}

// ---------------------------------------------------------------------------
// KI-04: Transkript → Mitschrift (Map-Reduce) und Karteikarten
// ---------------------------------------------------------------------------

async function fertigerText(supabase: Awaited<ReturnType<typeof kiNutzer>>["supabase"], id: string) {
  const [{ data: t }, { data: offen }] = await Promise.all([
    supabase.from("transkript").select("titel, text, fach_id, erstellt_am").eq("id", id).maybeSingle(),
    supabase.from("transkript_teil").select("id").eq("transkript_id", id).neq("status", "fertig").limit(1),
  ]);
  if (!t) throw new KiEingabe("Transkript nicht gefunden.");
  if (offen?.length) throw new KiEingabe("Das Transkript ist noch nicht fertig.");
  return t;
}

/** Was kostet die Aufbereitung? (Vorschau vor dem Start) */
export async function mitschriftPlan(id: string): Promise<Ergebnis<{ abschnitte: number; anfragen: number; verbleibendHeute: number; limit: number }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    await textVoraussetzungen(supabase, userId);
    const t = await fertigerText(supabase, id);
    const n = abschnitte(t.text).length;
    const limit = kiLimits().text.limit;
    return { ok: true, daten: { abschnitte: n, anfragen: anfragenFuerMitschrift(n), verbleibendHeute: Math.max(0, limit - (await textHeuteGenutzt(supabase))), limit } };
  } catch (err) {
    return alsFehler(err);
  }
}

/** Einen Abschnitt aufbereiten (bei kurzen Transkripten: das Ganze). Eine gebuchte Anfrage. */
export async function mitschriftAbschnitt(id: string, nr: number): Promise<Ergebnis<{ markdown: string; verbleibendHeute: number }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    await textVoraussetzungen(supabase, userId);
    const t = await fertigerText(supabase, id);
    const teile = abschnitte(t.text);
    if (!Number.isInteger(nr) || nr < 1 || nr > teile.length) throw new KiEingabe("Ungültiger Abschnitt.");
    const prompt = mitschriftPrompt(t.titel, teile[nr - 1], nr, teile.length);
    const { ergebnis, verbleibend } = await textAnfrageAusfuehren({
      supabase,
      funktion: "mitschrift",
      optionen: { system: prompt.system, nutzer: prompt.nutzer, temperatur: 0.2, maxTokens: 4000 },
      zweck: "lang",
      parsen: (a) => mitschriftLesen(a.text),
    });
    return { ok: true, daten: { markdown: ergebnis, verbleibendHeute: verbleibend } };
  } catch (err) {
    return alsFehler(err);
  }
}

/** Die Abschnitts-Mitschriften zusammenführen (letzter Schritt bei langen Transkripten). */
export async function mitschriftZusammenfuehren(id: string, teileRoh: unknown): Promise<Ergebnis<{ markdown: string; verbleibendHeute: number }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    await textVoraussetzungen(supabase, userId);
    const t = await fertigerText(supabase, id);
    const teile = teilMitschriftenPruefen(teileRoh);
    const prompt = zusammenfuehrenPrompt(t.titel, teile);
    const { ergebnis, verbleibend } = await textAnfrageAusfuehren({
      supabase,
      funktion: "mitschrift",
      optionen: { system: prompt.system, nutzer: prompt.nutzer, temperatur: 0.2, maxTokens: 8000 },
      zweck: "lang",
      parsen: (a) => mitschriftLesen(a.text),
    });
    return { ok: true, daten: { markdown: ergebnis, verbleibendHeute: verbleibend } };
  } catch (err) {
    return alsFehler(err);
  }
}

/** Bestätigte Mitschrift als neue Notiz speichern (KI-ALL-01, KI-ALL-04). */
export async function mitschriftUebernehmen(id: string, markdown: string): Promise<Ergebnis<{ notizId: string }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const inhalt = pflichttext(markdown, "Mitschrift", 100_000);
    const { data: t } = await supabase.from("transkript").select("fach_id, erstellt_am").eq("id", id).maybeSingle();
    if (!t) throw new KiEingabe("Transkript nicht gefunden.");
    const titel = notizTitel(await fachName(supabase, t.fach_id), new Date(t.erstellt_am), "Mitschrift");
    const { data, error } = await supabase
      .from("notiz")
      .insert({ user_id: userId, titel, inhalt, fach_id: t.fach_id, ki_erzeugt: true, quelle_transkript_id: id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/notizen");
    return { ok: true, daten: { notizId: data.id } };
  } catch (err) {
    return alsFehler(err);
  }
}

/** Karteikarten aus dem Transkript (Pipeline aus Phase 7.8). Speichert nichts. */
export async function transkriptKartenVorschlagen(
  id: string,
  anzahl: number,
): Promise<Ergebnis<{ karten: Vorschlag[]; gekuerzt: boolean; verbleibendHeute: number }>> {
  try {
    if (!istErlaubteAnzahl(anzahl)) throw new KiEingabe("Bitte wähle 5, 10 oder 15 Karten.");
    const { supabase, userId } = await kiNutzer();
    await textVoraussetzungen(supabase, userId);
    const t = await fertigerText(supabase, id);
    const prompt = kartenPromptBauen({ titel: t.titel, text: t.text, quelle: "transkript" }, anzahl);
    const { ergebnis, verbleibend } = await textAnfrageAusfuehren({
      supabase,
      funktion: "transkript_karteikarten",
      optionen: { system: prompt.system, nutzer: prompt.nutzer, json: true, temperatur: 0.3, maxTokens: 2000 },
      parsen: (a) => kartenParsen(a.text, anzahl),
    });
    return { ok: true, daten: { karten: ergebnis, gekuerzt: prompt.gekuerzt, verbleibendHeute: verbleibend } };
  } catch (err) {
    return alsFehler(err);
  }
}
