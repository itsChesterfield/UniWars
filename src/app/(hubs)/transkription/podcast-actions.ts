"use server";

import { materialPapierkorb } from "@/app/(hubs)/dateiablage/workflow-actions";

import { revalidatePath } from "next/cache";
import { alsFehler, kiNutzer, type KiErgebnis } from "@/lib/ki/server";
import { materialLaden, mitBuchung, podcastErzeugen, type QuellAuswahl } from "@/lib/ki/quiz-server";
import { persoenlichKontext } from "@/lib/ki/gedaechtnis-server";
import type { PodcastLaenge } from "@/lib/ki/quiz";
import type { Json } from "@/lib/supabase/types";

/** Lern-Podcast (zwei Stimmen) aus PDFs/Notizen oder einem ganzen Fach */
export async function podcastErstellen(eingabe: {
  quellen: QuellAuswahl[];
  fachId: string | null;
  laenge: PodcastLaenge;
  fokus?: string;
}): Promise<KiErgebnis<{ id: string }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const laenge: PodcastLaenge = eingabe.laenge === "kurz" || eingabe.laenge === "lang" ? eingabe.laenge : "normal";
    const fachId = typeof eingabe.fachId === "string" && eingabe.fachId ? eingabe.fachId : null;
    const quellen = (Array.isArray(eingabe.quellen) ? eingabe.quellen : []).filter((q) => (q?.art === "pdf" || q?.art === "notiz") && typeof q.id === "string").slice(0, 30);
    const ergebnis = await mitBuchung(supabase, userId, "podcast", "stark", async (anfrage) => {
      const material = await materialLaden(supabase, userId, quellen, fachId, 120_000);
      const persoenlich = await persoenlichKontext(supabase, String(eingabe.fokus ?? ""), fachId).catch(() => "");
      const p = await podcastErzeugen(anfrage, material, laenge, String(eingabe.fokus ?? "").slice(0, 300), persoenlich);
      return { ...p, info: material.info, fachName: material.fachName };
    });
    const { data, error } = await supabase
      .from("podcast")
      .insert({
        user_id: userId,
        titel: (ergebnis.titel || (ergebnis.fachName ? `Podcast ${ergebnis.fachName}` : "Lern-Podcast")).slice(0, 200),
        fach_id: fachId,
        quellen: ergebnis.info as unknown as Json,
        skript: ergebnis.segmente as unknown as Json,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/transkription");
    return { ok: true, daten: { id: data.id } };
  } catch (err) {
    return alsFehler(err);
  }
}

export async function podcastLoeschen(id: string): Promise<{ ok: boolean }> {
  try {
    await materialPapierkorb({ art: "podcast", id }, true);
    return { ok: true };
  } catch { return { ok: false }; }
}
