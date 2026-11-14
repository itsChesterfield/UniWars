"use server";

import { audioVerfuegbar } from "@/lib/ki/audio";
import { kiLimits } from "@/lib/ki/limits";
import { alsFehler, audioMonatGenutzt, kiKontingente, kiNutzer, ttsMonatGenutzt, type KiErgebnis, type KiKontingente } from "@/lib/ki/server";

export type SprachStatus = {
  diktat: boolean;
  vorlesen: boolean;
  eingewilligt: boolean;
  audioEingewilligt: boolean;
  audioRestSekunden: number;
  ttsRestZeichen: number;
};

/** KI-13/14: Was ist eingerichtet, welche Einwilligungen gibt es, wie viel ist noch frei? */
export async function sprachStatus(): Promise<KiErgebnis<SprachStatus>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const l = kiLimits();
    const [{ data }, audio, tts] = await Promise.all([
      supabase.from("settings").select("ki_einwilligung, ki_audio_einwilligung").eq("user_id", userId).maybeSingle(),
      audioMonatGenutzt(supabase),
      ttsMonatGenutzt(supabase),
    ]);
    const v = audioVerfuegbar();
    return {
      ok: true,
      daten: {
        diktat: v.diktat,
        vorlesen: v.vorlesen,
        eingewilligt: Boolean(data?.ki_einwilligung),
        audioEingewilligt: Boolean(data?.ki_audio_einwilligung),
        audioRestSekunden: Math.max(0, l.audio.limit - audio),
        ttsRestZeichen: Math.max(0, l.tts.limit - tts),
      },
    };
  } catch (err) {
    return alsFehler(err);
  }
}

/** Einstellungen: alle KI-Kontingente (KI-ALL-03). */
export async function kontingenteLaden(): Promise<KiErgebnis<KiKontingente>> {
  try {
    const { supabase } = await kiNutzer();
    return { ok: true, daten: await kiKontingente(supabase) };
  } catch (err) {
    return alsFehler(err);
  }
}
