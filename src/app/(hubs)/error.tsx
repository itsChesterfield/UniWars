"use client";

import { useEffect, useState } from "react";
import { fehlerMelden } from "@/lib/analytics";

/**
 * Design B3, Zustand „Fehler“ (DESIGN.md Abschnitt 8): nur dieser Bereich ist betroffen,
 * Symbolleiste, Kopfleiste und alle anderen Bereiche bleiben benutzbar.
 */
export default function BereichFehler({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    fehlerMelden(error, { digest: error.digest, ort: "bereich_error_boundary" });
  }, [error]);

  return (
    <section className="zustand z-fehler" role="alert">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3.5 21.5 20h-19Z" />
        <path d="M12 10v4.5M12 17.2v.3" />
      </svg>
      <h2>Dieser Bereich hat gerade nicht geladen.</h2>
      <p>Deine Daten sind sicher. Alle anderen Bereiche funktionieren weiter, du kannst links jederzeit wechseln.</p>
      <button
        type="button"
        className="btnp"
        disabled={laeuft}
        aria-busy={laeuft}
        onClick={() => {
          setLaeuft(true);
          retry();
          // Klappt es nicht, erscheint der Fehler erneut; der Knopf wird dann wieder frei
          window.setTimeout(() => setLaeuft(false), 1500);
        }}
      >
        {laeuft ? "Wird geladen …" : "Erneut versuchen"}
      </button>
      {error.digest && <p className="zustand-detail">Fehler-ID: {error.digest}</p>}
    </section>
  );
}
