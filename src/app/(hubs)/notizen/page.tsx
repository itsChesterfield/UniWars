import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { berlinDatum, berlinUhrzeit, berlinWochentag } from "@/lib/zeit";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { NotizenHub, type LaufendeVorlesung } from "@/components/notizen/notizen-hub";
import { kiKonfiguriert } from "@/lib/ki/anbieter";

export const metadata = { title: "Notizen · UniWars" };

export default async function NotizenSeite() {
  const supabase = await createClient();
  const [{ data: notizen, error }, { data: faecher }, { data: stundenplan }] = await Promise.all([
    supabase
      .from("notiz")
      .select("*")
      .order("angepinnt", { ascending: false })
      .order("geaendert_am", { ascending: false }),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
    supabase.from("stundenplan_eintrag").select("id, fach_id, tag, start_zeit, end_zeit"),
  ]);

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="Notizen" />
        <EinrichtungHinweis hub="Notizen" />
      </>
    );
  }
  if (error) throw new Error(error.message);

  // NOT-08: Läuft laut Stundenplan gerade eine Vorlesung?
  const jetzt = new Date();
  const tag = berlinWochentag(jetzt);
  const uhr = berlinUhrzeit(jetzt);
  const laufend = (stundenplan ?? []).find(
    (e) => e.tag === tag && e.start_zeit.slice(0, 5) <= uhr && uhr < e.end_zeit.slice(0, 5),
  );
  const heute = berlinDatum(jetzt);
  const laufendeVorlesung: LaufendeVorlesung | null = laufend
    ? {
        stundenplanEintragId: laufend.id,
        fachName: (faecher ?? []).find((f) => f.id === laufend.fach_id)?.name ?? "Vorlesung",
        vorhandeneNotizId:
          (notizen ?? []).find((n) => n.stundenplan_eintrag_id === laufend.id && n.vorlesung_datum === heute)?.id ?? null,
      }
    : null;

  return (
    <Suspense fallback={null}>
      <NotizenHub
        initialNotizen={notizen ?? []}
        faecher={faecher ?? []}
        laufendeVorlesung={laufendeVorlesung}
        kiVerfuegbar={kiKonfiguriert()}
      />
    </Suspense>
  );
}
