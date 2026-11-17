import Link from "next/link";
import { login } from "./actions";
import { TrackEvent } from "@/components/track-event";
import { AktivitaetZuruecksetzen } from "@/components/aktivitaet-zuruecksetzen";
import { LoginFelder } from "@/components/login-felder";

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

        <LoginFelder />

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
