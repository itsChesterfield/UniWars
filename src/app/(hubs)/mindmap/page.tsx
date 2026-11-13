import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { MindmapListe } from "@/components/mindmap/mindmap-liste";

export const metadata = { title: "MindMap · UniWars" };

export default async function MindmapSeite() {
  const supabase = await createClient();
  const [{ data: liste, error }, { data: faecher }] = await Promise.all([
    supabase.from("mindmap").select("id, name, fach_id, geaendert_am, daten").order("geaendert_am", { ascending: false }),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
  ]);

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="MindMap" />
        <EinrichtungHinweis hub="MindMap" />
      </>
    );
  }
  if (error) throw new Error(error.message);

  const eintraege = (liste ?? []).map(({ daten, name, ...m }) => {
    const anzahl = Array.isArray((daten as { knoten?: unknown[] } | null)?.knoten) ? (daten as { knoten: unknown[] }).knoten.length : 0;
    return { ...m, titel: name, info: `${anzahl} ${anzahl === 1 ? "Knoten" : "Knoten"}` };
  });

  return (
    <Suspense fallback={null}>
      <MindmapListe eintraege={eintraege} faecher={faecher ?? []} />
    </Suspense>
  );
}
