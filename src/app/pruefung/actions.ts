"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { berlinDatum } from "@/lib/zeit";
import { kalenderAbgleichAnstossen } from "@/lib/kalender/anstossen";
import type { Enums, TablesInsert } from "@/lib/supabase/types";

export type PruefungInput = {
  titel: string;
  fach_id: string;
  datum: string;
  raum: string | null;
  status: Enums<"pruefung_status">;
  dauer_minuten?: number | null;
};

export async function createPruefung(input: PruefungInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const payload: TablesInsert<"pruefung"> = {
    user_id: user.id,
    fach_id: input.fach_id,
    titel: input.titel,
    datum: input.datum,
    raum: input.raum,
    status: input.status,
    dauer_minuten: input.dauer_minuten ?? null,
  };

  const { data, error } = await supabase.from("pruefung").insert(payload).select().single();
  if (error) throw new Error(error.message);

  // Offene Note dazu: erscheint unter Noten als „ausstehend“, bis das Ergebnis da ist
  await supabase.from("note").insert({
    user_id: user.id,
    fach_id: data.fach_id,
    titel: data.titel,
    datum: berlinDatum(new Date(data.datum)),
    gewicht: 1,
    wert: null,
    pruefung_id: data.id,
  });

  revalidatePath("/");
  await kalenderAbgleichAnstossen(supabase);
  return data;
}

export async function updatePruefung(id: string, input: PruefungInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pruefung")
    .update({
      fach_id: input.fach_id,
      titel: input.titel,
      datum: input.datum,
      raum: input.raum,
      status: input.status,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  // Offene Note mitziehen (Titel, Fach, Datum); eingetragene Noten bleiben unberührt
  await supabase
    .from("note")
    .update({ titel: data.titel, fach_id: data.fach_id, datum: berlinDatum(new Date(data.datum)) })
    .eq("pruefung_id", id)
    .is("wert", null);
  revalidatePath("/");
  await kalenderAbgleichAnstossen(supabase);
  return data;
}

export async function deletePruefung(id: string) {
  const supabase = await createClient();
  // Noch leere Note gehört nur zur Prüfung – mit löschen; eine eingetragene Note bleibt erhalten
  await supabase.from("note").delete().eq("pruefung_id", id).is("wert", null);
  const { error } = await supabase.from("pruefung").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  await kalenderAbgleichAnstossen(supabase);
}
