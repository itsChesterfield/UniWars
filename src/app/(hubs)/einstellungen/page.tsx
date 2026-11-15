import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { kiKonfiguriert } from "@/lib/ki/anbieter";
import { anzeigeName } from "@/lib/anzeige-name";
import { profilbildUrl } from "@/lib/profilbild";
import { HubKopf } from "@/components/hubs/hub-bausteine";
import { Einstellungen } from "@/components/einstellungen";

export const metadata = { title: "Einstellungen · UniWars" };

export default async function EinstellungenSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: settings } = await supabase.from("settings").select("*").eq("user_id", user.id).maybeSingle();

  return (
    <>
      <HubKopf titel="Einstellungen" untertitel="Profil, Konto, Design und Datenschutz." />
      <Einstellungen
        name={anzeigeName(settings, user)}
        email={user.email ?? ""}
        neueEmail={user.new_email ?? null}
        avatarUrl={await profilbildUrl(supabase, settings?.avatar_pfad)}
        theme={settings?.theme ?? "HELL"}
        kiEingewilligt={Boolean(settings?.ki_einwilligung)}
        audioEingewilligt={Boolean(settings?.ki_audio_einwilligung)}
        kiVerfuegbar={kiKonfiguriert()}
      />
    </>
  );
}
