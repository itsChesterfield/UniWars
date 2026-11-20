import { EinstellungenKontext } from "./einstellungen-kontext";
import { TeamUpdateDialog } from "./team-update-dialog";
import { teamUpdateZugriff } from "@/lib/team-updates-server";

export async function TeamUpdateEinstieg() {
  return await teamUpdateZugriff() ? <TeamUpdateDialog /> : null;
}

export async function EinstellungenKontextMitTeam({ mobil, kiVerfuegbar }: { mobil?: boolean; kiVerfuegbar: boolean }) {
  const team = Boolean(await teamUpdateZugriff());
  return <EinstellungenKontext mobil={mobil} kiVerfuegbar={kiVerfuegbar} team={team} />;
}
