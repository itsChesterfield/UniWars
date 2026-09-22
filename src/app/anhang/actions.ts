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
