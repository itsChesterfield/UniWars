import { updatePassword } from "./actions";
import { TrackEvent } from "@/components/track-event";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="auth-page">
      <form className="auth-form">
        <h1>Neues Passwort</h1>

        {error && <p className="auth-error">{error}</p>}
        {error && <TrackEvent event="neues_passwort_fehlgeschlagen" properties={{ grund: error }} />}

        <div className="auth-field">
          <label htmlFor="password" className="sr-only">Neues Passwort</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Neues Passwort"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password-wiederholung" className="sr-only">Passwort wiederholen</label>
          <input
            id="password-wiederholung"
            name="password-wiederholung"
            type="password"
            placeholder="Passwort wiederholen"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        <button formAction={updatePassword} type="submit">
          Passwort speichern
        </button>
      </form>
    </main>
  );
}
