import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { kiKonfiguriert } from "@/lib/ki/anbieter";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { TranskriptAnsicht } from "@/components/transkription/transkript-ansicht";
import { absaetzeLesen, type TeilStatus } from "@/lib/transkription/transkript";

export const metadata = { title: "Transkript · UniWars" };

/** TRA-03 … TRA-05 und KI-04 für ein Transkript. */
export default async function TranskriptSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: transkript, error }, { data: teile }, { data: faecher }] = await Promise.all([
    supabase.from("transkript").select("id, titel, fach_id, sprache, quelle, erstellt_am, absaetze, text").eq("id", id).maybeSingle(),
    supabase.from("transkript_teil").select("id, nr, datei_id, sekunden, status, fehler, gestartet_am, text").eq("transkript_id", id).order("nr"),
    supabase.from("fach").select("id, name, farbe").order("name"),
  ]);

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="Transkription" />
        <EinrichtungHinweis hub="Die Transkription" />
      </>
    );
  }
  if (error?.code === "22P02") notFound();
  if (error) throw new Error(error.message);
  if (!transkript) notFound();

  return (
    <TranskriptAnsicht
      key={transkript.id}
      transkript={{
        id: transkript.id,
        titel: transkript.titel,
        fach_id: transkript.fach_id,
        sprache: transkript.sprache === "en" ? "en" : "de",
        erstellt_am: transkript.erstellt_am,
      }}
      startStand={{
        teile: (teile ?? []).map((t) => ({ ...t, status: t.status as TeilStatus })),
        absaetze: absaetzeLesen(transkript.absaetze) ?? [],
        text: transkript.text,
      }}
      faecher={faecher ?? []}
      kiVerfuegbar={kiKonfiguriert()}
    />
  );
}
