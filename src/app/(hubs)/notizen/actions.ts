"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { berlinDatum, datumDeutsch } from "@/lib/zeit";
import type { Tables } from "@/lib/supabase/types";

export type Notiz = Tables<"notiz">;

async function nutzer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, userId: user.id };
}

/** NOT-01 */
export async function notizAnlegen(fachId: string | null): Promise<Notiz> {
  const { supabase, userId } = await nutzer();
  const { data, error } = await supabase
    .from("notiz")
    .insert({ user_id: userId, fach_id: fachId || null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/notizen");
  return data;
}

/** NOT-08: Mitschrift zur laufenden Vorlesung – pro Vorlesung und Tag nur eine. */
export async function mitschriftAnlegen(stundenplanEintragId: string): Promise<Notiz> {
  const { supabase, userId } = await nutzer();
  const heute = berlinDatum();

  const { data: vorhanden } = await supabase
    .from("notiz")
    .select("*")
    .eq("stundenplan_eintrag_id", stundenplanEintragId)
    .eq("vorlesung_datum", heute)
    .limit(1)
    .maybeSingle();
  if (vorhanden) return vorhanden;

  const { data: eintrag, error: eintragFehler } = await supabase
    .from("stundenplan_eintrag")
    .select("id, fach_id, fach(name)")
    .eq("id", stundenplanEintragId)
    .single();
  if (eintragFehler) throw new Error(eintragFehler.message);
  const fachName = (eintrag.fach as { name: string } | null)?.name ?? "Vorlesung";

  const { data, error } = await supabase
    .from("notiz")
    .insert({
      user_id: userId,
      fach_id: eintrag.fach_id,
      titel: `Mitschrift ${fachName} – ${datumDeutsch(new Date().toISOString())}`,
      stundenplan_eintrag_id: eintrag.id,
      vorlesung_datum: heute,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/notizen");
  return data;
}

/** NOT-02 / ALL-08: Autospeichern von Titel und Text. */
export async function notizSpeichern(id: string, aenderung: { titel?: string; inhalt?: string }): Promise<string> {
  const { supabase } = await nutzer();
  const update: { titel?: string; inhalt?: string } = {};
  if (typeof aenderung.titel === "string") update.titel = aenderung.titel.slice(0, 300);
  if (typeof aenderung.inhalt === "string") update.inhalt = aenderung.inhalt;
  const { data, error } = await supabase.from("notiz").update(update).eq("id", id).select("geaendert_am").single();
  if (error) throw new Error(error.message);
  return data.geaendert_am;
}

/** NOT-05 */
export async function notizAnpinnen(id: string, angepinnt: boolean) {
  const { supabase } = await nutzer();
  const { error } = await supabase.from("notiz").update({ angepinnt }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** NOT-06 */
export async function notizFachSetzen(id: string, fachId: string | null) {
  const { supabase } = await nutzer();
  const { error } = await supabase.from("notiz").update({ fach_id: fachId || null }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** NOT-07 */
export async function notizLoeschen(id: string) {
  const { supabase } = await nutzer();
  const { error } = await supabase.from("notiz").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/notizen");
}
