"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * KI-D1 (Text) und KI-D2 (Audio): Einwilligungen geben und widerrufen.
 * Fehler kommen als Rückgabewert, damit die Meldung auch im Produktivbetrieb ankommt.
 */

export type EinwilligungsArt = "text" | "audio";
type Ergebnis = { ok: true } | { ok: false; fehler: string };

const SPALTE = { text: "ki_einwilligung", audio: "ki_audio_einwilligung" } as const;

async function setzen(art: EinwilligungsArt, wert: string | null): Promise<Ergebnis> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, fehler: "Bitte melde dich erneut an." };
    const aenderung = art === "text" ? { ki_einwilligung: wert } : { ki_audio_einwilligung: wert };
    const { error } = await supabase.from("settings").update(aenderung).eq("user_id", user.id);
    if (error) throw new Error(error.message);
    if (wert === null) revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    console.error("[ki] Einwilligung", SPALTE[art], err instanceof Error ? err.message : err);
    return { ok: false, fehler: "Das hat nicht geklappt. Bitte versuch es noch einmal." };
  }
}

export async function kiEinwilligen(art: EinwilligungsArt = "text"): Promise<Ergebnis> {
  return setzen(art === "audio" ? "audio" : "text", new Date().toISOString());
}

export async function kiEinwilligungWiderrufen(art: EinwilligungsArt = "text"): Promise<Ergebnis> {
  return setzen(art === "audio" ? "audio" : "text", null);
}
