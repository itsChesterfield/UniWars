"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  karteikartenVorschlagen,
  kiStatus,
  vorschlaegeUebernehmen,
  type KiStatus,
  type UebernahmeZiel,
} from "@/app/(hubs)/notizen/ki-actions";
import { KiEinwilligungInhalt } from "@/components/ki/ki-einwilligung-dialog";
import { KiFehlerMeldung } from "@/components/ki/ki-fehler-meldung";
import { KiLadeZustand } from "@/components/ki/ki-lade-zustand";
import { KiLimitHinweis } from "@/components/ki/ki-limit-hinweis";
import { ERLAUBTE_ANZAHL, MAX_SEITE_ZEICHEN, type KartenAnzahl } from "@/lib/ki/karten";
import type { KiFehlerTyp } from "@/lib/ki/fehler";
import type { KiErgebnis } from "@/lib/ki/ergebnis";
import type { Vorschlag } from "@/lib/ki/karten";
import type { FachOption } from "@/lib/fach-option";
import { track } from "@/lib/analytics";

type Schritt = "laden" | "nicht_verfuegbar" | "einwilligung" | "einstellungen" | "erstellt" | "vorschau" | "fertig";
type Entwurf = { id: number; vorderseite: string; rueckseite: string; an: boolean; original: string };

const NEUER_STAPEL = "__neu__";

/** Nur diese Typen gehen an Analytics (nie Inhalte). */
function fehlerTracken(typ: KiFehlerTyp) {
  if (typ === "limit" || typ === "ausgelastet" || typ === "keine_karten" || typ === "technisch") track("ki_fehler", { typ });
}

export type KartenVorschlagen = (anzahl: KartenAnzahl) => Promise<KiErgebnis<{ karten: Vorschlag[]; gekuerzt: boolean; verbleibendHeute: number }>>;

/**
 * KI-01: Karteikarten aus einer Notiz erstellen – oder aus anderem Material (KI-03 PDF-Seiten,
 * KI-04 Transkript), dann mit eigener `vorschlagen`-Funktion.
 * Nichts wird gespeichert, bevor der Nutzer die Vorschläge bestätigt.
 */
