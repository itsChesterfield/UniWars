import Link from "next/link";
import { requestPasswordReset } from "./actions";
import { TrackEvent } from "@/components/track-event";
import { AnmeldeMeldung, AnmeldeRahmen } from "@/components/anmeldung/anmelde-rahmen";
import { AnmeldeKnopf } from "@/components/anmeldung/anmelde-knopf";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <AnmeldeRahmen>
      <div className="anm-form">
        <h1>Passwort vergessen</h1>
        <p className="anm-unter">Wir schicken dir einen Link, mit dem du ein neues Passwort festlegst.</p>

        {error && <AnmeldeMeldung art="fehler">{error}</AnmeldeMeldung>}
        {sent && (
          <AnmeldeMeldung art="info">
            Falls es ein Konto mit dieser E-Mail gibt, ist der Link unterwegs. Schau auch im Spam-Ordner.
          </AnmeldeMeldung>
        )}
        {error && <TrackEvent event="passwort_reset_fehlgeschlagen" properties={{ grund: error }} />}
        {sent && <TrackEvent event="passwort_reset_angefordert" />}

        <form action={requestPasswordReset} className="anm-felder">
          <div className="anm-feld">
            <label htmlFor="email">E-Mail</label>
            <input id="email" name="email" type="email" placeholder="name@hochschule.de" required autoComplete="email" />
          </div>
          <AnmeldeKnopf laedtText="Link wird verschickt">
            Link schicken
          </AnmeldeKnopf>
        </form>

        <p className="anm-wechsel">
          <Link className="link" href="/login">
            Zurück zur Anmeldung
          </Link>
        </p>
      </div>
    </AnmeldeRahmen>
  );
}
