import { updatePassword } from "./actions";
import { TrackEvent } from "@/components/track-event";
import { AnmeldeMeldung, AnmeldeRahmen } from "@/components/anmeldung/anmelde-rahmen";
import { AnmeldeKnopf } from "@/components/anmeldung/anmelde-knopf";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AnmeldeRahmen>
      <div className="anm-form">
        <h1>Neues Passwort</h1>

        {error && <AnmeldeMeldung art="fehler">{error}</AnmeldeMeldung>}
        {error && <TrackEvent event="neues_passwort_fehlgeschlagen" properties={{ grund: error }} />}

        <form action={updatePassword} className="anm-felder">
          <div className="anm-feld">
            <label htmlFor="password">Neues Passwort</label>
            <input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" />
            <p className="anm-feld-hilfe">Mindestens 6 Zeichen</p>
          </div>
          <div className="anm-feld">
            <label htmlFor="password-wiederholung">Passwort wiederholen</label>
            <input
              id="password-wiederholung"
              name="password-wiederholung"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <AnmeldeKnopf laedtText="Wird gespeichert">
            Passwort speichern
          </AnmeldeKnopf>
        </form>
      </div>
    </AnmeldeRahmen>
  );
}
