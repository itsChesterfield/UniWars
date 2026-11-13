import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { elementeLesen } from "@/lib/whiteboard/elemente";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { WhiteboardEditor } from "@/components/whiteboard/whiteboard-editor";

export default async function WhiteboardEditorSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: w, error }, { data: faecher }] = await Promise.all([
    supabase.from("whiteboard").select("*").eq("id", id).maybeSingle(),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
  ]);

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="Whiteboard" />
        <EinrichtungHinweis hub="Das Whiteboard" />
      </>
    );
  }
  if (error?.code === "22P02") notFound();
  if (error) throw new Error(error.message);
  if (!w) notFound();

  return (
    <WhiteboardEditor
      key={w.id}
      id={w.id}
      startName={w.name}
      startFachId={w.fach_id}
      startElemente={elementeLesen(w.daten)}
      faecher={faecher ?? []}
    />
  );
}
