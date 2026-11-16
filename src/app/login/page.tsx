import Link from "next/link";
import { login } from "./actions";
import { TrackEvent } from "@/components/track-event";
import { AktivitaetZuruecksetzen } from "@/components/aktivitaet-zuruecksetzen";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string; grund?: string }>;
}) {
  const { error, reset, grund } = await searchParams;

  return (
    <main className="auth-page">
      <AktivitaetZuruecksetzen />
      <form className="auth-form">
        <h1>Anmelden</h1>

        {error && <p className="auth-error">{error}</p>}
        {error && <TrackEvent event="login_fehlgeschlagen" properties={{ grund: error }} />}
        {reset && <p className="auth-info">Passwort geändert — du kannst dich jetzt anmelden.</p>}
        {grund === "inaktiv" && <p className="auth-info">Du wurdest nach 5 Minuten ohne Aktivität abgemeldet – zum Schutz deiner Daten.</p>}
        {reset && <TrackEvent event="passwort_geaendert" />}

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
            placeholder="Passwort"
            required
            autoComplete="current-password"
          />
        </div>

        <button formAction={login} type="submit">
          Anmelden
        </button>

        <p>
          <Link href="/forgot-password">Passwort vergessen?</Link>
        </p>
        <p>
          Noch kein Konto? <Link href="/signup">Registrieren</Link>
        </p>
      </form>
    </main>
  );
}
