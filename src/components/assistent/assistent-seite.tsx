"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { AssistentChat } from "@/components/assistent/assistent-chat";
import { aktuellerKontext } from "@/components/assistent/assistent-starter";
import { HubKopf } from "@/components/hubs/hub-bausteine";
import { STUDIO_NAME } from "@/lib/ki/studio";

/** UniVerse Studio als ganze Seite – derselbe eine Chat wie in der Leiste (Strg+J). */
export function AssistentSeite() {
  const pfad = usePathname();
  const suche = useSearchParams();
  return (
    <div className="ki-seite">
      <HubKopf titel={STUDIO_NAME} untertitel="Ein Chat für die ganze App – überall mit Strg+J (⌘J) als Leiste rechts erreichbar." />
      <div className="card ki-seite-chat studio-seite-chat">
        <AssistentChat unterhaltungId={null} kontext={aktuellerKontext(pfad, suche.toString(), null)} />
      </div>
    </div>
  );
}
