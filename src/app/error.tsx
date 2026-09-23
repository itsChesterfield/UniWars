"use client";

import { useEffect } from "react";
import { fehlerMelden } from "@/lib/analytics";

export default function Fehler({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    fehlerMelden(error, { digest: error.digest, ort: "error_boundary" });
  }, [error]);

  return (
    <main className="auth-page">
      <div className="auth-form">
        <h1>Da ist etwas schiefgelaufen</h1>
        <p className="muted">
          Der Fehler wurde gemeldet. Versuch es noch einmal – meistens klappt es beim zweiten Mal.
        </p>
        {error.digest && (
          <p className="faint" style={{ fontSize: 12 }}>
            Fehler-ID: {error.digest}
          </p>
        )}
        <button type="button" onClick={() => retry()}>
          Erneut versuchen
        </button>
      </div>
    </main>
  );
}
