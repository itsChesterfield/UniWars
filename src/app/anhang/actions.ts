"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AnhangZielTyp = "todo" | "deadline" | "pruefung";

function titelAusUrl(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

export async function createAnhang(zielTyp: AnhangZielTyp, zielId: string, url: string) {
  let geparst: URL;
  try {
    geparst = new URL(url);
  } catch {
    throw new Error("Ungültige URL.");
  }
  if (geparst.protocol !== "http:" && geparst.protocol !== "https:") {
    throw new Error("Nur http(s)-Links sind erlaubt.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const { data, error } = await supabase
    .from("anhang")
    .insert({
      user_id: user.id,
      ziel_typ: zielTyp,
      ziel_id: zielId,
      url: geparst.toString(),
      titel: titelAusUrl(geparst.toString()),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/");
  return data;
}

export async function deleteAnhang(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("anhang").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function anhaengeLaden(zielTyp: AnhangZielTyp, zielId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("anhang")
    .select("*")
    .eq("ziel_typ", zielTyp)
    .eq("ziel_id", zielId)
    .order("erstellt_am", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** DAT-08: Datei aus der Dateiablage anhängen. */
export async function dateiAnhaengen(zielTyp: AnhangZielTyp, zielId: string, dateiId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const { data: datei, error: dateiFehler } = await supabase.from("datei").select("id, name").eq("id", dateiId).single();
  if (dateiFehler) throw new Error("Datei nicht gefunden.");

  const { data, error } = await supabase
    .from("anhang")
    .insert({
      user_id: user.id,
      ziel_typ: zielTyp,
      ziel_id: zielId,
      url: `/dateiablage/oeffnen/${datei.id}`,
      titel: datei.name,
      datei_id: datei.id,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  return data;
}

/** Auswahlliste für "Datei anhängen" – leer, solange die Dateiablage noch nicht eingerichtet ist. */
export async function dateienZumAnhaengen(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("datei").select("id, name").order("erstellt_am", { ascending: false }).limit(200);
  return data ?? [];
}
