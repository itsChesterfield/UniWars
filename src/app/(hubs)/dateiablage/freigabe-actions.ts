"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { istMaterialId, materialRef, materialRefs, type MaterialRef } from "@/lib/dateiablage/material";
import { materialQuelle } from "@/lib/dateiablage/material-server";

async function nutzer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Bitte melde dich an.");
  return { supabase, userId: user.id };
}

export async function materialGruppen() {
  const { supabase } = await nutzer();
  const { data, error } = await supabase.rpc("chat_uebersicht");
  if (error) throw new Error("Lerngruppen konnten nicht geladen werden.");
  return (data ?? []).filter((g) => g.typ === "GRUPPE").map((g) => ({ id: g.chat_id, name: g.name ?? "Lerngruppe" }));
}

export async function materialGruppenmitglieder(chatId: string) {
  const { supabase, userId } = await nutzer();
  if (!istMaterialId(chatId)) throw new Error("Ungültige Lerngruppe.");
  const { data, error } = await supabase.rpc("chat_mitglieder", { p_chat_id: chatId });
  if (error) throw new Error("Mitglieder konnten nicht geladen werden.");
  return (data ?? []).filter((m) => m.user_id !== userId);
}

export async function materialFreigaben(eingabe: MaterialRef) {
  const { supabase, userId } = await nutzer();
  const ref = materialRef(eingabe);
  if (!ref) return [];
  const { data, error } = await supabase.from("material_freigabe").select("empfaenger_id, chat_id, bearbeiten")
    .eq("user_id", userId).eq("art", ref.art).eq("material_id", ref.id);
  if (error) throw new Error("Freigaben konnten nicht geladen werden.");
  return data ?? [];
}

export async function materialFreigabeSetzen(eingabe: MaterialRef, chatId: string, empfaengerId: string, recht: "lesen" | "bearbeiten" | null) {
  const { supabase, userId } = await nutzer();
  const ref = materialRef(eingabe);
  if (!ref || !istMaterialId(chatId) || !istMaterialId(empfaengerId) || ![null, "lesen", "bearbeiten"].includes(recht)) throw new Error("Ungültige Freigabe.");
  const { error } = recht
    ? await supabase.from("material_freigabe").upsert({
      user_id: userId, chat_id: chatId, art: ref.art, material_id: ref.id, empfaenger_id: empfaengerId, bearbeiten: recht === "bearbeiten",
    }, { onConflict: "empfaenger_id,art,material_id,chat_id" })
    : await supabase.from("material_freigabe").delete().eq("user_id", userId).eq("chat_id", chatId)
      .eq("art", ref.art).eq("material_id", ref.id).eq("empfaenger_id", empfaengerId);
  if (error) throw new Error("Die Freigabe konnte nicht geändert werden.");
  revalidatePath("/", "layout");
}

export async function materialPaketErstellen(chatId: string, titel: string, eingabe: MaterialRef[]) {
  const { supabase } = await nutzer();
  const refs = materialRefs(eingabe, 100);
  const name = typeof titel === "string" ? titel.trim() : "";
  if (!refs.length || !istMaterialId(chatId) || !name || name.length > 120) throw new Error("Gib dem Paket einen Namen und wähle eine Lerngruppe.");
  const { data, error } = await supabase.rpc("material_paket_erstellen", { p_chat_id: chatId, p_titel: name, p_material: refs });
  if (error || !data) throw new Error("Das Paket konnte nicht geteilt werden.");
  revalidatePath("/dateiablage");
  revalidatePath("/chat");
  return data;
}

export async function materialPaketeLaden(chatId?: string) {
  const { supabase, userId } = await nutzer();
  if (chatId !== undefined && !istMaterialId(chatId)) return [];
  let q = supabase.from("material_paket").select("id, user_id, chat_id, titel").order("titel");
  if (chatId) q = q.eq("chat_id", chatId);
  const { data, error } = await q;
  if (error) throw new Error("Materialpakete konnten nicht geladen werden.");
  return (data ?? []).map((p) => ({ id: p.id, chatId: p.chat_id, titel: p.titel, eigen: p.user_id === userId }));
}

export async function materialPaketLaden(paketId: string) {
  const { supabase, userId } = await nutzer();
  if (!istMaterialId(paketId)) throw new Error("Ungültiges Paket.");
  const [paket, elemente, pflege] = await Promise.all([
    supabase.from("material_paket").select("*").eq("id", paketId).maybeSingle(),
    supabase.from("material_paket_element").select("art, material_id").eq("paket_id", paketId),
    supabase.from("material_paket_pflege").select("pfleger_id").eq("paket_id", paketId),
  ]);
  if (!paket.data || paket.error || elemente.error || pflege.error) throw new Error("Das Paket ist nicht verfügbar.");
  const quellen = await Promise.all((elemente.data ?? []).map((e) => {
    const ref = materialRef({ art: e.art, id: e.material_id });
    return ref ? materialQuelle(supabase, ref, 0) : null;
  }));
  const eigen = paket.data.user_id === userId;
  return {
    titel: paket.data.titel, chatId: paket.data.chat_id, eigen,
    darfPflegen: eigen || (pflege.data ?? []).some((p) => p.pfleger_id === userId),
    pfleger: (pflege.data ?? []).map((p) => p.pfleger_id),
    material: quellen.flatMap((q) => q ? [{ art: q.art, id: q.id, titel: q.titel, href: q.href }] : []),
  };
}

export async function materialPaketElement(paketId: string, eingabe: MaterialRef[], hinzufuegen: boolean) {
  const { supabase, userId } = await nutzer();
  const refs = materialRefs(eingabe, 100);
  if (!refs.length || !istMaterialId(paketId) || typeof hinzufuegen !== "boolean") throw new Error("Ungültige Paketauswahl.");
  const { error } = hinzufuegen
    ? await supabase.from("material_paket_element").upsert(refs.map((ref) => ({
      paket_id: paketId, user_id: userId, art: ref.art, material_id: ref.id,
    })), { onConflict: "paket_id,art,material_id", ignoreDuplicates: true })
    : await supabase.from("material_paket_element").delete().eq("paket_id", paketId).eq("art", refs[0].art).eq("material_id", refs[0].id);
  if (error) throw new Error("Das Paket konnte nicht geändert werden.");
  revalidatePath("/dateiablage");
}

export async function materialPaketPflegeSetzen(paketId: string, person: string, erlauben: boolean) {
  const { supabase, userId } = await nutzer();
  if (!istMaterialId(paketId) || !istMaterialId(person) || typeof erlauben !== "boolean") throw new Error("Ungültige Berechtigung.");
  const { error } = erlauben
    ? await supabase.from("material_paket_pflege").insert({ paket_id: paketId, user_id: userId, pfleger_id: person })
    : await supabase.from("material_paket_pflege").delete().eq("paket_id", paketId).eq("pfleger_id", person);
  if (error) throw new Error("Die Paketpflege konnte nicht geändert werden.");
}

export async function materialPaketEntfernen(paketId: string) {
  const { supabase, userId } = await nutzer();
  if (!istMaterialId(paketId)) throw new Error("Ungültiges Paket.");
  const { data, error } = await supabase.from("material_paket").delete().eq("id", paketId).eq("user_id", userId).select("id").maybeSingle();
  if (error || !data) throw new Error("Das Paket konnte nicht aufgehoben werden.");
  revalidatePath("/", "layout");
}
