import Link from "next/link";
import { signup } from "./actions";

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
        {checkEmail && (
          <p className="auth-info">
            Fast geschafft — bitte bestätige deine E-Mail-Adresse über den Link, den wir dir
            geschickt haben.
          </p>
        )}

        <label htmlFor="username">Nutzername</label>
        <input id="username" name="username" type="text" required autoComplete="nickname" maxLength={40} />

        <label htmlFor="email">E-Mail</label>
        <input id="email" name="email" type="email" required autoComplete="email" />

        <label htmlFor="password">Passwort</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
        />

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
