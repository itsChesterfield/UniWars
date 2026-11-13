"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { einstellungenLesen, type WsEinstellungen } from "@/lib/work-station/timer";
import { lernaktivitaetVermerken } from "@/lib/hubs/lernaktivitaet";

async function nutzer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, userId: user.id };
}

/** WS-03: Fokus-Runde als Lernsitzung speichern. Doppelte (mehrere Tabs) werden ignoriert. */
export async function sitzungSpeichern(eingabe: { startMs: number; minuten: number; fachId: string | null }) {
  const { supabase, userId } = await nutzer();
  const minuten = Math.round(eingabe.minuten);
  if (!Number.isFinite(minuten) || minuten < 1 || minuten > 600) throw new Error("Ungültige Dauer");
  const start = new Date(eingabe.startMs);
  const alter = Date.now() - start.getTime();
  if (Number.isNaN(start.getTime()) || alter < -60_000 || alter > 2 * 24 * 3600_000) throw new Error("Ungültiger Start");
  const startIso = start.toISOString();

  const { data: vorhanden } = await supabase
    .from("lern_session")
    .select("id")
    .eq("user_id", userId)
    .eq("start", startIso)
    .limit(1);
  if (vorhanden && vorhanden.length > 0) return;

  const { error } = await supabase
    .from("lern_session")
    .insert({ user_id: userId, start: startIso, dauer_minuten: minuten, fach_id: eingabe.fachId || null });
  if (error) throw new Error(error.message);

  await lernaktivitaetVermerken(supabase, userId);
  revalidatePath("/work-station");
  revalidatePath("/");
}

/** WS-04 */
export async function einstellungenSpeichern(eingabe: WsEinstellungen): Promise<WsEinstellungen> {
  const { supabase, userId } = await nutzer();
  const einstellungen = einstellungenLesen(eingabe);
  const { error } = await supabase.from("settings").update({ work_station: einstellungen }).eq("user_id", userId);
  if (error) throw new Error(error.message);
  return einstellungen;
}
