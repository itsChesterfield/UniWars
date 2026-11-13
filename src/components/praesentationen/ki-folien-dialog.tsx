"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { folienVorschlagen, kiFolienQuellen, praesentationAusEntwurf, type QuellenAuswahl } from "@/app/(hubs)/praesentationen/ki-actions";
import { KiDialog, KiVorstufe, useKiTextStatus } from "@/components/ki/ki-dialog";
import { KiFehlerMeldung } from "@/components/ki/ki-fehler-meldung";
import { KiLadeZustand } from "@/components/ki/ki-lade-zustand";
import { KiLimitHinweis } from "@/components/ki/ki-limit-hinweis";
import { ERLAUBTE_FOLIENZAHL, MAX_PUNKTE_JE_FOLIE, MIN_FOLIEN_ZEICHEN, type EntwurfFolie, type FolienEntwurf, type FolienLayout, type Folienzahl } from "@/lib/ki/folien";
import { kiFehlerTracken, kiGestartet, kiVorschauAngezeigt, kiVorschauUebernommen } from "@/lib/ki/tracking";

const LAYOUT_NAMEN: Record<FolienLayout, string> = { TITEL: "Titel", TEXT: "Titel & Text", BILD: "Titel & Bild", ZWEISPALTIG: "Zweispaltig" };
const zeilen = (t: string) =>
  t
    .split("\n")
    .map((z) => z.replace(/^\s*[-•*]\s?/, "").trim())
    .filter(Boolean)
    .slice(0, MAX_PUNKTE_JE_FOLIE);

