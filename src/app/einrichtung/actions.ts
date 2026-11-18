"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { naechsteFarbe } from "@/lib/fach-farben";
import { EINRICHTUNG_COOKIE, standSchreiben } from "@/lib/einrichtung";

async function cookieSetzen(wert: string, tage: number) {
  const c = await cookies();
  c.set(EINRICHTUNG_COOKIE, wert, { path: "/", sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: tage * 86_400 });
}

/** Aktuellen Schritt merken, damit die Einrichtung nach dem Umweg über Google weiterläuft */
export async function einrichtungSchrittMerken(schritt: number): Promise<void> {
  if (!Number.isInteger(schritt) || schritt < 0 || schritt > 9) return;
  await cookieSetzen(standSchreiben({ art: "laeuft", schritt }), 1);
}

/** Fertig oder „Ohne Einrichtung starten“: auf diesem Gerät nicht wieder zeigen */
export async function einrichtungBeenden(): Promise<void> {
  await cookieSetzen(standSchreiben({ art: "fertig" }), 365);
  revalidatePath("/");
}

export type FachKurz = { id: string; name: string; farbe: string | null };

/** Fach mit der nächsten freien Farbe anlegen (oder das gleichnamige zurückgeben) */
export async function einrichtungFachAnlegen(eingabe: string): Promise<{ ok: true; fach: FachKurz } | { ok: false; fehler: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  const name = eingabe.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!name) return { ok: false, fehler: "Gib einen Namen ein." };

  const { data: vorhandene, error: lesen } = await supabase.from("fach").select("id, name, farbe, aktiv");
  if (lesen) return { ok: false, fehler: "Speichern hat nicht geklappt." };
  const gleich = (vorhandene ?? []).find((f) => f.name.trim().toLowerCase() === name.toLowerCase());
  if (gleich) {
    if (!gleich.aktiv) await supabase.from("fach").update({ aktiv: true }).eq("id", gleich.id);
    return { ok: true, fach: { id: gleich.id, name: gleich.name, farbe: gleich.farbe } };
  }
  const { data, error } = await supabase
    .from("fach")
    .insert({ user_id: user.id, name, farbe: naechsteFarbe(vorhandene ?? []), anwesenheitspflicht: false })
    .select("id, name, farbe")
    .single();
  if (error) return { ok: false, fehler: "Speichern hat nicht geklappt." };
  revalidatePath("/");
  return { ok: true, fach: data };
}
