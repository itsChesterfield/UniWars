"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { einstellungenLesen, type AufgabeTyp, type WsEinstellungen } from "@/lib/work-station/timer";
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
const AUFGABE_TYPEN: AufgabeTyp[] = ["deadline", "todo", "pruefung"];
const istUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

export async function sitzungSpeichern(eingabe: {
  startMs: number;
  minuten: number;
  fachId: string | null;
  /** Woran gearbeitet wurde (optional) */
  aufgabe?: { typ: AufgabeTyp; id: string } | null;
}) {
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
    .insert({
      user_id: userId,
      start: startIso,
      dauer_minuten: minuten,
      fach_id: eingabe.fachId || null,
      ...(eingabe.aufgabe && AUFGABE_TYPEN.includes(eingabe.aufgabe.typ) && istUuid(eingabe.aufgabe.id)
        ? { aufgabe_typ: eingabe.aufgabe.typ, aufgabe_id: eingabe.aufgabe.id }
        : {}),
    });
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

/** Nach der Fokus-Runde: „Aufgabe abgeschlossen? Ja“ – Abgabe oder To-do abhaken */
export async function fokusAufgabeErledigt(aufgabe: { typ: AufgabeTyp; id: string }) {
  const { supabase } = await nutzer();
  if (!istUuid(aufgabe.id) || (aufgabe.typ !== "deadline" && aufgabe.typ !== "todo")) throw new Error("Ungültige Aufgabe");
  const { error } = await supabase.from(aufgabe.typ).update({ erledigt: true }).eq("id", aufgabe.id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/aufgaben");
  revalidatePath("/work-station");
}

export type Arbeitszeit = { userId: string; name: string; minuten: number };

/** Wer hat wie lange an einer Aufgabe gearbeitet (inkl. Unteraufgaben)? Nur für Personen, die die Aufgabe sehen dürfen. */
export async function arbeitszeitLaden(aufgabe: { typ: AufgabeTyp; id: string }): Promise<Arbeitszeit[]> {
  const { supabase } = await nutzer();
  if (!istUuid(aufgabe.id) || !AUFGABE_TYPEN.includes(aufgabe.typ)) return [];
  const { data } = await supabase.rpc("aufgabe_arbeitszeit", { p_typ: aufgabe.typ, p_id: aufgabe.id });
  return (data ?? []).map((z) => ({ userId: z.user_id, name: z.username ?? "Unbekannt", minuten: z.minuten }));
}
