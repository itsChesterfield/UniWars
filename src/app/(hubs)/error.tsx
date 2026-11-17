"use client";

import { useEffect, useState } from "react";
import { fehlerMelden } from "@/lib/analytics";
import { Zustand } from "@/components/zustand";

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
    <Zustand
      art="fehler"
      titel="Dieser Bereich hat gerade nicht geladen."
      detail={error.digest ? `Fehler-ID: ${error.digest}` : undefined}
      aktion={
        <button
          type="button"
          className="knopf haupt"
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
      }
    >
      Deine Daten sind sicher. Alle anderen Bereiche funktionieren weiter, du kannst links jederzeit wechseln.
    </Zustand>
  );
}
