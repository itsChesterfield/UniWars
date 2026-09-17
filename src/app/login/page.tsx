import Link from "next/link";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const { error, reset } = await searchParams;

  return (
    <main className="auth-page">
      <form className="auth-form">
        <h1>Anmelden</h1>

        {error && <p className="auth-error">{error}</p>}
        {reset && <p className="auth-info">Passwort geändert — du kannst dich jetzt anmelden.</p>}

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
