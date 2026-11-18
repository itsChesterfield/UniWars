import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { kiKonfiguriert } from "@/lib/ki/anbieter";
import { anzeigeName } from "@/lib/anzeige-name";
import { profilbildUrl } from "@/lib/profilbild";
import { HubKopf } from "@/components/hubs/hub-bausteine";
import { Einstellungen } from "@/components/einstellungen";
import { profilLesen } from "@/lib/ki/lernraum";
import { HochschuleWahl } from "@/components/einstellungen/hochschule-wahl";
import { MensaWahl } from "@/components/einstellungen/mensa-wahl";
import { SemesterBlock } from "@/components/einstellungen/semester-block";
import { semesterLage } from "@/lib/semester-server";
import { berlinDatum } from "@/lib/zeit";
import { adminKonfiguriert } from "@/lib/supabase/admin";
import { mailKonfiguriert } from "@/lib/mail";
import { domainAusMail } from "@/lib/hochschulen";
import { aktuelleRolle } from "@/lib/rollen";

export const metadata = { title: "Einstellungen · UniVerse" };

export default async function EinstellungenSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Rolle für das Schild im Profil (Plan Paket 1.5)
  const rolle = await aktuelleRolle();
  const domain = user.email ? domainAusMail(user.email) : null;
  const [{ data: settings }, { data: verif }, { data: anmeldeHs }] =
    await Promise.all([
      supabase
        .from("settings")
        .select("*, hochschule(name, ort)")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("uni_verifizierung")
        .select(
          "email, bestaetigt_am, gueltig_bis, code_laeuft_ab, hochschule(name)",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      domain && user.email_confirmed_at
        ? supabase.rpc("hochschule_zur_domain", { p_domain: domain })
        : Promise.resolve({ data: null }),
    ]);
  const jetzt = new Date();
  const semester = settings?.hochschule_id
    ? await semesterLage(supabase)
    : null;
  const bestaetigt = Boolean(
    verif?.bestaetigt_am &&
    verif.gueltig_bis &&
    new Date(verif.gueltig_bis) > jetzt,
  );
  // Vorschlag: Anmelde-Mail ist eine Uni-Mail und noch nicht als solche bestätigt
  const vorschlag =
    anmeldeHs && !(bestaetigt && verif?.email === user.email?.toLowerCase())
      ? ((
          await supabase
            .from("hochschule")
            .select("name")
            .eq("id", anmeldeHs)
            .maybeSingle()
        ).data?.name ?? null)
      : null;

  return (
    <>
      <HubKopf
        titel="Profil und Konto"
        untertitel="Profil, Anmeldung und Datenschutz. Design und Anordnung findest du unter Personalisierung."
      />
      <Einstellungen
        name={anzeigeName(settings, user)}
        email={user.email ?? ""}
        rolle={rolle}
        neueEmail={user.new_email ?? null}
        avatarUrl={await profilbildUrl(supabase, settings?.avatar_pfad)}
        kiEingewilligt={Boolean(settings?.ki_einwilligung)}
        audioEingewilligt={Boolean(settings?.ki_audio_einwilligung)}
        kiVerfuegbar={kiKonfiguriert()}
        kiProfil={profilLesen(settings?.ki_profil)}
        hochschule={
          <>
            <HochschuleWahl
              hochschule={settings?.hochschule?.name ?? null}
              frei={settings?.hochschule_frei ?? null}
              verifizierbar={adminKonfiguriert()}
              mailMoeglich={adminKonfiguriert() && mailKonfiguriert()}
              vorschlag={bestaetigt ? null : vorschlag}
              verifizierung={
                verif
                  ? {
                      email: verif.email,
                      bestaetigt,
                      gueltigBis: verif.gueltig_bis,
                      hochschule: verif.hochschule?.name ?? null,
                      codeOffen: Boolean(
                        !verif.bestaetigt_am &&
                        verif.code_laeuft_ab &&
                        new Date(verif.code_laeuft_ab) > jetzt,
                      ),
                    }
                  : null
              }
            />
            {semester && (
              <SemesterBlock
                termine={semester.termine}
                gepflegt={semester.gepflegt}
                geaendertAm={semester.geaendertAm}
                land={semester.land}
                heute={berlinDatum(jetzt)}
              />
            )}
            <MensaWahl
              mensa={settings?.mensa_name ?? null}
              vorschlag={settings?.hochschule?.ort ?? null}
            />
          </>
        }
      />
    </>
  );
}
