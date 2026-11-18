import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { audioVerfuegbar } from "@/lib/ki/audio";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import {
  TranskriptionHub,
  type TranskriptEintrag,
} from "@/components/transkription/transkription-hub";
import type { TeilStatus } from "@/lib/transkription/transkript";
import { PodcastBereich } from "@/components/quiz/podcast-bereich";
import type { QuellOption } from "@/components/quiz/quellen-wahl";
import { kiKonfiguriert } from "@/lib/ki/anbieter";

export const maxDuration = 300;

export const metadata = { title: "Transkription · UniVerse" };

/** Transkriptions-Hub: aufnehmen (TRA-01), Datei wählen (TRA-02), Liste der Transkripte. */
export default async function TranskriptionSeite({
  searchParams,
}: {
  searchParams: Promise<{ datei?: string }>;
}) {
  const { datei: startDatei } = await searchParams;
  const supabase = await createClient();
  const [
    { data: transkripte, error },
    { data: faecher },
    { data: audios },
    { data: podcasts },
    { data: pdfs },
    { data: notizen },
  ] = await Promise.all([
    supabase
      .from("transkript")
      .select(
        "id, titel, fach_id, quelle, erstellt_am, transkript_teil(nr, status, sekunden, gestartet_am)",
      )
      .order("erstellt_am", { ascending: false }),
    supabase.from("fach").select("id, name, farbe").order("name"),
    supabase
      .from("datei")
      .select("id, name, fach_id, groesse, erstellt_am")
      .like("mime_typ", "audio/%")
      .order("erstellt_am", { ascending: false })
      .limit(200),
    supabase
      .from("podcast")
      .select("id, titel, fach_id, skript, erstellt_am")
      .order("erstellt_am", { ascending: false })
      .limit(60),
    supabase
      .from("datei")
      .select("id, name, fach_id")
      .eq("mime_typ", "application/pdf")
      .order("name")
      .limit(500),
    supabase
      .from("notiz")
      .select("id, titel, fach_id")
      .order("geaendert_am", { ascending: false })
      .limit(500),
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
    teile: (t.transkript_teil ?? []).map((teil) => ({
      ...teil,
      status: teil.status as TeilStatus,
    })),
  }));

  const optionen: QuellOption[] = [
    ...(pdfs ?? []).map((p) => ({
      art: "pdf" as const,
      id: p.id,
      titel: p.name,
      fach_id: p.fach_id,
    })),
    ...(notizen ?? []).map((n) => ({
      art: "notiz" as const,
      id: n.id,
      titel: n.titel || "Unbenannte Notiz",
      fach_id: n.fach_id,
    })),
  ];

  return (
    <>
      <TranskriptionHub
        eintraege={eintraege}
        faecher={faecher ?? []}
        audioDateien={audios ?? []}
        startDateiId={typeof startDatei === "string" ? startDatei : null}
        verfuegbar={audioVerfuegbar().diktat}
      />
      <PodcastBereich
        podcasts={(podcasts ?? []).map((p) => ({
          id: p.id,
          titel: p.titel,
          fach_id: p.fach_id,
          erstellt_am: p.erstellt_am,
          segmente: Array.isArray(p.skript) ? p.skript.length : 0,
        }))}
        faecher={faecher ?? []}
        optionen={optionen}
        kiVerfuegbar={kiKonfiguriert()}
      />
    </>
  );
}
