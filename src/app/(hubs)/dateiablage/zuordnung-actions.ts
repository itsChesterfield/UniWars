"use server";

import { revalidatePath } from "next/cache";
import { fachZuordnungen, materialRef, MATERIAL_ARTEN, type MaterialArt, type MaterialFachZuordnung, type MaterialRef } from "@/lib/dateiablage/material";
import { createClient } from "@/lib/supabase/server";
import { materialQuelle } from "@/lib/dateiablage/material-server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fachZuordnungenSpeichern(zuordnungen: MaterialFachZuordnung[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Bitte melde dich an.");
  if (!Array.isArray(zuordnungen) || zuordnungen.length < 1 || zuordnungen.length > 200) {
    throw new Error("Wähle bis zu 200 Unterlagen aus.");
  }
  const werte = zuordnungen.map((z) => {
    if (!z || !(z.art === "datei" || Object.hasOwn(MATERIAL_ARTEN, z.art)) ||
      typeof z.fach_id !== "string" || !UUID.test(z.fach_id) ||
      typeof z.material_id !== "string" || !UUID.test(z.material_id) || typeof z.ausgeblendet !== "boolean" ||
      (z.thema_id != null && (typeof z.thema_id !== "string" || !UUID.test(z.thema_id)))) {
      throw new Error("Ungültige Fachzuordnung.");
    }
    return { user_id: user.id, art: z.art, material_id: z.material_id, fach_id: z.fach_id, ausgeblendet: z.ausgeblendet, ...(z.thema_id !== undefined ? { thema_id: z.thema_id } : {}) };
  });
  const { error } = await supabase.from("material_ablage_fach").upsert(werte, { onConflict: "user_id,art,material_id,fach_id" });
  if (error) throw new Error("Die Zuordnungen konnten nicht gespeichert werden.");
  revalidatePath("/dateiablage");
  const hubs = new Set(werte.filter((z) => z.art !== "datei").map((z) => MATERIAL_ARTEN[z.art as MaterialArt].pfad.split(/[/?]/)[1]));
  for (const hub of hubs) revalidatePath(`/${hub}`);
}

export async function materialFaecherLaden(eingabe: MaterialRef) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Bitte melde dich an.");
  const ref = materialRef(eingabe);
  if (!ref) throw new Error("Ungültige Unterlage.");
  const [quelle, extras, profile] = await Promise.all([
    materialQuelle(supabase, ref, 0),
    supabase.from("material_ablage_fach").select("art, material_id, fach_id, ausgeblendet")
      .eq("art", ref.art).eq("material_id", ref.id).eq("user_id", user.id),
    supabase.from("fach").select("id, name, aktiv").eq("user_id", user.id).order("name"),
  ]);
  if (!quelle || extras.error || profile.error) throw new Error("Die Fachzuordnungen konnten nicht geladen werden.");
  const aktuell = fachZuordnungen(quelle.fachId, extras.data ?? []);
  return {
    aktuell,
    faecher: (profile.data ?? []).filter((f) => f.aktiv || aktuell.includes(f.id)),
  };
}
