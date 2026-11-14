import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { audioVerfuegbar } from "@/lib/ki/audio";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { TranskriptionHub, type TranskriptEintrag } from "@/components/transkription/transkription-hub";
import type { TeilStatus } from "@/lib/transkription/transkript";

export const metadata = { title: "Transkription · UniWars" };

/** Transkriptions-Hub: aufnehmen (TRA-01), Datei wählen (TRA-02), Liste der Transkripte. */
export default async function TranskriptionSeite({ searchParams }: { searchParams: Promise<{ datei?: string }> }) {
  const { datei: startDatei } = await searchParams;
  const supabase = await createClient();
  const [{ data: transkripte, error }, { data: faecher }, { data: audios }] = await Promise.all([
    supabase
      .from("transkript")
      .select("id, titel, fach_id, quelle, erstellt_am, transkript_teil(nr, status, sekunden, gestartet_am)")
      .order("erstellt_am", { ascending: false }),
    supabase.from("fach").select("id, name, farbe").order("name"),
    supabase.from("datei").select("id, name, fach_id, groesse, erstellt_am").like("mime_typ", "audio/%").order("erstellt_am", { ascending: false }).limit(200),
  ]);

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="Transkription" />
        <EinrichtungHinweis hub="Die Transkription" />
      </>
    );
  }
  if (error) throw new Error(error.message);

  const eintraege: TranskriptEintrag[] = (transkripte ?? []).map((t) => ({
    id: t.id,
    titel: t.titel,
    fach_id: t.fach_id,
    quelle: t.quelle === "datei" ? "datei" : "aufnahme",
    erstellt_am: t.erstellt_am,
    teile: (t.transkript_teil ?? []).map((teil) => ({ ...teil, status: teil.status as TeilStatus })),
  }));

  return (
    <TranskriptionHub
      eintraege={eintraege}
      faecher={faecher ?? []}
      audioDateien={audios ?? []}
      startDateiId={typeof startDatei === "string" ? startDatei : null}
      verfuegbar={audioVerfuegbar().diktat}
    />
  );
}
