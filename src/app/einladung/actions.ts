"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function benutzerSuchen(suchtext: string) {
  if (suchtext.trim().length < 2) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("benutzer_suchen", { suchtext: suchtext.trim() });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function deadlineEinladen(deadlineId: string, username: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const { data: anUserId, error: lookupError } = await supabase.rpc("user_id_von_username", {
    p_username: username.trim(),
  });
  if (lookupError) throw new Error(lookupError.message);
  if (!anUserId) throw new Error("Diesen Nutzernamen gibt es nicht.");
  if (anUserId === user.id) throw new Error("Du kannst dich nicht selbst einladen.");

  const { error } = await supabase.from("einladung").insert({
    ziel_typ: "deadline",
    ziel_id: deadlineId,
    von_user_id: user.id,
    an_user_id: anUserId,
    ziel_titel: "",
  });

  if (error) {
    if (error.code === "23505") throw new Error("Diese Person ist bereits eingeladen.");
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function einladungAnnehmen(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("einladung").update({ status: "ANGENOMMEN" }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function einladungAblehnen(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("einladung").update({ status: "ABGELEHNT" }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function einladungZurueckziehen(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("einladung").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function deadlineMitgliederLaden(deadlineId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("deadline_mitglieder", { p_deadline_id: deadlineId });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function todoMitgliederLaden(todoId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("todo_mitglieder", { p_todo_id: todoId });
  if (error) throw new Error(error.message);
  return data ?? [];
}
