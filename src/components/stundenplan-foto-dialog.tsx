"use client";

import { useRef, useState } from "react";
import { stundenplanFotoLesen, stundenplanFotoUebernehmen, type FotoVorschlag } from "@/app/stundenplan/ki-actions";
import { KiDialog, KiFehlerMeldung, KiVorstufe, useKiTextStatus } from "@/components/ki/ki-dialog";
import { KiLadeZustand } from "@/components/ki/ki-lade-zustand";
import { KiLimitHinweis } from "@/components/ki/ki-limit-hinweis";
import type { FachOption } from "@/lib/fach-option";
import type { Tables } from "@/lib/supabase/types";
import { fehlerMelden, track } from "@/lib/analytics";

const TAGE = [
  ["MO", "Mo"],
  ["DI", "Di"],
  ["MI", "Mi"],
  ["DO", "Do"],
  ["FR", "Fr"],
  ["SA", "Sa"],
  ["SO", "So"],
] as const;

/** Wert im Fach-Auswahlfeld: vorhandenes Fach ("f:<id>"), neu anlegen ("neu") oder weglassen ("weg"). */
type Zeile = FotoVorschlag & { schluessel: number; wahl: string; neuerName: string };

/** Foto im Browser verkleinern (lange Seite max. 2000 px, JPEG) – spart Upload und KI-Kosten. */
async function bildVerkleinern(datei: File): Promise<string> {
  const bitmap = await createImageBitmap(datei);
  const faktor = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * faktor);
  canvas.height = Math.round(bitmap.height * faktor);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

/**
 * Stundenplan per Foto: Bild wählen → KI liest ab → Vorschau prüfen/korrigieren → eintragen.
 * Unbekannte Fächer werden auf Wunsch neu angelegt.
 */
