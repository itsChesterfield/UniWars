import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HubKopf } from "@/components/hubs/hub-bausteine";
import { Personalisierung } from "@/components/einstellungen/personalisierung";
import { darstellungLesen, symbolleisteLesen } from "@/lib/personalisierung";

export const metadata = { title: "Personalisierung · UniVerse" };

/** Design B3: Einstellungen › Personalisierung (DESIGN.md Abschnitt 6). */
export default async function PersonalisierungSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: settings } = await supabase
    .from("settings")
    .select("theme, darstellung, symbolleiste")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <>
      <HubKopf titel="Personalisierung" untertitel="So sieht UniVerse für dich aus. Jede Änderung gilt sofort." />
      <Personalisierung
        theme={settings?.theme ?? "HELL"}
        darstellung={darstellungLesen(settings?.darstellung)}
        symbolleiste={symbolleisteLesen(settings?.symbolleiste)}
      />
    </>
  );
}
