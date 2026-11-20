import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HubKopf } from "@/components/hubs/hub-bausteine";
import { Personalisierung } from "@/components/einstellungen/personalisierung";
import { EigeneBilder } from "@/components/einstellungen/eigene-bilder";
import { darstellungLesen, symbolleisteLesen } from "@/lib/personalisierung";
import { hintergrundLesen } from "@/lib/hintergrund";
import { signieren } from "@/lib/hintergrund-server";

export const metadata = { title: "Personalisierung · UniVerse" };

/** Design B3: Einstellungen › Personalisierung (DESIGN.md Abschnitt 6). */
export default async function PersonalisierungSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: settings }, { data: bilderZeile, error: bilderFehler }] = await Promise.all([
    supabase.from("settings").select("theme, darstellung, symbolleiste").eq("user_id", user.id).maybeSingle(),
    // Eigene Bilder: eigene Abfrage, damit die Seite auch ohne die Migration `eigene_bilder` lädt
    supabase.from("settings").select("hintergrund").eq("user_id", user.id).maybeSingle(),
  ]);
  const hintergrund = !bilderFehler && bilderZeile ? hintergrundLesen(bilderZeile.hintergrund, user.id) : null;
  const signiert = hintergrund ? await signieren(supabase, hintergrund.bilder) : {};
  const vorschau = Object.fromEntries(Object.entries(signiert).map(([id, b]) => [id, b.mittel]));

  return (
    <>
      <HubKopf titel="Personalisierung" untertitel="So sieht UniVerse für dich aus. Jede Änderung gilt sofort." />
      <Personalisierung
        theme={settings?.theme ?? "HELL"}
        darstellung={darstellungLesen(settings?.darstellung)}
        symbolleiste={symbolleisteLesen(settings?.symbolleiste)}
        bilder={hintergrund && <EigeneBilder hintergrund={hintergrund} vorschau={vorschau} userId={user.id} />}
      />
    </>
  );
}
