import Link from "next/link";
import { bestaetigungErneutSenden, login } from "./actions";
import { TrackEvent } from "@/components/track-event";
import { LoginFelder } from "@/components/login-felder";
import { AnmeldeMeldung, AnmeldeRahmen } from "@/components/anmeldung/anmelde-rahmen";
import { AnmeldeKnopf } from "@/components/anmeldung/anmelde-knopf";
import { bestaetigenText } from "@/lib/anmeldung";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string; grund?: string; bestaetigen?: string; email?: string }>;
}) {
  const { error, reset, grund, bestaetigen, email } = await searchParams;
  const bestaetigung = bestaetigenText(bestaetigen, email);
  const passwortFalsch = error === "E-Mail oder Passwort stimmt nicht.";

  return (
    <AnmeldeRahmen>
      <div className="anm-form">
        <h1>Anmelden</h1>

        {error ? (
          <AnmeldeMeldung art="fehler">{error}</AnmeldeMeldung>
        ) : bestaetigung ? (
          <AnmeldeMeldung
            art="info"
            aktion={
              email && (
                <form action={bestaetigungErneutSenden}>
                  <input type="hidden" name="email" value={email} />
                  <button type="submit" className="link anm-link-knopf">
                    {bestaetigen === "gesendet" ? "Noch einmal senden" : "Erneut senden"}
                  </button>
                </form>
              )
            }
          >
            {bestaetigung}
          </AnmeldeMeldung>
        ) : reset ? (
          <AnmeldeMeldung art="ok">Passwort geändert. Du kannst dich jetzt anmelden.</AnmeldeMeldung>
        ) : grund === "inaktiv" ? (
          <AnmeldeMeldung art="info">Du wurdest nach 5 Minuten ohne Aktivität abgemeldet, zum Schutz deiner Daten.</AnmeldeMeldung>
        ) : null}

        {error && <TrackEvent event="login_fehlgeschlagen" properties={{ grund: error }} />}
        {reset && <TrackEvent event="passwort_geaendert" />}
        {bestaetigen === "1" && <TrackEvent event="registrierung_abgeschickt" properties={{ email_bestaetigung: true }} />}

        <form action={login} className="anm-felder">
          <LoginFelder email={email} passwortFalsch={passwortFalsch} />
          <AnmeldeKnopf laedtText="Wird angemeldet">
            Anmelden
          </AnmeldeKnopf>
        </form>

        <p className="anm-wechsel">
          Noch kein Konto? <Link className="link" href="/signup">Registrieren</Link>
        </p>
      </div>
    </AnmeldeRahmen>
  );
}
