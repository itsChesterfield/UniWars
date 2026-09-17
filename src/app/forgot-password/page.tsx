import Link from "next/link";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <main className="auth-page">
      <form className="auth-form">
        <h1>Passwort vergessen</h1>

        {error && <p className="auth-error">{error}</p>}
        {sent && (
          <p className="auth-info">
            Falls ein Konto mit dieser E-Mail existiert, haben wir dir einen Link zum
            Zurücksetzen geschickt.
          </p>
        )}

        <label htmlFor="email">E-Mail</label>
        <input id="email" name="email" type="email" required autoComplete="email" />

        <button formAction={requestPasswordReset} type="submit">
          Link zum Zurücksetzen schicken
        </button>

        <p>
          <Link href="/login">Zurück zur Anmeldung</Link>
        </p>
      </form>
    </main>
  );
}
