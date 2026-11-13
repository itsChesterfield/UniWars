"use server";

import { revalidatePath } from "next/cache";
import { istErlaubteAnzahl, kartenParsen, MAX_SEITE_ZEICHEN, promptBauen, type Vorschlag } from "@/lib/ki/karten";
import { KiEingabe } from "@/lib/ki/fehler";
import {
  alsFehler,
  kiNutzer,
  pflichttext,
  textAnfrageAusfuehren,
  textHeuteGenutzt,
  textStatus,
  textVoraussetzungen,
  type KiErgebnis,
  type TextStatus,
} from "@/lib/ki/server";
import { kiLimits } from "@/lib/ki/limits";
import { zusammenfassungParsen, zusammenfassungPromptBauen, type Zusammenfassung } from "@/lib/ki/zusammenfassung";
import { entwurfBereinigen, MAX_KNOTEN_TEXT, mindmapParsen, mindmapPromptBauen, type MindmapEntwurf } from "@/lib/ki/mindmap";
import { radialLayout } from "@/lib/mindmap/knoten";
import type { Json } from "@/lib/supabase/types";
import type { Notiz } from "@/app/(hubs)/notizen/actions";

/**
 * KI-01 / KI-L1: Server Actions für "Karteikarten aus Notiz".
 * Erwartbare Fehler kommen als Rückgabewert (nicht als Exception), damit die
 * deutsche Meldung auch im Produktivbetrieb im UI ankommt.
 */

// ---------------------------------------------------------------------------
// KI-L1: Nutzung heute / Status für den Dialog
// ---------------------------------------------------------------------------

export async function kiNutzungHeute(): Promise<{ genutzt: number; limit: number }> {
  const { supabase } = await kiNutzer();
  return { genutzt: await textHeuteGenutzt(supabase), limit: kiLimits().text.limit };
}

/** Status für alle Text-KI-Dialoge (Key, Einwilligung, Limit). */
export async function kiTextStatus(): Promise<KiErgebnis<TextStatus>> {
  try {
    const { supabase, userId } = await kiNutzer();
    return { ok: true, daten: await textStatus(supabase, userId) };
  } catch (err) {
    return alsFehler(err);
  }
}

export type KiStatus = TextStatus & { stapel: { id: string; name: string; fach_id: string | null }[] };

/** Alles, was der Karteikarten-Dialog beim Öffnen braucht – in einem Aufruf. */
export async function kiStatus(): Promise<KiErgebnis<KiStatus>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const [status, { data: stapel }] = await Promise.all([
      textStatus(supabase, userId),
      supabase.from("kk_stapel").select("id, name, fach_id").order("geaendert_am", { ascending: false }),
    ]);
    return { ok: true, daten: { ...status, stapel: stapel ?? [] } };
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
    const { supabase, userId } = await kiNutzer();
    await textVoraussetzungen(supabase, userId);

    const { data: notiz } = await supabase.from("notiz").select("titel, inhalt").eq("id", notizId).maybeSingle();
    if (!notiz) throw new KiEingabe("Notiz nicht gefunden.");

    // Mindestlänge prüfen, BEVOR eine Anfrage vom Limit abgeht
    const prompt = promptBauen(notiz, anzahl);
    const { ergebnis, verbleibend } = await textAnfrageAusfuehren({
      supabase,
      funktion: "karteikarten",
      optionen: { system: prompt.system, nutzer: prompt.nutzer, json: true, temperatur: 0.3, maxTokens: 2000 },
      parsen: (a) => kartenParsen(a.text, anzahl),
    });
    return { ok: true, daten: { karten: ergebnis, gekuerzt: prompt.gekuerzt, verbleibendHeute: verbleibend } };
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
  /** KI-11: aus welcher Notiz die Karten stammen (für "Erklär mir das") */
  herkunft: { notizId?: string | null } = {},
): Promise<KiErgebnis<{ stapelId: string; stapelName: string; anzahl: number }>> {
  try {
    const { supabase, userId } = await kiNutzer();
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

    // Herkunft nur übernehmen, wenn die Notiz dem Nutzer gehört (RLS)
    let quelleNotizId: string | null = null;
    if (herkunft.notizId) {
      const { data } = await supabase.from("notiz").select("id").eq("id", herkunft.notizId).maybeSingle();
      quelleNotizId = data?.id ?? null;
    }

    // Ein einziges insert; neue Karten starten als "Neu" (sofort fällig)
    const { error } = await supabase
      .from("kk_karte")
      .insert(geprueft.map((k) => ({ ...k, user_id: userId, stapel_id: stapelId, ki_erzeugt: true, quelle_notiz_id: quelleNotizId })));
    if (error) throw new Error(error.message);

    await supabase.from("kk_stapel").update({ geaendert_am: new Date().toISOString() }).eq("id", stapelId);
    revalidatePath("/karteikarten");
    revalidatePath(`/karteikarten/${stapelId}`);
    return { ok: true, daten: { stapelId, stapelName, anzahl: geprueft.length } };
  } catch (err) {
    return alsFehler(err);
  }
}

