"use client";

import { useEffect } from "react";
import { fehlerMelden } from "@/lib/analytics";
import { Zustand } from "@/components/zustand";

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
      <Zustand
        art="fehler"
        ebene={1}
        titel="Da ist etwas schiefgelaufen."
        detail={error.digest ? `Fehler-ID: ${error.digest}` : undefined}
        aktion={
          <button type="button" className="knopf haupt" onClick={() => retry()}>
            Erneut versuchen
          </button>
        }
      >
        Der Fehler wurde gemeldet. Versuch es noch einmal, meistens klappt es beim zweiten Mal.
      </Zustand>
    </main>
  );
}