export function StundenplanFotoDialog({
  faecher,
  vorhandene = 0,
  onSchliessen,
  onUebernommen,
}: {
  faecher: FachOption[];
  /** Anzahl der Einträge, die schon im Stundenplan stehen */
  vorhandene?: number;
  onSchliessen: () => void;
  onUebernommen: (eintraege: Tables<"stundenplan_eintrag">[], ersetzt: boolean) => void;
}) {
  const ki = useKiTextStatus();
  const eingabe = useRef<HTMLInputElement>(null);
  const [schritt, setSchritt] = useState<"start" | "laeuft" | "vorschau" | "speichert">("start");
  const [fehler, setFehler] = useState<string | null>(null);
  const [vorschau, setVorschau] = useState<string | null>(null);
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  // Ein neues Foto ist meist der ganze Plan: Standard ist, den alten zu ersetzen
  const [ersetzen, setErsetzen] = useState(vorhandene > 0);

  async function lesen(datei: File) {
    setFehler(null);
    if (!datei.type.startsWith("image/")) {
      setFehler("Bitte ein Bild auswählen (Foto oder Screenshot).");
      return;
    }
    setSchritt("laeuft");
    let bild: string;
    try {
      bild = await bildVerkleinern(datei);
    } catch (err) {
      fehlerMelden(err, { ort: "stundenplan_foto_bild" });
      setFehler("Das Bild konnte nicht gelesen werden. Versuch ein JPG oder PNG.");
      setSchritt("start");
      return;
    }
    setVorschau(bild);
    track("ki_gestartet", { funktion: "stundenplan_foto" });
    const a = await stundenplanFotoLesen(bild).catch(() => null);
    if (!a?.ok) {
      setFehler(a && !a.ok ? a.fehler : "Da ist etwas schiefgelaufen. Bitte versuch es noch einmal.");
      if (a && !a.ok && a.typ === "limit") ki.limitErreicht();
      if (a && !a.ok && a.typ === "einwilligung") ki.einwilligungFehlt();
      setSchritt("start");
      return;
    }
    setZeilen(
      a.daten.eintraege.map((e, i) => ({
        ...e,
        schluessel: i,
        wahl: e.fachId ? `f:${e.fachId}` : "neu",
        neuerName: e.fach,
      })),
    );
    track("stundenplan_foto_gelesen", { eintraege: a.daten.eintraege.length, zugeordnet: a.daten.eintraege.filter((e) => e.fachId).length });
    setSchritt("vorschau");
  }

  function aendern(schluessel: number, teil: Partial<Zeile>) {
    setZeilen((l) => l.map((z) => (z.schluessel === schluessel ? { ...z, ...teil } : z)));
  }

  async function uebernehmen() {
    const auswahl = zeilen.filter((z) => z.wahl !== "weg");
    if (!auswahl.length) return;
    setFehler(null);
    setSchritt("speichert");
    try {
      const ergebnis = await stundenplanFotoUebernehmen(
        auswahl.map((z) => ({
          fachId: z.wahl.startsWith("f:") ? z.wahl.slice(2) : null,
          neuesFach: z.wahl === "neu" ? z.neuerName : null,
          tag: z.tag,
          start: z.start,
          ende: z.ende,
          raum: z.raum,
          dozent: z.dozent,
        })),
        ersetzen && vorhandene > 0,
      );
      track("stundenplan_foto_uebernommen", { eintraege: ergebnis.angelegt, neue_faecher: ergebnis.neueFaecher });
      onUebernommen(ergebnis.eintraege, ersetzen && vorhandene > 0);
    } catch (err) {
      fehlerMelden(err, { ort: "stundenplan_foto_uebernehmen" });
      setFehler("Speichern hat nicht geklappt. Bitte versuch es noch einmal.");
      setSchritt("vorschau");
    }
  }

  const anzahl = zeilen.filter((z) => z.wahl !== "weg").length;
  const neue = new Set(zeilen.filter((z) => z.wahl === "neu" && z.neuerName.trim()).map((z) => z.neuerName.trim().toLowerCase())).size;

  return (
    <KiDialog
      titel="Stundenplan aus Foto"
      gross={schritt === "vorschau" || schritt === "speichert"}
      schliessbar={schritt !== "laeuft" && schritt !== "speichert"}
      onSchliessen={onSchliessen}
    >
      {ki.phase !== "bereit" ? (
        <KiVorstufe ki={ki} ort="stundenplan" onSchliessen={onSchliessen} />
      ) : schritt === "laeuft" ? (
        <KiLadeZustand text="Die KI liest deinen Stundenplan …" untertext="Das dauert meist 10–20 Sekunden." />
      ) : schritt === "start" ? (
        <>
          <p>
            Mach ein Foto oder einen Screenshot von deinem Stundenplan (z. B. aus dem Uni-Portal). Die KI liest Fächer, Tage, Uhrzeiten und Räume ab –
            du prüfst alles, bevor es eingetragen wird.
          </p>
          <input
            ref={eingabe}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const datei = e.target.files?.[0];
              e.target.value = "";
              if (datei) void lesen(datei);
            }}
          />
          {vorhandene > 0 && (
            <label className="sp-foto-ersetzen">
              <input type="checkbox" checked={ersetzen} onChange={(e) => setErsetzen(e.target.checked)} />
              Bisherigen Stundenplan ersetzen ({vorhandene} {vorhandene === 1 ? "Eintrag wird" : "Einträge werden"} entfernt)
            </label>
          )}
          <KiFehlerMeldung meldung={fehler} />
          <div className="ki-fuss">
            <KiLimitHinweis verbleibend={ki.verbleibend} limit={ki.status?.limit ?? 0} />
            <button type="button" className="btnp" disabled={ki.verbleibend === 0} onClick={() => eingabe.current?.click()}>
              📷 Foto auswählen
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="ki-hinweis">⚠️ Prüf die Einträge – die KI kann sich verlesen. Zeilen mit „Weglassen“ werden nicht eingetragen.</p>
          <div className="sp-foto-raster">
            {vorschau && (
              // eslint-disable-next-line @next/next/no-img-element -- lokale Vorschau (Data-URL)
              <img src={vorschau} alt="Dein Stundenplan-Foto" className="sp-foto-bild" />
            )}
            <div className="sp-foto-tabelle-wrap">
              <table className="sp-foto-tabelle">
                <thead>
                  <tr>
                    <th>Fach</th>
                    <th>Tag</th>
                    <th>Von</th>
                    <th>Bis</th>
                    <th>Raum</th>
                  </tr>
                </thead>
                <tbody>
                  {zeilen.map((z) => (
                    <tr key={z.schluessel} className={z.wahl === "weg" ? "weg" : ""}>
                      <td>
                        <select className="field" value={z.wahl} aria-label="Fach" onChange={(e) => aendern(z.schluessel, { wahl: e.target.value })}>
                          <option value="neu">＋ Neues Fach anlegen</option>
                          {faecher.map((f) => (
                            <option key={f.id} value={`f:${f.id}`}>
                              {f.name}
                            </option>
                          ))}
                          <option value="weg">✕ Weglassen</option>
                        </select>
                        {z.wahl === "neu" && (
                          <input
                            className="field"
                            value={z.neuerName}
                            aria-label="Name des neuen Fachs"
                            maxLength={120}
                            onChange={(e) => aendern(z.schluessel, { neuerName: e.target.value })}
                          />
                        )}
                      </td>
                      <td>
                        <select className="field" value={z.tag} aria-label="Tag" onChange={(e) => aendern(z.schluessel, { tag: e.target.value as Zeile["tag"] })}>
                          {TAGE.map(([wert, label]) => (
                            <option key={wert} value={wert}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input className="field" type="time" value={z.start} aria-label="Beginn" onChange={(e) => aendern(z.schluessel, { start: e.target.value })} />
                      </td>
                      <td>
                        <input className="field" type="time" value={z.ende} aria-label="Ende" onChange={(e) => aendern(z.schluessel, { ende: e.target.value })} />
                      </td>
                      <td>
                        <input className="field" value={z.raum ?? ""} aria-label="Raum" maxLength={100} onChange={(e) => aendern(z.schluessel, { raum: e.target.value || null })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {vorhandene > 0 && (
            <label className="sp-foto-ersetzen">
              <input type="checkbox" checked={ersetzen} onChange={(e) => setErsetzen(e.target.checked)} />
              Bisherigen Stundenplan ersetzen ({vorhandene} {vorhandene === 1 ? "Eintrag wird" : "Einträge werden"} entfernt)
            </label>
          )}
          <KiFehlerMeldung meldung={fehler} />
          <div className="ki-fuss">
            <button type="button" className="btng" disabled={schritt === "speichert"} onClick={() => setSchritt("start")}>
              Anderes Foto
            </button>
            <button type="button" className="btnp" disabled={schritt === "speichert" || anzahl === 0} onClick={() => void uebernehmen()}>
              {schritt === "speichert" ? "Trägt ein …" : `${anzahl} ${anzahl === 1 ? "Termin" : "Termine"} eintragen${neue ? ` (+${neue} ${neue === 1 ? "Fach" : "Fächer"})` : ""}`}
            </button>
          </div>
        </>
      )}
    </KiDialog>
  );
}
