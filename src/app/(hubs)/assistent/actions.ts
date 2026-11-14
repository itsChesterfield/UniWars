"use server";

import { revalidatePath } from "next/cache";
import { karteAusfuehren, karteMitAenderung, type KartenAenderung } from "@/lib/ki/aktionskarten-server";
import { werkzeugDatenLesen, type Aktionskarte, type KartenStatus } from "@/lib/ki/assistent";
import { KiEingabe } from "@/lib/ki/fehler";
import { alsFehler, chatStatus, kiNutzer, type KiErgebnis, type Supabase, type TextStatus } from "@/lib/ki/server";
import type { Json } from "@/lib/supabase/types";

/**
 * KI-12: Unterhaltungen des Assistenten (laden, löschen) und Aktionskarten (übernehmen, verwerfen).
 * Übernehmen ruft die BESTEHENDEN Server Actions auf; der Status steht danach an der Nachricht.
 */

export type UnterhaltungEintrag = { id: string; titel: string; geaendert_am: string };
export type AssistentNachricht = { id: string; rolle: "nutzer" | "assistent"; inhalt: string; karten: Aktionskarte[]; erstellt_am: string };

/** Status (Key, Einwilligung, Tageskontingent) und Fächer für die Bearbeiten-Formulare der Karten. */
export async function assistentStart(): Promise<KiErgebnis<{ status: TextStatus; faecher: { id: string; name: string }[] }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const [status, { data: faecher }] = await Promise.all([chatStatus(supabase, userId), supabase.from("fach").select("id, name").eq("aktiv", true).order("name")]);
    return { ok: true, daten: { status, faecher: faecher ?? [] } };
  } catch (err) {
    return alsFehler(err);
  }
}

export async function unterhaltungenLaden(): Promise<KiErgebnis<UnterhaltungEintrag[]>> {
  try {
    const { supabase } = await kiNutzer();
    const { data, error } = await supabase.from("ki_unterhaltung").select("id, titel, geaendert_am").order("geaendert_am", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return { ok: true, daten: data ?? [] };
  } catch (err) {
    return alsFehler(err);
  }
}

export async function unterhaltungLaden(id: string): Promise<KiErgebnis<{ titel: string; nachrichten: AssistentNachricht[] }>> {
  try {
    const { supabase } = await kiNutzer();
    const [{ data: u }, { data: n, error }] = await Promise.all([
      supabase.from("ki_unterhaltung").select("titel").eq("id", id).maybeSingle(),
      supabase.from("ki_nachricht").select("id, rolle, inhalt, werkzeug_daten, erstellt_am").eq("unterhaltung_id", id).neq("rolle", "werkzeug").order("erstellt_am").limit(400),
    ]);
    if (error) throw new Error(error.message);
    if (!u) throw new KiEingabe("Unterhaltung nicht gefunden.");
    return {
      ok: true,
      daten: {
        titel: u.titel,
        nachrichten: (n ?? []).map((x) => ({
          id: x.id,
          rolle: x.rolle === "nutzer" ? "nutzer" : "assistent",
          inhalt: x.inhalt,
          karten: werkzeugDatenLesen(x.werkzeug_daten).karten,
          erstellt_am: x.erstellt_am,
        })),
      },
    };
  } catch (err) {
    return alsFehler(err);
  }
}

export async function unterhaltungLoeschen(id: string): Promise<KiErgebnis<null>> {
  try {
    const { supabase } = await kiNutzer();
    const { error } = await supabase.from("ki_unterhaltung").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/assistent");
    return { ok: true, daten: null };
  } catch (err) {
    return alsFehler(err);
  }
}

/** Einstellungen: „Alle KI-Unterhaltungen löschen“ (Nachrichten fallen per Cascade mit weg). */
export async function alleUnterhaltungenLoeschen(): Promise<KiErgebnis<{ anzahl: number }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const { data, error } = await supabase.from("ki_unterhaltung").delete().eq("user_id", userId).select("id");
    if (error) throw new Error(error.message);
    revalidatePath("/assistent");
    return { ok: true, daten: { anzahl: data?.length ?? 0 } };
  } catch (err) {
    return alsFehler(err);
  }
}

async function karteLaden(supabase: Supabase, nachrichtId: string, karteId: string) {
  const { data } = await supabase.from("ki_nachricht").select("id, werkzeug_daten").eq("id", nachrichtId).maybeSingle();
  if (!data) throw new KiEingabe("Nachricht nicht gefunden.");
  const daten = werkzeugDatenLesen(data.werkzeug_daten);
  const karte = daten.karten.find((k) => k.id === karteId);
  if (!karte) throw new KiEingabe("Vorschlag nicht gefunden.");
  return { daten, karte };
}

async function statusSetzen(
  supabase: Supabase,
  nachrichtId: string,
  daten: ReturnType<typeof werkzeugDatenLesen>,
  karte: Aktionskarte,
  status: KartenStatus,
  ergebnisId: string | null,
) {
  const karten = daten.karten.map((k) => (k.id === karte.id ? { ...karte, status, ergebnisId } : k));
  const { error } = await supabase
    .from("ki_nachricht")
    .update({ werkzeug_daten: { ...daten, karten } as unknown as Json })
    .eq("id", nachrichtId);
  if (error) throw new Error(error.message);
}

export type { KartenAenderung } from "@/lib/ki/aktionskarten-server";

/**
 * Aktionskarte übernehmen (KI-ALL-01: erst jetzt wird gespeichert). Bearbeitete Werte werden
 * mit denselben Regeln geprüft wie der Vorschlag. Liefert, wohin die Oberfläche verlinkt.
 */
export async function karteUebernehmen(
  nachrichtId: string,
  karteId: string,
  aenderung: KartenAenderung | null = null,
): Promise<KiErgebnis<{ karte: Aktionskarte; link: string | null }>> {
  try {
    const { supabase } = await kiNutzer();
    const { daten, karte } = await karteLaden(supabase, nachrichtId, karteId);
    const k = await karteMitAenderung(supabase, karte, aenderung);
    const { ergebnisId, link } = await karteAusfuehren(supabase, k);
    await statusSetzen(supabase, nachrichtId, daten, k, "uebernommen", ergebnisId);
    return { ok: true, daten: { karte: { ...k, status: "uebernommen", ergebnisId }, link } };
  } catch (err) {
    return alsFehler(err);
  }
}

export async function karteVerwerfen(nachrichtId: string, karteId: string): Promise<KiErgebnis<null>> {
  try {
    const { supabase } = await kiNutzer();
    const { daten, karte } = await karteLaden(supabase, nachrichtId, karteId);
    if (karte.status !== "offen") return { ok: true, daten: null };
    await statusSetzen(supabase, nachrichtId, daten, karte, "verworfen", null);
    return { ok: true, daten: null };
  } catch (err) {
    return alsFehler(err);
  }
}
