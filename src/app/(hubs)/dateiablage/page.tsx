import { Suspense } from "react";
import { redirect } from "next/navigation";
import { fachZuordnungen } from "@/lib/dateiablage/material";
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

  const [{ data: dateien, error }, { data: faecher, error: fachFehler }, material, zuordnung] = await Promise.all([
    supabase.from("datei").select("*").order("erstellt_am", { ascending: false }),
    supabase.from("fach").select("id, name, farbe, aktiv").order("erstellt_am", { ascending: true }),
    hubMaterialLaden(supabase),
    supabase.from("material_ablage_fach").select("art, material_id, fach_id, ausgeblendet"),
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
  if (zuordnung.error && !tabelleFehlt(zuordnung.error)) throw new Error("Fachzuordnungen konnten nicht geladen werden.");
  const zuordnungen = zuordnung.data ?? [];
  const belegteFaecher = new Set([
    ...liste.flatMap((d) => fachZuordnungen(d.fach_id, zuordnungen.filter((z) => z.art === "datei" && z.material_id === d.id))),
    ...material.flatMap((m) => fachZuordnungen(m.fachId, zuordnungen.filter((z) => z.art === m.art && z.material_id === m.id))),
  ]);
  const ordner: Ordner[] = [
    { id: null, name: "Lose Blätter", farbe: null },
    ...(faecher ?? [])
      .filter((f) => f.aktiv || belegteFaecher.has(f.id))
      .map((f) => ({ id: f.id, name: f.aktiv ? f.name : `${f.name} (archiviert)`, farbe: f.farbe })),
  ];

  return (
    <Suspense fallback={null}>
      <Dateiablage userId={user.id} initialDateien={liste} material={material} zuordnungen={zuordnungen} mehrfachVerfuegbar={!zuordnung.error} ordner={ordner} limit={SPEICHER_LIMIT_BYTES} />
    </Suspense>
  );
}
