import Link from "next/link";
import { Zustand } from "@/components/zustand";

/**
 * Design B3: Adressen, die es nicht gibt, und `notFound()` außerhalb der Bereiche.
 * Ohne Anmeldung leitet der Zentrale Hub zur Anmeldung weiter.
 */
export default function NichtGefunden() {
  return (
    <main className="auth-page">
      <Zustand
        art="leer"
        icon="suchen"
        ebene={1}
        titel="Diese Seite gibt es nicht."
        aktion={
          <Link href="/" className="knopf haupt">
            Zum Zentralen Hub
          </Link>
        }
      >
        Vielleicht ist der Link veraltet oder hat einen Tippfehler.
      </Zustand>
    </main>
  );
}
