"use client";

import { useEffect } from "react";
import { fehlerMelden } from "@/lib/analytics";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    fehlerMelden(error, { digest: error.digest, ort: "global_error_boundary" });
  }, [error]);

  return (
    <html lang="de">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 40, textAlign: "center" }}>
        <title>Fehler – UniWars</title>
        <h1>Da ist etwas schiefgelaufen</h1>
        <p>Der Fehler wurde gemeldet.</p>
        {error.digest && <p style={{ fontSize: 12, opacity: 0.6 }}>Fehler-ID: {error.digest}</p>}
        <button type="button" onClick={() => retry()}>
          Erneut versuchen
        </button>
      </body>
    </html>
  );
}
