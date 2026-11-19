import { notFound } from "next/navigation";
import { HubKopf } from "@/components/hubs/hub-bausteine";
import { istMaterialId } from "@/lib/dateiablage/material";
import { ablageDateiname, istWebLink, webLinkUrl } from "@/lib/dateiablage/weblink";
import { createClient } from "@/lib/supabase/server";

export default async function WeblinkSeite({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { id } = await params;
  if (!user || !istMaterialId(id)) notFound();

  const { data: datei } = await supabase.from("datei").select("name, mime_typ, speicher_pfad").eq("id", id).maybeSingle();
  if (!datei || !istWebLink(datei)) notFound();
  const { data: inhalt } = await supabase.storage.from("dateiablage").download(datei.speicher_pfad);
  const ziel = inhalt && inhalt.size <= 8192 ? webLinkUrl(await inhalt.text()) : null;
  if (!ziel) notFound();

  return (
    <>
      <HubKopf titel={ablageDateiname(datei)} />
      <a className="knopf haupt" href={ziel.href} target="_blank" rel="noopener noreferrer">
        {ziel.hostname} öffnen
      </a>
    </>
  );
}
