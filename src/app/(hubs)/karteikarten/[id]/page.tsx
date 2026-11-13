import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { StapelAnsicht } from "@/components/karteikarten/stapel-ansicht";

export default async function StapelSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: stapel, error }, { data: karten }, { data: faecher }] = await Promise.all([
    supabase.from("kk_stapel").select("*").eq("id", id).maybeSingle(),
    supabase.from("kk_karte").select("*").eq("stapel_id", id).order("erstellt_am", { ascending: true }),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
  ]);

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="Karteikarten" />
        <EinrichtungHinweis hub="Karteikarten" />
      </>
    );
  }
  if (error?.code === "22P02") notFound(); // keine gültige ID
  if (error) throw new Error(error.message);
  if (!stapel) notFound();

  return <StapelAnsicht key={stapel.id} stapel={stapel} karten={karten ?? []} faecher={faecher ?? []} />;
}
