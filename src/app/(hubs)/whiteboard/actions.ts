"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { elementeLesen, type Element } from "@/lib/whiteboard/elemente";
import type { Json } from "@/lib/supabase/types";

async function nutzer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, userId: user.id };
}

/** WB-01 */
export async function whiteboardAnlegen(fachId: string | null, name?: string): Promise<string> {
  const { supabase, userId } = await nutzer();
  const { data, error } = await supabase
    .from("whiteboard")
    .insert({ user_id: userId, fach_id: fachId || null, name: (name ?? "").trim().slice(0, 200) || "Neues Whiteboard" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/whiteboard");
  return data.id;
}

/** WB-06: Autospeichern. */
export async function whiteboardSpeichern(id: string, elemente: Element[]): Promise<string> {
  const { supabase } = await nutzer();
  const daten = { elemente: elementeLesen({ elemente }) } as unknown as Json;
  const { data, error } = await supabase.from("whiteboard").update({ daten }).eq("id", id).select("geaendert_am").single();
  if (error) throw new Error(error.message);
  return data.geaendert_am;
}

export async function whiteboardUmbenennen(id: string, name: string) {
  const { supabase } = await nutzer();
  const n = name.trim().slice(0, 200);
  if (!n) throw new Error("Name darf nicht leer sein.");
  const { error } = await supabase.from("whiteboard").update({ name: n }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/whiteboard");
}

export async function whiteboardFachSetzen(id: string, fachId: string | null) {
  const { supabase } = await nutzer();
  const { error } = await supabase.from("whiteboard").update({ fach_id: fachId || null }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/whiteboard");
}

export async function whiteboardLoeschen(id: string) {
  const { supabase } = await nutzer();
  const { error } = await supabase.from("whiteboard").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/whiteboard");
}
