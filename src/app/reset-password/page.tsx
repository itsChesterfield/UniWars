import { updatePassword } from "./actions";

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

        <div className="auth-field">
          <label htmlFor="password">Neues Passwort</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password-wiederholung">Wiederholen</label>
          <input
            id="password-wiederholung"
            name="password-wiederholung"
            type="password"
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
