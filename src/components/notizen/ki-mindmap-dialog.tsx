"use client";

import { useState } from "react";
import Link from "next/link";
import { mindmapUebernehmen, mindmapVorschlagen } from "@/app/(hubs)/notizen/ki-actions";
import { KiDialog, KiVorstufe, useKiTextStatus } from "@/components/ki/ki-dialog";
import { KiFehlerMeldung } from "@/components/ki/ki-fehler-meldung";
import { KiLadeZustand } from "@/components/ki/ki-lade-zustand";
import { KiLimitHinweis } from "@/components/ki/ki-limit-hinweis";
import { knotenZaehlen, MAX_KNOTEN_TEXT, type EntwurfKnoten, type MindmapEntwurf } from "@/lib/ki/mindmap";
import { kiFehlerTracken, kiGestartet, kiVorschauAngezeigt, kiVorschauUebernommen } from "@/lib/ki/tracking";

/** Knoten mit Pfad (Indizes) ändern oder entfernen – unveränderlich. */
function aendern(liste: EntwurfKnoten[], pfad: number[], neu: EntwurfKnoten | null): EntwurfKnoten[] {
  const [i, ...rest] = pfad;
  if (rest.length === 0) return neu ? liste.map((k, j) => (j === i ? neu : k)) : liste.filter((_, j) => j !== i);
  return liste.map((k, j) => (j === i ? { ...k, kinder: aendern(k.kinder, rest, neu) } : k));
}

function Zweig({ knoten, pfad, onAendern }: { knoten: EntwurfKnoten[]; pfad: number[]; onAendern: (pfad: number[], neu: EntwurfKnoten | null) => void }) {
  return (
    <ul className="ki-baum">
      {knoten.map((k, i) => {
        const p = [...pfad, i];
        return (
          <li key={p.join("-")}>
            <div className="ki-baum-zeile">
              <input
                className="field"
                value={k.text}
                maxLength={MAX_KNOTEN_TEXT}
                aria-label={`Knoten ${p.map((x) => x + 1).join(".")}`}
                onChange={(e) => onAendern(p, { ...k, text: e.target.value })}
              />
              <button
                type="button"
                className="icon-knopf"
                aria-label={`Knoten ${k.text} entfernen`}
                title={k.kinder.length ? "Entfernen (mit Unterpunkten)" : "Entfernen"}
                onClick={() => onAendern(p, null)}
              >
                🗑
              </button>
            </div>
            {k.kinder.length > 0 && <Zweig knoten={k.kinder} pfad={p} onAendern={onAendern} />}
          </li>
        );
      })}
    </ul>
  );
}

