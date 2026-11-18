import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { istFaellig } from "@/lib/karteikarten/wiederholung";
import { Einrichtung } from "@/components/zustand";
import { Lernmodus } from "@/components/karteikarten/lernmodus";
import { kiKonfiguriert } from "@/lib/ki/anbieter";

export default async function LernSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: stapel, error }, { data: karten }] = await Promise.all([
    supabase.from("kk_stapel").select("id, name").eq("id", id).maybeSingle(),
    supabase.from("kk_karte").select("id, vorderseite, rueckseite, naechste_abfrage, intervall_tage, leichtigkeit, wiederholungen, fehler, zuletzt_gelernt").eq("stapel_id", id),
  ]);

  if (tabelleFehlt(error)) {
    return <Einrichtung bereich="Karteikarten" />;
  }
  if (error?.code === "22P02") notFound();
  if (error) throw new Error(error.message);
  if (!stapel) notFound();

  const alle = karten ?? [];
  const faellige = alle.filter((k) => istFaellig(k.naechste_abfrage));
  return <Lernmodus key={stapel.id} stapel={stapel} karten={alle} faellige={faellige} kiVerfuegbar={kiKonfiguriert()} />;
}
