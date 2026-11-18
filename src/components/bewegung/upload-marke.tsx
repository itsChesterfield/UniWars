import { Icon } from "@/components/nav-icon";
import type { IconName } from "@/lib/icons";

/**
 * Hochladen (Prototyp Bewegung): Die Lichtspur läuft mit dem Fortschritt um das Dateisymbol
 * und schließt sich zum Haken. Gemeinsam für Dateiablage und PDF Reader.
 */
export function UploadMarke({ anteil, fertig, fehler, icon = "pdf" }: { anteil: number; fertig: boolean; fehler: boolean; icon?: IconName }) {
  return (
    <span className={`upload-marke${fertig ? " fertig" : ""}${fehler ? " fehler" : ""}`} aria-hidden>
      <svg viewBox="-12 -12 24 24">
        <circle className="upload-bahn" r="10" />
        {!fehler && <circle className="upload-spur" r="10" pathLength={100} strokeDasharray={`${Math.round(anteil * 100)} 100`} transform="rotate(-90)" />}
        {fertig && <path className="upload-haken" d="M-4.5 0.5 L-1.4 3.6 L4.8 -3.4" pathLength={1} />}
      </svg>
      {!fertig && <Icon name={fehler ? "hochladen" : icon} groesse={12} />}
    </span>
  );
}