/** KI-08: Folien-Gliederung aus Notiz oder Dokument → Vorschau → neue Präsentation. */
export function KiFolienDialog({ onSchliessen }: { onSchliessen: () => void }) {
  const router = useRouter();
  const ki = useKiTextStatus();
  const [quellen, setQuellen] = useState<QuellenAuswahl[] | null>(null);
  const [auswahl, setAuswahl] = useState("");
  const [anzahl, setAnzahl] = useState<Folienzahl>(8);
  const [schritt, setSchritt] = useState<"start" | "laeuft" | "vorschau">("start");
  const [fehler, setFehler] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<FolienEntwurf | null>(null);
  const [original, setOriginal] = useState("");
  const [fachId, setFachId] = useState<string | null>(null);
  const [gekuerzt, setGekuerzt] = useState(false);
  const [speichert, setSpeichert] = useState(false);

  useEffect(() => {
    if (ki.phase !== "bereit" || quellen) return;
    kiFolienQuellen()
      .catch(() => null)
      .then((a) => {
        const liste = a?.ok ? a.daten : [];
        setQuellen(liste);
        const erste = liste.find((q) => q.zeichen >= MIN_FOLIEN_ZEICHEN);
        if (erste) setAuswahl(`${erste.art}:${erste.id}`);
      });
  }, [ki.phase, quellen]);

  const gewaehlt = quellen?.find((q) => `${q.art}:${q.id}` === auswahl) ?? null;

  async function erstellen() {
    if (!gewaehlt) return;
    setFehler(null);
    setSchritt("laeuft");
    kiGestartet("ki08");
    const start = performance.now();
    const a = await folienVorschlagen({ art: gewaehlt.art, id: gewaehlt.id }, anzahl).catch(() => null);
    if (!a?.ok) {
      const typ = a && !a.ok ? a.typ : "technisch";
      setFehler(a && !a.ok ? a.fehler : "Da ist etwas schiefgelaufen. Bitte versuch es noch einmal.");
      kiFehlerTracken("ki08", typ);
      if (typ === "limit") ki.limitErreicht();
      if (typ === "einwilligung") ki.einwilligungFehlt();
      setSchritt(entwurf ? "vorschau" : "start");
      return;
    }
    const neu = { titel: a.daten.titel, folien: a.daten.folien };
    setEntwurf(neu);
    setOriginal(JSON.stringify(neu));
    setFachId(a.daten.fachId);
    setGekuerzt(a.daten.gekuerzt);
    ki.verbraucht(a.daten.verbleibendHeute);
    kiVorschauAngezeigt("ki08", neu.folien.length, start);
    setSchritt("vorschau");
  }

  function folieAendern(i: number, teil: Partial<EntwurfFolie> | null) {
    if (!entwurf) return;
    setEntwurf({
      ...entwurf,
      folien: teil === null ? entwurf.folien.filter((_, j) => j !== i) : entwurf.folien.map((f, j) => (j === i ? { ...f, ...teil } : f)),
    });
  }

  async function uebernehmen() {
    if (!entwurf) return;
    setFehler(null);
    setSpeichert(true);
    const a = await praesentationAusEntwurf(entwurf, fachId).catch(() => null);
    if (!a?.ok) {
      setSpeichert(false);
      setFehler(a && !a.ok ? a.fehler : "Speichern hat nicht geklappt.");
      return;
    }
    kiVorschauUebernommen("ki08", entwurf.folien.length, JSON.stringify(entwurf) !== original ? 1 : 0);
    router.push(`/praesentationen/${a.daten.id}`);
  }

  return (
    <KiDialog titel="Präsentation aus Notiz oder Dokument" gross={schritt === "vorschau"} schliessbar={schritt !== "laeuft" && !speichert} onSchliessen={onSchliessen}>
      {ki.phase !== "bereit" ? (
        <KiVorstufe ki={ki} ort="praesentationen" onSchliessen={onSchliessen} />
      ) : schritt === "laeuft" ? (
        <KiLadeZustand text="Die KI gliedert deinen Text in Folien …" untertext="Das dauert meist ein paar Sekunden." />
      ) : schritt === "start" ? (
        <form
          className="ki-einstellungen"
          onSubmit={(e) => {
            e.preventDefault();
            void erstellen();
          }}
        >
          {quellen === null ? (
            <KiLadeZustand text="Lädt deine Notizen und Dokumente …" />
          ) : quellen.length === 0 ? (
            <p className="muted">Du hast noch keine Notizen oder Dokumente. Leg zuerst eine Notiz an.</p>
          ) : (
            <label className="ki-feld">
              <span>Grundlage</span>
              <select className="field" value={auswahl} onChange={(e) => setAuswahl(e.target.value)}>
                <option value="">Bitte wählen …</option>
                {(["notiz", "dokument"] as const).map((art) => (
                  <optgroup key={art} label={art === "notiz" ? "Notizen" : "Dokumente"}>
                    {quellen
                      .filter((q) => q.art === art)
                      .map((q) => (
                        <option key={q.id} value={`${q.art}:${q.id}`} disabled={q.zeichen < MIN_FOLIEN_ZEICHEN}>
                          {q.titel}
                          {q.zeichen < MIN_FOLIEN_ZEICHEN ? " (zu kurz)" : ""}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
          )}
          <div className="ki-feld">
            <span id="ki-folien-anzahl">Anzahl Folien</span>
            <div className="segwrap" role="radiogroup" aria-labelledby="ki-folien-anzahl">
              {ERLAUBTE_FOLIENZAHL.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={anzahl === n} className={`seg ${anzahl === n ? "on" : ""}`} onClick={() => setAnzahl(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <KiFehlerMeldung meldung={fehler} />
          <div className="ki-fuss">
            <KiLimitHinweis verbleibend={ki.verbleibend} limit={ki.status?.limit ?? 0} />
            <button type="submit" className="btnp" disabled={!gewaehlt || gewaehlt.zeichen < MIN_FOLIEN_ZEICHEN || ki.verbleibend === 0}>
              Gliederung erstellen
            </button>
          </div>
        </form>
      ) : entwurf ? (
        <>
          <p className="ki-hinweis">⚠️ Prüf die Folien, die KI kann sich irren. Bilder fügst du danach im Editor ein.</p>
          {gekuerzt && <p className="ki-hinweis">✂️ Nur der Anfang des Textes wurde verwendet.</p>}
          <label className="ki-feld">
            <span>Titel der Präsentation</span>
            <input className="field" value={entwurf.titel} maxLength={150} onChange={(e) => setEntwurf({ ...entwurf, titel: e.target.value })} />
          </label>
          <ol className="ki-folien">
            {entwurf.folien.map((f, i) => (
              <li key={i}>
                <div className="ki-folie-kopf">
                  <span className="mono">{i + 1}</span>
                  {i === 0 ? (
                    <span className="tag">Titel</span>
                  ) : (
                    <select className="field" aria-label={`Layout Folie ${i + 1}`} value={f.layout} onChange={(e) => folieAendern(i, { layout: e.target.value as FolienLayout })}>
                      {(Object.keys(LAYOUT_NAMEN) as FolienLayout[])
                        .filter((l) => l !== "TITEL")
                        .map((l) => (
                          <option key={l} value={l}>
                            {LAYOUT_NAMEN[l]}
                          </option>
                        ))}
                    </select>
                  )}
                  <input className="field" aria-label={`Titel Folie ${i + 1}`} value={f.titel} maxLength={150} onChange={(e) => folieAendern(i, { titel: e.target.value })} />
                  {i > 0 && (
                    <button type="button" className="icon-knopf" aria-label={`Folie ${i + 1} entfernen`} onClick={() => folieAendern(i, null)}>
                      🗑
                    </button>
                  )}
                </div>
                {f.layout === "TITEL" && (
                  <input className="field" placeholder="Untertitel" value={f.untertitel} maxLength={200} onChange={(e) => folieAendern(i, { untertitel: e.target.value })} />
                )}
                {f.layout === "BILD" && <p className="muted ki-folie-bild">🖼️ Bild einfügen – das machst du danach im Editor.</p>}
                {(f.layout === "TEXT" || f.layout === "ZWEISPALTIG") && (
                  <div className={f.layout === "ZWEISPALTIG" ? "ki-folie-spalten" : ""}>
                    <textarea
                      className="field"
                      rows={Math.max(2, f.punkte.length)}
                      aria-label={`Stichpunkte Folie ${i + 1}`}
                      placeholder="Ein Stichpunkt pro Zeile"
                      defaultValue={f.punkte.join("\n")}
                      onBlur={(e) => folieAendern(i, { punkte: zeilen(e.target.value) })}
                    />
                    {f.layout === "ZWEISPALTIG" && (
                      <textarea
                        className="field"
                        rows={Math.max(2, f.punkteRechts.length)}
                        aria-label={`Rechte Spalte Folie ${i + 1}`}
                        placeholder="Rechte Spalte"
                        defaultValue={f.punkteRechts.join("\n")}
                        onBlur={(e) => folieAendern(i, { punkteRechts: zeilen(e.target.value) })}
                      />
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
          <KiFehlerMeldung meldung={fehler} />
          <div className="ki-fuss">
            <button type="button" className="btng" disabled={speichert || ki.verbleibend === 0} onClick={() => void erstellen()} title={`Verbraucht eine weitere KI-Anfrage (heute noch ${ki.verbleibend})`}>
              ↻ Neu erstellen <span className="muted">({ki.verbleibend} übrig)</span>
            </button>
            <button type="button" className="btnp" disabled={speichert || !entwurf.titel.trim() || entwurf.folien.length === 0} onClick={() => void uebernehmen()}>
              {speichert ? "Erstellt …" : `Präsentation mit ${entwurf.folien.length} Folien erstellen`}
            </button>
          </div>
        </>
      ) : null}
    </KiDialog>
  );
}
