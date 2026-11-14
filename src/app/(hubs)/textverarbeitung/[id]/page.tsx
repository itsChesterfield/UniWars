import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { DokumentEditor } from "@/components/textverarbeitung/dokument-editor";
import { kiKonfiguriert } from "@/lib/ki/anbieter";

export default async function DokumentSeite({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ neu?: string }>;
}) {
  const [{ id }, { neu }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [{ data: dokument, error }, { data: faecher }, { data: quellen }] = await Promise.all([
    supabase.from("dokument").select("*").eq("id", id).maybeSingle(),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
    supabase.from("literatur_quelle").select("id, autoren, titel, jahr, seiten").order("autoren", { ascending: true }),
  ]);

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="Textverarbeitung" />
        <EinrichtungHinweis hub="Die Textverarbeitung" />
      </>
    );
  }
  if (error?.code === "22P02") notFound();
  if (error) throw new Error(error.message);
  if (!dokument) notFound();

  return (
    <DokumentEditor key={dokument.id} dokument={dokument} faecher={faecher ?? []} quellen={quellen ?? []} istNeu={neu === "1"} kiVerfuegbar={kiKonfiguriert()} />
  );
}