export function KiKartenDialog({
  notiz,
  faecher,
  vorher = async () => undefined,
  vorschlagen,
  ladeText = "Die KI liest deine Notiz …",
  kuerzungsText = "Nur der Anfang der Notiz wurde verwendet.",
  onSchliessen,
}: {
  /** Herkunft: bei Notizen mit id (wird an der Karte vermerkt) */
  notiz: { id?: string | null; titel: string; fach_id: string | null };
  faecher: FachOption[];
  /** Ausstehende Änderungen der Notiz speichern, damit die KI den aktuellen Stand liest */
  vorher?: () => Promise<void>;
  vorschlagen?: KartenVorschlagen;
  ladeText?: string;
  kuerzungsText?: string;
  onSchliessen: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [schritt, setSchritt] = useState<Schritt>("laden");
  const [status, setStatus] = useState<KiStatus | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [anzahl, setAnzahl] = useState<KartenAnzahl>(10);
  const [ziel, setZiel] = useState(NEUER_STAPEL);
  const [neuerName, setNeuerName] = useState(notiz.titel.trim() || "Unbenannte Notiz");
  const [entwuerfe, setEntwuerfe] = useState<Entwurf[]>([]);
  const [gekuerzt, setGekuerzt] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const [ergebnis, setErgebnis] = useState<{ stapelId: string; stapelName: string; anzahl: number } | null>(null);

  useEffect(() => {
    ref.current?.showModal();
    let abgebrochen = false;
    kiStatus()
      .catch(() => null)
      .then((antwort) => {
        if (abgebrochen) return;
        if (!antwort?.ok) {
          setFehler(antwort?.fehler ?? "KI ist gerade nicht verfügbar.");
          setSchritt("nicht_verfuegbar");
          return;
        }
        const s = antwort.daten;
        setStatus(s);
        // Voreinstellung: Stapel mit demselben Fach wie die Notiz, sonst neuer Stapel
        const passend = notiz.fach_id ? s.stapel.find((st) => st.fach_id === notiz.fach_id) : undefined;
        setZiel(passend?.id ?? NEUER_STAPEL);
        setSchritt(!s.verfuegbar ? "nicht_verfuegbar" : s.eingewilligt ? "einstellungen" : "einwilligung");
      });
    return () => {
      abgebrochen = true;
    };
  }, [notiz.fach_id]);

  const verbleibend = status ? Math.max(0, status.limit - status.genutzt) : 0;
  const schliessbar = schritt !== "erstellt" && !speichert;

  function schliessen() {
    if (schliessbar) onSchliessen();
  }

  async function erstellen() {
    setFehler(null);
    setSchritt("erstellt");
    track("ki_karteikarten_gestartet", { anzahl });
    const start = performance.now();
    try {
      await vorher();
    } catch {
      // Speichern läuft im Hintergrund weiter – die KI liest dann den letzten gespeicherten Stand
    }
    const antwort = await (vorschlagen ? vorschlagen(anzahl) : karteikartenVorschlagen(notiz.id ?? "", anzahl)).catch(() => null);
    if (!antwort) {
      setFehler("Da ist etwas schiefgelaufen. Bitte versuch es noch einmal.");
      fehlerTracken("technisch");
      setSchritt("einstellungen");
      return;
    }
    if (!antwort.ok) {
      setFehler(antwort.fehler);
      fehlerTracken(antwort.typ);
      if (antwort.typ === "limit" && status) setStatus({ ...status, genutzt: status.limit });
      setSchritt(antwort.typ === "einwilligung" ? "einwilligung" : "einstellungen");
      return;
    }
    const { karten, gekuerzt: wurdeGekuerzt, verbleibendHeute } = antwort.daten;
    setEntwuerfe(
      karten.map((k, i) => ({ id: i, vorderseite: k.vorderseite, rueckseite: k.rueckseite, an: true, original: `${k.vorderseite}\u0000${k.rueckseite}` })),
    );
    setGekuerzt(wurdeGekuerzt);
    if (status) setStatus({ ...status, genutzt: status.limit - verbleibendHeute });
    track("ki_karteikarten_vorschau", { anzahl_erhalten: karten.length, dauer_ms: Math.round(performance.now() - start) });
    setSchritt("vorschau");
  }

  const ausgewaehlt = entwuerfe.filter((e) => e.an);
  const unvollstaendig = ausgewaehlt.some((e) => !e.vorderseite.trim() || !e.rueckseite.trim());

  async function uebernehmen() {
    if (ausgewaehlt.length === 0 || unvollstaendig) return;
    setFehler(null);
    setSpeichert(true);
    const zielAngabe: UebernahmeZiel =
      ziel === NEUER_STAPEL ? { neuerStapel: { name: neuerName, fachId: notiz.fach_id } } : { stapelId: ziel };
    const antwort = await vorschlaegeUebernehmen(
      zielAngabe,
      ausgewaehlt.map((e) => ({ vorderseite: e.vorderseite, rueckseite: e.rueckseite })),
      { notizId: notiz.id ?? null },
    ).catch(() => null);
    setSpeichert(false);
    if (!antwort?.ok) {
      setFehler(antwort && !antwort.ok ? antwort.fehler : "Speichern hat nicht geklappt. Bitte versuch es noch einmal.");
      return;
    }
    track("ki_karteikarten_uebernommen", {
      anzahl_uebernommen: ausgewaehlt.length,
      anzahl_bearbeitet: ausgewaehlt.filter((e) => `${e.vorderseite}\u0000${e.rueckseite}` !== e.original).length,
      neuer_stapel: ziel === NEUER_STAPEL,
    });
    setErgebnis(antwort.daten);
    setSchritt("fertig");
  }

  function aendern(id: number, teil: Partial<Entwurf>) {
    setEntwuerfe((liste) => liste.map((e) => (e.id === id ? { ...e, ...teil } : e)));
  }

  const neuerStapelGewaehlt = ziel === NEUER_STAPEL;

  return (
    <dialog
      ref={ref}
      className={`card ki-dialog ${schritt === "vorschau" ? "ki-dialog-gross" : ""}`}
      aria-labelledby="ki-dialog-titel"
      aria-busy={schritt === "erstellt" || schritt === "laden"}
      onCancel={(e) => {
        e.preventDefault();
        schliessen();
      }}
    >
      {schritt !== "einwilligung" && (
        <div className="rowb ki-dialog-kopf">
          <h3 className="ct" id="ki-dialog-titel">
            ✨ Karteikarten erstellen
          </h3>
          {schliessbar && (
            <button type="button" className="icon-knopf" aria-label="Schließen" onClick={schliessen}>
              ✕
            </button>
          )}
        </div>
      )}

      {schritt === "laden" && <KiLadeZustand text="Lädt …" />}

      {schritt === "nicht_verfuegbar" && (
        <>
          <p>{fehler ?? "KI ist gerade nicht verfügbar."}</p>
          <div className="hub-formular-knoepfe">
            <button type="button" className="btnp" onClick={onSchliessen}>
              Schließen
            </button>
          </div>
        </>
      )}

      {schritt === "einwilligung" && (
        <KiEinwilligungInhalt
          onAbbrechen={onSchliessen}
          onZugestimmt={() => {
            track("ki_einwilligung_erteilt", { ort: "notizen" });
            if (status) setStatus({ ...status, eingewilligt: true });
            setFehler(null);
            setSchritt("einstellungen");
          }}
        />
      )}

      {schritt === "einstellungen" && status && (
        <form
          className="ki-einstellungen"
          onSubmit={(e) => {
            e.preventDefault();
            void erstellen();
          }}
        >
          <div className="ki-feld">
            <span id="ki-anzahl-label">Anzahl Karten</span>
            <div className="segwrap" role="radiogroup" aria-labelledby="ki-anzahl-label">
              {ERLAUBTE_ANZAHL.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={anzahl === n}
                  className={`seg ${anzahl === n ? "on" : ""}`}
                  onClick={() => setAnzahl(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <label className="ki-feld">
            <span>Ziel-Stapel</span>
            <select className="field" value={ziel} onChange={(e) => setZiel(e.target.value)}>
              {status.stapel.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                  {st.fach_id && faecher.find((f) => f.id === st.fach_id) ? ` · ${faecher.find((f) => f.id === st.fach_id)?.name}` : ""}
                </option>
              ))}
              <option value={NEUER_STAPEL}>+ Neuer Stapel</option>
            </select>
          </label>
          {neuerStapelGewaehlt && (
            <label className="ki-feld">
              <span>Name des neuen Stapels</span>
              <input className="field" value={neuerName} maxLength={120} onChange={(e) => setNeuerName(e.target.value)} required />
            </label>
          )}

          <KiFehlerMeldung meldung={fehler} />

          <div className="ki-fuss">
            <KiLimitHinweis verbleibend={verbleibend} limit={status.limit} />
            <button type="submit" className="btnp" disabled={verbleibend === 0 || (neuerStapelGewaehlt && !neuerName.trim())}>
              Erstellen
            </button>
          </div>
        </form>
      )}

      {schritt === "erstellt" && (
        <KiLadeZustand text={ladeText} untertext="Das dauert meist ein paar Sekunden." />
      )}

      {schritt === "vorschau" && (
        <>
          <p className="ki-hinweis">⚠️ Prüf die Karten, die KI kann sich irren.</p>
          {gekuerzt && <p className="ki-hinweis">✂️ {kuerzungsText}</p>}
          <ul className="ki-vorschau">
            {entwuerfe.map((e, i) => (
              <li key={e.id} className={e.an ? "" : "aus"}>
                <label className="ki-vorschau-wahl">
                  <input type="checkbox" checked={e.an} onChange={(ev) => aendern(e.id, { an: ev.target.checked })} />
                  <span className="mono">{i + 1}</span>
                </label>
                <div className="ki-vorschau-seiten">
                  <textarea
                    className="field"
                    aria-label={`Karte ${i + 1}: Vorderseite`}
                    value={e.vorderseite}
                    maxLength={MAX_SEITE_ZEICHEN}
                    rows={2}
                    onChange={(ev) => aendern(e.id, { vorderseite: ev.target.value })}
                  />
                  <textarea
                    className="field"
                    aria-label={`Karte ${i + 1}: Rückseite`}
                    value={e.rueckseite}
                    maxLength={MAX_SEITE_ZEICHEN}
                    rows={3}
                    onChange={(ev) => aendern(e.id, { rueckseite: ev.target.value })}
                  />
                </div>
                <button
                  type="button"
                  className="icon-knopf"
                  aria-label={`Karte ${i + 1} entfernen`}
                  title="Entfernen"
                  onClick={() => setEntwuerfe((liste) => liste.filter((x) => x.id !== e.id))}
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
          {entwuerfe.length === 0 && <p className="empty-state">Alle Vorschläge entfernt.</p>}
          {unvollstaendig && <p className="auth-error">Vorder- und Rückseite dürfen nicht leer sein.</p>}
          <KiFehlerMeldung meldung={fehler} />
          <div className="ki-fuss">
            <button
              type="button"
              className="btng"
              onClick={() => void erstellen()}
              disabled={speichert || verbleibend === 0}
              title={`Verbraucht eine weitere KI-Anfrage (heute noch ${verbleibend})`}
            >
              ↻ Neu erstellen <span className="muted">({verbleibend} übrig)</span>
            </button>
            <button type="button" className="btnp" onClick={() => void uebernehmen()} disabled={speichert || ausgewaehlt.length === 0 || unvollstaendig}>
              {speichert ? "Speichert …" : `${ausgewaehlt.length} ${ausgewaehlt.length === 1 ? "Karte" : "Karten"} übernehmen`}
            </button>
          </div>
        </>
      )}

      {schritt === "fertig" && ergebnis && (
        <div className="ki-mitte">
          <div className="hub-leer-icon" aria-hidden>
            🎉
          </div>
          <p>
            <strong>{ergebnis.anzahl}</strong> {ergebnis.anzahl === 1 ? "Karte" : "Karten"} in <em>{ergebnis.stapelName}</em> gespeichert.
          </p>
          <div className="hub-formular-knoepfe">
            <button type="button" className="btng" onClick={onSchliessen}>
              Schließen
            </button>
            <Link href={`/karteikarten/${ergebnis.stapelId}/lernen`} className="btnp">
              Jetzt lernen
            </Link>
          </div>
        </div>
      )}
    </dialog>
  );
}
