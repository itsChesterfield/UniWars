import { Suspense } from "react";
import { hubFachzuordnungen } from "@/lib/dateiablage/material";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { Einrichtung } from "@/components/zustand";
import { PraesentationsListe } from "@/components/praesentationen/praesentations-liste";
import { kiKonfiguriert } from "@/lib/ki/anbieter";

export const metadata = { title: "Präsentationen · UniVerse" };

export default async function PraesentationenSeite() {
  const supabase = await createClient();
  const [{ data: liste, error }, { data: faecher }, { data: zuordnungen }] = await Promise.all([
    supabase.from("praesentation").select("id, titel, fach_id, geaendert_am, folien").order("geaendert_am", { ascending: false }),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
    supabase.from("material_ablage_fach").select("art, material_id, fach_id, ausgeblendet").eq("art", "praesentation"),
  ]);

  if (tabelleFehlt(error)) {
    return <Einrichtung bereich="Präsentationen" />;
  }
  if (error) throw new Error(error.message);

  const eintraege = hubFachzuordnungen(liste ?? [], zuordnungen ?? []).map(({ folien, ...p }) => {
    const anzahl = Array.isArray(folien) ? folien.length : 0;
    return { ...p, info: `${anzahl} ${anzahl === 1 ? "Folie" : "Folien"}` };
  });

  return (
    <Suspense fallback={null}>
      <PraesentationsListe eintraege={eintraege} faecher={faecher ?? []} kiVerfuegbar={kiKonfiguriert()} />
    </Suspense>
  );
}
