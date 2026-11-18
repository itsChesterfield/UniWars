import { Suspense } from "react";
import { redirect } from "next/navigation";
import { hubMaterialLaden } from "@/lib/dateiablage/material-server";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { SPEICHER_LIMIT_BYTES } from "@/lib/dateiablage/dateien";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { Dateiablage, type Ordner } from "@/components/dateiablage/dateiablage";

export const metadata = { title: "Dateiablage · UniVerse" };

export default async function DateiablageSeite() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: dateien, error }, { data: faecher, error: fachFehler }, material] = await Promise.all([
    supabase.from("datei").select("*").order("erstellt_am", { ascending: false }),
    supabase.from("fach").select("id, name, farbe, aktiv").order("erstellt_am", { ascending: true }),
    hubMaterialLaden(supabase),
  ]);

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="Dateiablage" />
        <EinrichtungHinweis hub="Die Dateiablage" />
      </>
    );
  }
  if (error || fachFehler) throw new Error("Die Dateiablage konnte nicht geladen werden.");

  const liste = dateien ?? [];
  const belegteFaecher = new Set([...liste.map((d) => d.fach_id), ...material.map((m) => m.fachId)]);
  const ordner: Ordner[] = [
    { id: null, name: "Lose Blätter", farbe: null },
    ...(faecher ?? [])
      .filter((f) => f.aktiv || belegteFaecher.has(f.id))
      .map((f) => ({ id: f.id, name: f.aktiv ? f.name : `${f.name} (archiviert)`, farbe: f.farbe })),
  ];

  return (
    <Suspense fallback={null}>
      <Dateiablage initialDateien={liste} material={material} ordner={ordner} limit={SPEICHER_LIMIT_BYTES} />
    </Suspense>
  );
}
