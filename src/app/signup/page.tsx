import Link from "next/link";
import { signup } from "./actions";
import { TrackEvent } from "@/components/track-event";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; "check-email"?: string }>;
}) {
  const { error, "check-email": checkEmail } = await searchParams;

  return (
    <main className="auth-page">
      <form className="auth-form">
        <h1>Registrieren</h1>

        {error && <p className="auth-error">{error}</p>}
        {error && <TrackEvent event="registrierung_fehlgeschlagen" properties={{ grund: error }} />}
        {checkEmail && <TrackEvent event="registrierung_abgeschickt" properties={{ email_bestaetigung: true }} />}
        {checkEmail && (
          <p className="auth-info">
            Fast geschafft — bitte bestätige deine E-Mail-Adresse über den Link, den wir dir
            geschickt haben.
          </p>
        )}

        <div className="auth-field">
          <label htmlFor="username" className="sr-only">Nutzername</label>
          <input
            id="username"
            name="username"
            type="text"
            placeholder="Nutzername (3–20 Zeichen, a–z, 0–9, _)"
            required
            autoComplete="nickname"
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_]{3,20}"
            title="3–20 Zeichen: Buchstaben, Zahlen und Unterstriche"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="email" className="sr-only">E-Mail</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="E-Mail"
            required
            autoComplete="email"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password" className="sr-only">Passwort</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Passwort (mind. 6 Zeichen)"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        <button formAction={signup} type="submit">
          Konto erstellen
        </button>

        <p>
          Schon registriert? <Link href="/login">Anmelden</Link>
        </p>
      </form>
    </main>
  );
}
