import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { designLesen, folienLesen } from "@/lib/praesentationen/folien";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { PraesentationsEditor } from "@/components/praesentationen/praesentations-editor";

export default async function PraesentationSeite({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ neu?: string }>;
}) {
  const [{ id }, { neu }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [{ data: p, error }, { data: faecher }] = await Promise.all([
    supabase.from("praesentation").select("*").eq("id", id).maybeSingle(),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
  ]);

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="Präsentationen" />
        <EinrichtungHinweis hub="Präsentationen" />
      </>
    );
  }
  if (error?.code === "22P02") notFound();
  if (error) throw new Error(error.message);
  if (!p) notFound();

  return (
    <PraesentationsEditor
      key={p.id}
      id={p.id}
      startTitel={p.titel}
      startFachId={p.fach_id}
      startDesign={designLesen(p.design)}
      startFolien={folienLesen(p.folien)}
      faecher={faecher ?? []}
      istNeu={neu === "1"}
    />
  );
}
