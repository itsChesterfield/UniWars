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
      <section className="zustand z-fehler" role="alert">
        <h1>Da ist etwas schiefgelaufen.</h1>
        <p>Der Fehler wurde gemeldet. Versuch es noch einmal, meistens klappt es beim zweiten Mal.</p>
        <button type="button" className="btnp" onClick={() => retry()}>
          Erneut versuchen
        </button>
        {error.digest && <p className="zustand-detail">Fehler-ID: {error.digest}</p>}
      </section>
    </main>
  );
}
