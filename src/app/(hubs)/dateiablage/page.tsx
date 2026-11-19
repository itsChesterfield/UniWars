import { Suspense } from "react";
import { redirect } from "next/navigation";
import { fachZuordnungen, type MaterialFachZuordnung } from "@/lib/dateiablage/material";
import { kiKonfiguriert } from "@/lib/ki/anbieter";
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

  const [{ data: dateien, error }, { data: faecher, error: fachFehler }, material, zuordnung, themen, info, freigabeTabellen, pdfStand, belegung] = await Promise.all([
    supabase.from("datei").select("*").order("erstellt_am", { ascending: false }),
    supabase.from("fach").select("id, name, farbe, aktiv").order("erstellt_am", { ascending: true }),
    hubMaterialLaden(supabase),
    supabase.from("material_ablage_fach").select("art, material_id, fach_id, ausgeblendet, thema_id"),
    supabase.from("material_thema").select("id, fach_id, name").order("position").order("name"),
    supabase.from("material_ablage_info").select("art, material_id, anzeigetitel, papierkorb_am, papierkorb_titel"),
    supabase.from("material_paket").select("id").limit(1),
    supabase.from("pdf_stand").select("datei_id, letzte_seite").eq("user_id", user.id),
    supabase.rpc("material_speicherbelegung"),
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
  const basisZuordnung = zuordnung.error?.message.includes("thema_id") && tabelleFehlt(zuordnung.error)
    ? await supabase.from("material_ablage_fach").select("art, material_id, fach_id, ausgeblendet")
    : zuordnung;
  if (basisZuordnung.error && !tabelleFehlt(basisZuordnung.error)) throw new Error("Fachzuordnungen konnten nicht geladen werden.");
  const zuordnungen: MaterialFachZuordnung[] = basisZuordnung.data ?? [];
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
      <Dateiablage userId={user.id} initialDateien={liste} material={material} themen={themen.data ?? []} info={info.data ?? []} workflow={!themen.error && !info.error} freigaben={!freigabeTabellen.error} ki={kiKonfiguriert()} pdfStand={pdfStand.data ?? []} zuordnungen={zuordnungen} mehrfachVerfuegbar={!basisZuordnung.error} ordner={ordner} speicherBelegt={belegung.data} limit={SPEICHER_LIMIT_BYTES} />
    </Suspense>
  );
}
