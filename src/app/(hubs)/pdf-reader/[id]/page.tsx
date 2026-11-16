import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { PdfReader } from "@/components/pdf-reader/pdf-reader";
import { alsRechtecke, istFarbe } from "@/lib/pdf-reader/markierungen";
import { kiKonfiguriert } from "@/lib/ki/anbieter";
import { markdownAlsText } from "@/lib/markdown-text";

export default async function PdfAnsehenSeite({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ seite?: string }>;
}) {
  const { id } = await params;
  // ?seite=12 – z. B. aus einer Verlinkung [[Skript.pdf#S12]] in einer Notiz
  const zielSeite = Number((await searchParams).seite) || null;
  const supabase = await createClient();
  const [{ data: datei, error }, { data: stand }, { data: markierungen }, { data: links }] = await Promise.all([
    supabase.from("datei").select("id, name, mime_typ, speicher_pfad").eq("id", id).maybeSingle(),
    supabase.from("pdf_stand").select("letzte_seite, lesezeichen").eq("datei_id", id).maybeSingle(),
    // Fehlt die Tabelle noch, bleibt die Liste einfach leer
    supabase.from("pdf_markierung").select("id, seite, farbe, rechtecke, text, notiz").eq("datei_id", id).order("seite").order("erstellt_am"),
    // Notizen, die auf diese PDF verlinken (Seitenleiste)
    supabase.from("notiz_link").select("von_notiz_id, seite").eq("ziel_datei_id", id),
  ]);
  const seitenProNotiz = new Map<string, number[]>();
  for (const l of links ?? []) {
    const liste = seitenProNotiz.get(l.von_notiz_id) ?? [];
    if (l.seite && !liste.includes(l.seite)) liste.push(l.seite);
    seitenProNotiz.set(l.von_notiz_id, liste);
  }
  const { data: notizen } = seitenProNotiz.size
    ? await supabase.from("notiz").select("id, titel, inhalt, geaendert_am").in("id", [...seitenProNotiz.keys()]).order("geaendert_am", { ascending: false })
    : { data: [] as { id: string; titel: string; inhalt: string; geaendert_am: string }[] };

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="PDF Reader" />
        <EinrichtungHinweis hub="Der PDF Reader" />
      </>
    );
  }
  if (error?.code === "22P02") notFound();
  if (error) throw new Error(error.message);
  if (!datei || datei.mime_typ !== "application/pdf") notFound();

  const { data: link, error: linkFehler } = await supabase.storage.from("dateiablage").createSignedUrl(datei.speicher_pfad, 3600);
  if (linkFehler) throw new Error(linkFehler.message);

  return (
    <PdfReader
      key={datei.id}
      datei={{ id: datei.id, name: datei.name }}
      url={link.signedUrl}
      startSeite={zielSeite ?? stand?.letzte_seite ?? 1}
      startLesezeichen={stand?.lesezeichen ?? []}
      kiVerfuegbar={kiKonfiguriert()}
      startNotizen={(notizen ?? []).map((n) => ({
        id: n.id,
        titel: n.titel,
        vorschau: markdownAlsText(n.inhalt.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_g, z: string, l?: string) => l ?? z)).slice(0, 140),
        seiten: (seitenProNotiz.get(n.id) ?? []).sort((a, b) => a - b),
      }))}
      startMarkierungen={(markierungen ?? []).map((m) => ({
        ...m,
        farbe: istFarbe(m.farbe) ? m.farbe : "GELB",
        rechtecke: alsRechtecke(m.rechtecke),
      }))}
    />
  );
}