/** KI-07: MindMap aus Notiz – Vorschau als eingerückte Liste, dann neue MindMap anlegen. */
export function KiMindmapDialog({
  notizId,
  fachId,
  vorher,
  onSchliessen,
}: {
  notizId: string;
  fachId: string | null;
  vorher: () => Promise<void>;
  onSchliessen: () => void;
}) {
  const ki = useKiTextStatus();
  const [schritt, setSchritt] = useState<"start" | "laeuft" | "vorschau" | "fertig">("start");
  const [fehler, setFehler] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<MindmapEntwurf | null>(null);
  const [original, setOriginal] = useState("");
  const [gekuerzt, setGekuerzt] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const [mindmapId, setMindmapId] = useState<string | null>(null);

  async function erstellen() {
    setFehler(null);
    setSchritt("laeuft");
    kiGestartet("ki07");
    const start = performance.now();
    await vorher().catch(() => undefined);
    const a = await mindmapVorschlagen(notizId).catch(() => null);
    if (!a?.ok) {
      const typ = a && !a.ok ? a.typ : "technisch";
      setFehler(a && !a.ok ? a.fehler : "Da ist etwas schiefgelaufen. Bitte versuch es noch einmal.");
      kiFehlerTracken("ki07", typ);
      if (typ === "limit") ki.limitErreicht();
      if (typ === "einwilligung") ki.einwilligungFehlt();
      setSchritt(entwurf ? "vorschau" : "start");
      return;
    }
    const neu = { wurzel: a.daten.wurzel, knoten: a.daten.knoten };
    setEntwurf(neu);
    setOriginal(JSON.stringify(neu));
    setGekuerzt(a.daten.gekuerzt);
    ki.verbraucht(a.daten.verbleibendHeute);
    kiVorschauAngezeigt("ki07", knotenZaehlen(neu.knoten), start);
    setSchritt("vorschau");
  }

  async function uebernehmen() {
    if (!entwurf) return;
    setFehler(null);
    setSpeichert(true);
    const a = await mindmapUebernehmen(entwurf, fachId).catch(() => null);
    setSpeichert(false);
    if (!a?.ok) {
      setFehler(a && !a.ok ? a.fehler : "Speichern hat nicht geklappt.");
      return;
    }
    kiVorschauUebernommen("ki07", knotenZaehlen(entwurf.knoten), JSON.stringify(entwurf) !== original ? 1 : 0);
    setMindmapId(a.daten.mindmapId);
    setSchritt("fertig");
  }

  const anzahl = entwurf ? knotenZaehlen(entwurf.knoten) : 0;

  return (
    <KiDialog titel="Als MindMap" gross={schritt === "vorschau"} schliessbar={schritt !== "laeuft" && !speichert} onSchliessen={onSchliessen}>
      {ki.phase !== "bereit" ? (
        <KiVorstufe ki={ki} ort="notizen" onSchliessen={onSchliessen} />
      ) : schritt === "laeuft" ? (
        <KiLadeZustand text="Die KI ordnet deine Notiz …" untertext="Das dauert meist ein paar Sekunden." />
      ) : schritt === "start" ? (
        <>
          <p>Die KI macht aus deiner Notiz eine MindMap mit Hauptthema und bis zu drei Ebenen. Du kannst sie vor dem Anlegen anpassen.</p>
          <KiFehlerMeldung meldung={fehler} />
          <div className="ki-fuss">
            <KiLimitHinweis verbleibend={ki.verbleibend} limit={ki.status?.limit ?? 0} />
            <button type="button" className="btnp" disabled={ki.verbleibend === 0} onClick={() => void erstellen()}>
              MindMap erstellen
            </button>
          </div>
        </>
      ) : schritt === "fertig" && mindmapId ? (
        <div className="ki-mitte">
          <div className="hub-leer-icon" aria-hidden>
            🎉
          </div>
          <p>Die MindMap wurde angelegt.</p>
          <div className="hub-formular-knoepfe">
            <button type="button" className="btng" onClick={onSchliessen}>
              Schließen
            </button>
            <Link href={`/mindmap/${mindmapId}`} className="btnp">
              MindMap öffnen
            </Link>
          </div>
        </div>
      ) : entwurf ? (
        <>
          <p className="ki-hinweis">⚠️ Prüf die Struktur, die KI kann sich irren. Die Anordnung auf der Fläche passt du später in der MindMap an.</p>
          {gekuerzt && <p className="ki-hinweis">✂️ Nur der Anfang der Notiz wurde verwendet.</p>}
          <label className="ki-feld">
            <span>Hauptthema</span>
            <input className="field" value={entwurf.wurzel} maxLength={MAX_KNOTEN_TEXT} onChange={(e) => setEntwurf({ ...entwurf, wurzel: e.target.value })} />
          </label>
          <Zweig knoten={entwurf.knoten} pfad={[]} onAendern={(p, neu) => setEntwurf({ ...entwurf, knoten: aendern(entwurf.knoten, p, neu) })} />
          <KiFehlerMeldung meldung={fehler} />
          <div className="ki-fuss">
            <button type="button" className="btng" disabled={speichert || ki.verbleibend === 0} onClick={() => void erstellen()} title={`Verbraucht eine weitere KI-Anfrage (heute noch ${ki.verbleibend})`}>
              ↻ Neu erstellen <span className="muted">({ki.verbleibend} übrig)</span>
            </button>
            <button type="button" className="btnp" disabled={speichert || anzahl === 0 || !entwurf.wurzel.trim()} onClick={() => void uebernehmen()}>
              {speichert ? "Speichert …" : `MindMap mit ${anzahl} ${anzahl === 1 ? "Knoten" : "Knoten"} anlegen`}
            </button>
          </div>
        </>
      ) : null}
    </KiDialog>
  );
}