// ---------------------------------------------------------------------------
// KI-02: Zusammenfassen und Lücken finden
// ---------------------------------------------------------------------------

export async function zusammenfassungVorschlagen(
  notizId: string,
): Promise<KiErgebnis<Zusammenfassung & { gekuerzt: boolean; verbleibendHeute: number }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    await textVoraussetzungen(supabase, userId);
    const { data: notiz } = await supabase.from("notiz").select("titel, inhalt").eq("id", notizId).maybeSingle();
    if (!notiz) throw new KiEingabe("Notiz nicht gefunden.");
    const prompt = zusammenfassungPromptBauen(notiz);
    const { ergebnis, verbleibend } = await textAnfrageAusfuehren({
      supabase,
      funktion: "zusammenfassung",
      optionen: { system: prompt.system, nutzer: prompt.nutzer, json: true, temperatur: 0.2, maxTokens: 1500 },
      parsen: (a) => zusammenfassungParsen(a.text),
    });
    return { ok: true, daten: { ...ergebnis, gekuerzt: prompt.gekuerzt, verbleibendHeute: verbleibend } };
  } catch (err) {
    return alsFehler(err);
  }
}

/** KI-02 übernehmen: oben in die Notiz einfügen oder als neue Notiz speichern. */
export async function zusammenfassungUebernehmen(
  notizId: string,
  markdown: string,
  modus: "oben" | "neu",
): Promise<KiErgebnis<{ notiz: Notiz }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const abschnitt = pflichttext(markdown, "Zusammenfassung", 20_000);
    const { data: notiz } = await supabase.from("notiz").select("*").eq("id", notizId).maybeSingle();
    if (!notiz) throw new KiEingabe("Notiz nicht gefunden.");

    if (modus === "oben") {
      const inhalt = `${abschnitt}\n\n${notiz.inhalt}`.slice(0, 200_000);
      const { data, error } = await supabase.from("notiz").update({ inhalt }).eq("id", notizId).select("*").single();
      if (error) throw new Error(error.message);
      revalidatePath("/notizen");
      return { ok: true, daten: { notiz: data } };
    }
    const titel = `Zusammenfassung: ${notiz.titel.trim() || "Unbenannte Notiz"}`.slice(0, 300);
    const { data, error } = await supabase
      .from("notiz")
      .insert({ user_id: userId, titel, inhalt: abschnitt, fach_id: notiz.fach_id, ki_erzeugt: true })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/notizen");
    return { ok: true, daten: { notiz: data } };
  } catch (err) {
    return alsFehler(err);
  }
}

// ---------------------------------------------------------------------------
// KI-07: MindMap aus Notiz
// ---------------------------------------------------------------------------

export async function mindmapVorschlagen(notizId: string): Promise<KiErgebnis<MindmapEntwurf & { gekuerzt: boolean; verbleibendHeute: number }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    await textVoraussetzungen(supabase, userId);
    const { data: notiz } = await supabase.from("notiz").select("titel, inhalt").eq("id", notizId).maybeSingle();
    if (!notiz) throw new KiEingabe("Notiz nicht gefunden.");
    const prompt = mindmapPromptBauen(notiz);
    const { ergebnis, verbleibend } = await textAnfrageAusfuehren({
      supabase,
      funktion: "mindmap",
      optionen: { system: prompt.system, nutzer: prompt.nutzer, json: true, temperatur: 0.3, maxTokens: 1500 },
      parsen: (a) => mindmapParsen(a.text, notiz.titel),
    });
    return { ok: true, daten: { ...ergebnis, gekuerzt: prompt.gekuerzt, verbleibendHeute: verbleibend } };
  } catch (err) {
    return alsFehler(err);
  }
}

/** KI-07 übernehmen: neue MindMap; die Positionen berechnet der Server (nicht die KI). */
export async function mindmapUebernehmen(entwurf: MindmapEntwurf, fachId: string | null): Promise<KiErgebnis<{ mindmapId: string }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const name = pflichttext(entwurf?.wurzel, "Hauptthema", MAX_KNOTEN_TEXT);
    // Erneut bereinigen – der Client kann den Baum verändert haben
    const knoten = entwurfBereinigen(entwurf?.knoten);
    if (knoten.length === 0) throw new KiEingabe("Die MindMap braucht mindestens einen Ast.");
    const daten = radialLayout(name, knoten);
    const { data, error } = await supabase
      .from("mindmap")
      .insert({ user_id: userId, fach_id: fachId || null, name: name.slice(0, 200), daten: daten as unknown as Json, ki_erzeugt: true })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/mindmap");
    return { ok: true, daten: { mindmapId: data.id } };
  } catch (err) {
    return alsFehler(err);
  }
}
