import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { datenLesen } from "@/lib/tabellen/formeln";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { TabellenEditor } from "@/components/tabellen/tabellen-editor";

export default async function TabelleSeite({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ neu?: string }>;
}) {
  const [{ id }, { neu }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [{ data: tabelle, error }, { data: faecher }] = await Promise.all([
    supabase.from("tabelle").select("*").eq("id", id).maybeSingle(),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
  ]);

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="Tabellen" />
        <EinrichtungHinweis hub="Tabellen" />
      </>
    );
  }
  if (error?.code === "22P02") notFound();
  if (error) throw new Error(error.message);
  if (!tabelle) notFound();

  return (
    <TabellenEditor
      key={tabelle.id}
      id={tabelle.id}
      startTitel={tabelle.titel}
      startFachId={tabelle.fach_id}
      startDaten={datenLesen(tabelle.daten)}
      faecher={faecher ?? []}
      istNeu={neu === "1"}
    />
  );
}
