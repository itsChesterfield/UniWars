/** KI-ALL-08: Fehlermeldung einer KI-Funktion (immer verständlicher Text, nie ein Stacktrace). */
export function KiFehlerMeldung({ meldung }: { meldung: string | null | undefined }) {
  if (!meldung) return null;
  return (
    <p className="auth-error" role="alert">
      {meldung}
    </p>
  );
}
