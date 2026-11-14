"use client";

import { useEffect, useRef, useState } from "react";
import { tagesKarteAusblenden, tagesKarteUebernehmen, tagesvorschlaege, type TagesStand } from "@/app/(hubs)/assistent/lernplan-actions";
import { AktionskarteAnzeige, type KartenAktionen } from "@/components/assistent/aktionskarte";
import { KiEinwilligungDialog } from "@/components/ki/ki-einwilligung-dialog";
import { kiFehlerTracken, kiGestartet, kiVorschauAngezeigt } from "@/lib/ki/tracking";
import type { KiFehlerTyp } from "@/lib/ki/fehler";
import type { Aktionskarte } from "@/lib/ki/assistent";

type Fach = { id: string; name: string };
type Anzeige = TagesStand | { status: "laedt" } | { status: "fehler"; fehler: string; typ?: KiFehlerTyp };

const AKTIONEN: KartenAktionen = {
  uebernehmen: tagesKarteUebernehmen,
  verwerfen: tagesKarteAusblenden,
  verwerfenText: "Ausblenden",
  funktion: "ki05",
};
const WARTEN_MS = 3000;
const MAX_WARTEN = 40;

/**
 * KI-05: „✨ Vorschläge für heute“ auf dem Dashboard. Beim ersten Öffnen am Tag erzeugt
 * (eine Text-Anfrage), danach gespeichert. Gespeichert wird erst nach Klick (KI-ALL-01).
 */
export function Tagesvorschlaege({ faecher }: { faecher: Fach[] }) {
  const [stand, setStand] = useState<Anzeige>({ status: "laedt" });
  const [einwilligung, setEinwilligung] = useState(false);
  const [erneut, setErneut] = useState(false);
  const versuche = useRef(0);
  const timer = useRef<number | null>(null);

  const ladenRef = useRef<(modus: "laden" | "neu") => Promise<void>>(async () => undefined);

  async function laden(modus: "laden" | "neu") {
    if (timer.current) window.clearTimeout(timer.current);
    const start = performance.now();
    const a = await tagesvorschlaege(modus).catch(() => null);
    if (!a?.ok) {
      const typ = (a && !a.ok ? a.typ : "technisch") as KiFehlerTyp;
      setStand({ status: "fehler", fehler: a && !a.ok ? a.fehler : "Keine Verbindung. Bitte versuch es später noch einmal.", typ });
      kiFehlerTracken("ki05", typ);
      return;
    }
    const d = a.daten;
    if (d.status === "laeuft") {
      // Ein anderer Tab erzeugt gerade – kurz warten und nachsehen
      setStand(d);
      if (versuche.current++ < MAX_WARTEN) timer.current = window.setTimeout(() => void ladenRef.current("laden"), WARTEN_MS);
      return;
    }
    versuche.current = 0;
    setStand(d);
    if (d.status === "fertig" && d.neuErzeugt) kiVorschauAngezeigt("ki05", d.vorschlaege.length, Math.round(performance.now() - start));
  }
  useEffect(() => {
    ladenRef.current = laden;
  });

  useEffect(() => {
    const id = window.setTimeout(() => void ladenRef.current("laden"), 0);
    return () => {
      window.clearTimeout(id);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  async function neuErstellen() {
    setErneut(true);
    kiGestartet("ki05");
    setStand({ status: "laeuft" });
    await laden("neu");
    setErneut(false);
  }

  function karteGeaendert(k: Aktionskarte) {
    setStand((s) => (s.status === "fertig" ? { ...s, vorschlaege: s.vorschlaege.map((v) => (v.karte.id === k.id ? { ...v, karte: k } : v)) } : s));
  }

  if (stand.status === "aus" && stand.grund === "konfiguration") return null;

  const sichtbare = stand.status === "fertig" ? stand.vorschlaege.filter((v) => v.karte.status !== "verworfen") : [];

  return (
    <section className="card span-12 ki-tagesvorschlaege" aria-labelledby="ki-tagesvorschlaege-titel" aria-busy={stand.status === "laedt" || stand.status === "laeuft"}>
      <div className="ch">
        <span className="ct" id="ki-tagesvorschlaege-titel">
          ✨ Vorschläge für heute
        </span>
        {stand.status === "fertig" && stand.neuMoeglich && (
          <button type="button" className="link-knopf" disabled={erneut} onClick={() => void neuErstellen()} title="Einmal pro Tag möglich · zählt als 1 KI-Anfrage">
            Neu erstellen
          </button>
        )}
      </div>

      {(stand.status === "laedt" || stand.status === "laeuft") && (
        <p className="muted ki-tagesvorschlaege-hinweis" role="status">
          Ich schaue mir deinen Tag an …
        </p>
      )}

      {stand.status === "aus" && (
        <div className="ki-tagesvorschlaege-leer">
          <p>Auf Wunsch schlage ich dir jeden Tag bis zu 3 nächste Schritte vor – aus deinen Prüfungen, Deadlines, Karteikarten und deiner Lernzeit. Das zählt als eine KI-Anfrage pro Tag.</p>
          <button type="button" className="btng" onClick={() => setEinwilligung(true)}>
            ✨ KI-Funktionen einschalten
          </button>
        </div>
      )}

      {stand.status === "leer" && (
        <div className="ki-tagesvorschlaege-leer">
          <p>Leg deine Fächer und Prüfungen an, dann kann ich dir Vorschläge machen.</p>
          <a href="#faecher" className="link-knopf">
            Zu den Fächern
          </a>
        </div>
      )}

      {stand.status === "fehler" && (
        <div className="ki-tagesvorschlaege-leer">
          <p className="auth-error">{stand.fehler}</p>
          {"typ" in stand && stand.typ === "limit" ? null : (
            <button type="button" className="btng" disabled={erneut} onClick={() => void neuErstellen()}>
              Nochmal versuchen
            </button>
          )}
        </div>
      )}

      {stand.status === "fertig" &&
        (sichtbare.length === 0 ? (
          <p className="muted ki-tagesvorschlaege-hinweis">
            {stand.vorschlaege.length === 0 ? "Heute steht nichts Dringendes an. Schöner Tag! 🎉" : "Alles erledigt oder ausgeblendet für heute."}
          </p>
        ) : (
          <ul className="ki-tagesvorschlaege-liste">
            {sichtbare.map((v) => (
              <li key={v.karte.id}>
                {v.grund && <p className="ki-tagesvorschlag-grund">{v.grund}</p>}
                <AktionskarteAnzeige karte={v.karte} faecher={faecher} aktionen={AKTIONEN} onGeaendert={karteGeaendert} />
              </li>
            ))}
          </ul>
        ))}

      {stand.status === "fertig" && sichtbare.length > 0 && <p className="muted ki-tagesvorschlaege-fuss">✨ KI-Vorschläge – erst dein Klick legt etwas an.</p>}

      {einwilligung && (
        <KiEinwilligungDialog
          onSchliessen={() => setEinwilligung(false)}
          onZugestimmt={() => {
            setEinwilligung(false);
            setStand({ status: "laeuft" });
            kiGestartet("ki05");
            void laden("laden");
          }}
        />
      )}
    </section>
  );
}
