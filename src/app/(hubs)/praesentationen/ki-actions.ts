"use server";

import { revalidatePath } from "next/cache";
import { KiEingabe } from "@/lib/ki/fehler";
import { folieBereinigen, folienParsen, folienPromptBauen, istFolienzahl, mitTitelfolie, type EntwurfFolie, type FolienEntwurf } from "@/lib/ki/folien";
import { alsFehler, kiNutzer, pflichttext, textAnfrageAusfuehren, textVoraussetzungen, type KiErgebnis } from "@/lib/ki/server";
import { MAX_FOLIEN, neueFolie, type Folie } from "@/lib/praesentationen/folien";
import type { Json } from "@/lib/supabase/types";

/** KI-08: Folien-Gliederung aus Notiz oder Dokument. Gespeichert wird erst nach Bestätigung. */

export type FolienQuelle = { art: "notiz" | "dokument"; id: string };
export type QuellenAuswahl = { art: "notiz" | "dokument"; id: string; titel: string; zeichen: number; fachId: string | null };

/** Notizen und Dokumente für die Auswahl (nur Metadaten, keine Inhalte). */
export async function kiFolienQuellen(): Promise<KiErgebnis<QuellenAuswahl[]>> {
  try {
    const { supabase } = await kiNutzer();
    const [{ data: notizen }, { data: dokumente }] = await Promise.all([
      supabase.from("notiz").select("id, titel, inhalt, fach_id").order("geaendert_am", { ascending: false }).limit(100),
      supabase.from("dokument").select("id, titel, woerter, klartext, fach_id").order("geaendert_am", { ascending: false }).limit(100),
    ]);
    return {
      ok: true,
      daten: [
        ...(notizen ?? []).map((n) => ({ art: "notiz" as const, id: n.id, titel: n.titel || "Unbenannte Notiz", zeichen: n.inhalt.trim().length, fachId: n.fach_id })),
        ...(dokumente ?? []).map((d) => ({ art: "dokument" as const, id: d.id, titel: d.titel || "Unbenanntes Dokument", zeichen: d.klartext.trim().length, fachId: d.fach_id })),
      ],
    };
  } catch (err) {
    return alsFehler(err);
  }
}

async function materialLaden(supabase: Awaited<ReturnType<typeof kiNutzer>>["supabase"], quelle: FolienQuelle) {
  if (quelle.art === "notiz") {
    const { data } = await supabase.from("notiz").select("titel, inhalt, fach_id").eq("id", quelle.id).maybeSingle();
    if (!data) throw new KiEingabe("Notiz nicht gefunden.");
    return { titel: data.titel, text: data.inhalt, fachId: data.fach_id };
  }
  const { data } = await supabase.from("dokument").select("titel, klartext, fach_id").eq("id", quelle.id).maybeSingle();
  if (!data) throw new KiEingabe("Dokument nicht gefunden.");
  return { titel: data.titel, text: data.klartext, fachId: data.fach_id };
}

export async function folienVorschlagen(
  quelle: FolienQuelle,
  anzahl: number,
): Promise<KiErgebnis<FolienEntwurf & { gekuerzt: boolean; fachId: string | null; verbleibendHeute: number }>> {
  try {
    if (!istFolienzahl(anzahl)) throw new KiEingabe("Bitte wähle 5, 8 oder 12 Folien.");
    const { supabase, userId } = await kiNutzer();
    await textVoraussetzungen(supabase, userId);
    const material = await materialLaden(supabase, quelle);
    const prompt = folienPromptBauen(material, anzahl);
    const { ergebnis, verbleibend } = await textAnfrageAusfuehren({
      supabase,
      funktion: "folien",
      zweck: "lang",
      optionen: { system: prompt.system, nutzer: prompt.nutzer, json: true, temperatur: 0.4, maxTokens: 2500 },
      parsen: (a) => folienParsen(a.text, anzahl, material.titel),
    });
    return { ok: true, daten: { ...ergebnis, gekuerzt: prompt.gekuerzt, fachId: material.fachId, verbleibendHeute: verbleibend } };
  } catch (err) {
    return alsFehler(err);
  }
}

function alsFolie(f: EntwurfFolie): Folie {
  const folie = neueFolie(f.layout, f.titel);
  if (f.layout === "TITEL") folie.text = f.untertitel;
  if (f.layout === "TEXT" || f.layout === "ZWEISPALTIG") folie.text = f.punkte.join("\n");
  if (f.layout === "ZWEISPALTIG") folie.text2 = f.punkteRechts.join("\n");
  return folie; // BILD: Bildfeld bleibt leer ("Bild einfügen")
}

/** Bestätigten Entwurf als neue Präsentation speichern. */
export async function praesentationAusEntwurf(entwurf: FolienEntwurf, fachId: string | null): Promise<KiErgebnis<{ id: string }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const titel = pflichttext(entwurf?.titel, "Titel", 150);
    // Erneut prüfen – der Client kann den Entwurf verändert haben
    const roh = Array.isArray(entwurf?.folien) ? entwurf.folien : [];
    const folien = mitTitelfolie(
      titel,
      roh.map((f) => folieBereinigen({ ...f, punkte_rechts: f?.punkteRechts })).filter((f): f is EntwurfFolie => f !== null),
    ).slice(0, Math.min(MAX_FOLIEN, 30));
    if (folien.length < 1) throw new KiEingabe("Die Präsentation braucht mindestens eine Folie.");
    const { data, error } = await supabase
      .from("praesentation")
      .insert({ user_id: userId, titel, fach_id: fachId || null, folien: folien.map(alsFolie) as unknown as Json, ki_erzeugt: true })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/praesentationen");
    return { ok: true, daten: { id: data.id } };
  } catch (err) {
    return alsFehler(err);
  }
}
