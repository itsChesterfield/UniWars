import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { SPEICHER_LIMIT_BYTES } from "@/lib/dateiablage/dateien";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { Dateiablage, type Ordner } from "@/components/dateiablage/dateiablage";

export const metadata = { title: "Dateiablage · UniWars" };

export default async function DateiablageSeite() {
  const supabase = await createClient();
  const [{ data: dateien, error }, { data: faecher }] = await Promise.all([
    supabase.from("datei").select("*").order("erstellt_am", { ascending: false }),
    supabase.from("fach").select("id, name, farbe, aktiv").order("erstellt_am", { ascending: true }),
  ]);

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="Dateiablage" />
        <EinrichtungHinweis hub="Die Dateiablage" />
      </>
    );
  }
  if (error) throw new Error(error.message);

  const liste = dateien ?? [];
  // DAT-01: ein Ordner pro Fach (archivierte nur, wenn noch Dateien drin sind) + "Allgemein"
  const ordner: Ordner[] = [
    { id: null, name: "Allgemein", farbe: null },
    ...(faecher ?? [])
      .filter((f) => f.aktiv || liste.some((d) => d.fach_id === f.id))
      .map((f) => ({ id: f.id, name: f.aktiv ? f.name : `${f.name} (archiviert)`, farbe: f.farbe })),
  ];

  return (
    <Suspense fallback={null}>
      <Dateiablage initialDateien={liste} ordner={ordner} limit={SPEICHER_LIMIT_BYTES} />
    </Suspense>
  );
}
