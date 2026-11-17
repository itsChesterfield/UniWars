"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zustand } from "@/components/zustand";
import { ZENTRALER_HUB, hubAusPfad } from "@/lib/hubs/navigation";

/**
 * Design B3, Zustand „Leer“ für Inhalte, die es nicht (mehr) gibt: `notFound()` in einem Bereich,
 * z. B. eine gelöschte Notiz. Rahmen und Symbolleiste bleiben stehen, der Weg führt zurück in den Bereich.
 */
export default function NichtGefunden() {
  const pfad = usePathname();
  const { hub } = hubAusPfad(pfad);
  const ziel = hub && hub.href !== pfad ? hub : ZENTRALER_HUB;

  return (
    <Zustand
      art="leer"
      icon="suchen"
      ebene={1}
      titel="Das gibt es hier nicht mehr."
      aktion={
        <Link href={ziel.href} className="knopf haupt">
          {ziel === ZENTRALER_HUB ? "Zum Zentralen Hub" : `Zurück zu ${ziel.name}`}
        </Link>
      }
    >
      Vielleicht wurde es gelöscht oder der Link ist veraltet. Deine übrigen Inhalte sind nicht betroffen.
    </Zustand>
  );
}
