import { Suspense } from "react";
import { hubFachzuordnungen } from "@/lib/dateiablage/material";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { Einrichtung } from "@/components/zustand";
import { TabellenListe } from "@/components/tabellen/tabellen-liste";

export const metadata = { title: "Tabellen · UniVerse" };

export default async function TabellenSeite() {
  const supabase = await createClient();
  const [{ data: tabellen, error }, { data: faecher }, { data: zuordnungen }] = await Promise.all([
    supabase.from("tabelle").select("id, titel, fach_id, geaendert_am").order("geaendert_am", { ascending: false }),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
    supabase.from("material_ablage_fach").select("art, material_id, fach_id, ausgeblendet").eq("art", "tabelle"),
  ]);

  if (tabelleFehlt(error)) {
    return <Einrichtung bereich="Tabellen" />;
  }
  if (error) throw new Error(error.message);

  return (
    <Suspense fallback={null}>
      <TabellenListe tabellen={hubFachzuordnungen(tabellen ?? [], zuordnungen ?? [])} faecher={faecher ?? []} />
    </Suspense>
  );
}
