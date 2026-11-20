import Link from "next/link";
import { notFound } from "next/navigation";
import { HubKopf } from "@/components/hubs/hub-bausteine";
import { TeamUpdateListe } from "@/components/einstellungen/team-update-liste";
import { teamUpdatesLaden, teamUpdateZugriff } from "@/lib/team-updates-server";

export const metadata = { title: "Team-Updates · UniVerse" };

export default async function TeamUpdatesSeite({ searchParams }: { searchParams: Promise<{ vor?: string }> }) {
  const client = await teamUpdateZugriff();
  if (!client) notFound();
  const { vor } = await searchParams;
  const gueltig = typeof vor === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)\/[1-9]\d{0,9}$/.test(vor);
  const daten = await teamUpdatesLaden(client, false, gueltig ? vor : undefined).catch(() => null);
  return (
    <>
      <HubKopf titel="Team-Updates" untertitel="Veröffentlichte Änderungen an UniVerse." />
      {!daten && <p role="status">Der Verlauf ist gerade nicht erreichbar. Bitte lade die Seite erneut.</p>}
      {daten && (daten.updates.length ? <TeamUpdateListe updates={daten.updates} /> : <p>Hier stehen die veröffentlichten Team-Updates.</p>)}
      {vor && <Link href="/einstellungen/team-updates">Neueste Updates</Link>}
      {daten?.weiter && <Link href={`?vor=${encodeURIComponent(daten.weiter)}`}>Ältere Updates</Link>}
    </>
  );
}
