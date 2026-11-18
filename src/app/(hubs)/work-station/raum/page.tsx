import { createClient } from "@/lib/supabase/server";
import { Fokusraum } from "@/components/work-station/fokusraum";
import type { Raum } from "@/lib/fokusraum";

export const metadata = { title: "Fokusraum · UniVerse" };

export default async function FokusraumSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: verif }, { data: gruppen }] = await Promise.all([
    supabase.from("uni_verifizierung").select("hochschule_id, bestaetigt_am, gueltig_bis, hochschule(name)").eq("user_id", user?.id ?? "").maybeSingle(),
    supabase.from("deadline").select("id, titel").eq("typ", "GRUPPENARBEIT").eq("erledigt", false).order("faellig_am").limit(20),
  ]);

  const jetzt = new Date();
  const hsGueltig = Boolean(verif?.hochschule_id && verif.bestaetigt_am && verif.gueltig_bis && new Date(verif.gueltig_bis) > jetzt);
  const raeume: Raum[] = [
    { art: "alle", id: null, titel: "Alle" },
    ...(hsGueltig && verif?.hochschule_id ? [{ art: "hs" as const, id: verif.hochschule_id, titel: verif.hochschule?.name ?? "Meine Hochschule" }] : []),
    ...(gruppen ?? []).map((g) => ({ art: "gruppe" as const, id: g.id, titel: g.titel })),
  ];

  return <Fokusraum raeume={raeume} hochschuleBestaetigt={hsGueltig} />;
}
