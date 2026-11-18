import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { datenLesen } from "@/lib/mindmap/knoten";
import { Einrichtung } from "@/components/zustand";
import { MindmapEditor } from "@/components/mindmap/mindmap-editor";

export default async function MindmapEditorSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: m, error }, { data: faecher }] = await Promise.all([
    supabase.from("mindmap").select("*").eq("id", id).maybeSingle(),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
  ]);

  if (tabelleFehlt(error)) {
    return <Einrichtung bereich="MindMap" />;
  }
  if (error?.code === "22P02") notFound();
  if (error) throw new Error(error.message);
  if (!m) notFound();

  return (
    <MindmapEditor
      key={m.id}
      id={m.id}
      startName={m.name}
      startFachId={m.fach_id}
      startDaten={datenLesen(m.daten, m.name)}
      faecher={faecher ?? []}
    />
  );
}
