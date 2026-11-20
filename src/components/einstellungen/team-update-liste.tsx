import type { TeamUpdate } from "@/lib/team-updates-server";

const datum = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "Europe/Berlin" });

export function TeamUpdateListe({ updates }: { updates: TeamUpdate[] }) {
  return (
    <ol className="team-update-liste">
      {updates.map((update) => (
        <li key={update.pr}>
          <article>
            <h3>{update.titel}</h3>
            <p><time dateTime={update.aktualisiert_am}>{datum.format(new Date(update.aktualisiert_am))}</time>
              {" · "}<a href={`https://github.com/itsChesterfield/UniWars/pull/${update.pr}`}>PR #{update.pr}</a>
              {!update.aktiv && " · Zurückgerollt"}
            </p>
            <ul>
              {update.punkte.map((punkt, index) => (
                <li key={index}>{punkt.split(/\*\*([^*\n]+)\*\*/).map((teil, position) => (
                  position % 2 ? <strong key={position}>{teil}</strong> : teil
                ))}</li>
              ))}
            </ul>
          </article>
        </li>
      ))}
    </ol>
  );
}
