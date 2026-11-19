import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DesignRahmen } from "@/components/design-rahmen";
import { Einrichtung } from "@/components/einrichtung/einrichtung";
import { darstellungLesen } from "@/lib/personalisierung";
import { anzeigeName } from "@/lib/anzeige-name";
import { googleKonfiguriert } from "@/lib/kalender/google";
import { EINRICHTUNG_COOKIE, schritte, schrittBegrenzen, standLesen } from "@/lib/einrichtung";

export const metadata = { title: "Einrichtung · UniVerse" };

/** Einrichtung beim ersten Login: eine Frage pro Bildschirm, alles überspringbar. */
export default async function EinrichtungSeite() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const [{ data: settings }, { data: faecher }, { count: termine }, { data: kalender }] = await Promise.all([
    supabase.from("settings").select("*, hochschule(name)").eq("user_id", user.id).maybeSingle(),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
    supabase.from("stundenplan_eintrag").select("id", { count: "exact", head: true }),
    supabase.from("kalender_verbindung").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);

  const kalenderMoeglich = googleKonfiguriert();
  const liste = schritte(kalenderMoeglich);
  const stand = standLesen((await cookies()).get(EINRICHTUNG_COOKIE)?.value);
  const start = stand.art === "laeuft" ? schrittBegrenzen(stand.schritt, liste.length) : 0;

  return (
    <DesignRahmen theme={settings?.theme ?? "HELL"} darstellung={darstellungLesen(settings?.darstellung)}>
      <Einrichtung
        name={anzeigeName(settings, user)}
        schritte={liste}
        start={start}
        hochschule={settings?.hochschule?.name ?? settings?.hochschule_frei ?? null}
        mensa={settings?.mensa_name ?? null}
        faecher={faecher ?? []}
        termine={termine ?? 0}
        kalenderVerbunden={Boolean(kalender)}
      />
    </DesignRahmen>
  );
}
