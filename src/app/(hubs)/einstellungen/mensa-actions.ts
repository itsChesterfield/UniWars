"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mensenListe } from "@/lib/mensa-server";
import type { Mensa } from "@/lib/mensa";
import type { Ergebnis } from "@/app/settings/actions";

export async function mensenLaden(): Promise<Mensa[]> {
  return mensenListe();
}

/** Mensa wählen (oder mit null entfernen). Beim Wählen erscheint „Mensa heute“ in der Übersicht. */
export async function mensaSetzen(mensa: { id: number; name: string } | null): Promise<Ergebnis> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  if (mensa && (!Number.isInteger(mensa.id) || mensa.id <= 0)) return { ok: false, fehler: "Ungültige Mensa." };

  const { error } = await supabase
    .from("settings")
    .update({
      mensa_id: mensa?.id ?? null,
      mensa_name: mensa ? mensa.name.slice(0, 160) : null,
    })
    .eq("user_id", user.id);
  if (error) return { ok: false, fehler: "Speichern hat nicht geklappt." };
  revalidatePath("/");
  revalidatePath("/einstellungen");
  return { ok: true, hinweis: mensa ? "Mensa gespeichert – sie erscheint jetzt in deiner Übersicht." : "Mensa entfernt." };
}
