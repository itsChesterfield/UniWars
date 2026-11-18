"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { AssistentChat } from "@/components/assistent/assistent-chat";
import { aktuellerKontext } from "@/components/assistent/assistent-starter";
import { STUDIO_NAME } from "@/lib/ki/studio";

/** UniVerse Studio als ganze Seite: derselbe eine Chat wie in der Leiste (Strg+J), mittig mit 720 px. */
export function AssistentSeite() {
  const pfad = usePathname();
  const suche = useSearchParams();
  return (
    <div className="ki-seite">
      <header className="seitenkopf">
        <div>
          <h1>{STUDIO_NAME}</h1>
          <p>Ein Chat für die ganze App. Überall mit Strg+J als Leiste rechts erreichbar.</p>
        </div>
      </header>
      <div className="ki-seite-chat">
        <AssistentChat unterhaltungId={null} kontext={aktuellerKontext(pfad, suche.toString(), null)} />
      </div>
    </div>
  );
}
