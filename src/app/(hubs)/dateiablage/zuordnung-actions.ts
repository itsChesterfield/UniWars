"use server";

import { revalidatePath } from "next/cache";
import { MATERIAL_ARTEN, type MaterialFachZuordnung } from "@/lib/dateiablage/material";
import { createClient } from "@/lib/supabase/server";

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
      typeof z.material_id !== "string" || !UUID.test(z.material_id) || typeof z.ausgeblendet !== "boolean") {
      throw new Error("Ungültige Fachzuordnung.");
    }
    return { user_id: user.id, art: z.art, material_id: z.material_id, fach_id: z.fach_id, ausgeblendet: z.ausgeblendet };
  });
  const { error } = await supabase.from("material_ablage_fach").upsert(werte, { onConflict: "user_id,art,material_id,fach_id" });
  if (error) throw new Error("Die Zuordnungen konnten nicht gespeichert werden.");
  revalidatePath("/dateiablage");
}
