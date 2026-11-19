import { Suspense } from "react";
import { hubFachzuordnungen } from "@/lib/dateiablage/material";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { Einrichtung } from "@/components/zustand";
import { DokumentListe } from "@/components/textverarbeitung/dokument-liste";

export const metadata = { title: "Textverarbeitung · UniVerse" };

export default async function TextverarbeitungSeite() {
  const supabase = await createClient();
  const [{ data: dokumente, error }, { data: faecher }, { data: zuordnungen }] = await Promise.all([
    supabase.from("dokument").select("id, titel, fach_id, woerter, geaendert_am").order("geaendert_am", { ascending: false }),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
    supabase.from("material_ablage_fach").select("art, material_id, fach_id, ausgeblendet").eq("art", "dokument"),
  ]);

  if (tabelleFehlt(error)) {
    return <Einrichtung bereich="Die Textverarbeitung" />;
  }
  if (error) throw new Error(error.message);

  return (
    <Suspense fallback={null}>
      <DokumentListe dokumente={hubFachzuordnungen(dokumente ?? [], zuordnungen ?? [])} faecher={faecher ?? []} />
    </Suspense>
  );
}
