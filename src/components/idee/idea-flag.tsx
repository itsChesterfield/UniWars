"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/nav-icon";
import { meldung } from "@/components/meldung";
import { createClient } from "@/lib/supabase/client";
import { HUB_LABEL, ideeGueltig, type IdeeHub } from "@/lib/idee";

/** Antwort der Edge Function „create-idea“. */
type Antwort = { ok?: boolean; issue?: string; error?: string };

/** Ruft die Edge Function auf. Der YouTrack-Token bleibt serverseitig; hier geht nur die Idee raus. */
async function ideeSenden(hub: IdeeHub, title: string, description: string): Promise<{ ok: true; issue?: string } | { ok: false; fehler: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke<Antwort>("create-idea", {
    body: { title, description, hub },
  });
  if (error) {
    // Bei einem Fehlerstatus steckt die Antwort der Funktion in error.context (eine Response)
    let fehler = "Senden fehlgeschlagen. Bitte später erneut versuchen.";
    const context = (error as { context?: Response }).context;
    try {
      const body = (await context?.json?.()) as Antwort | undefined;
      if (body?.error) fehler = body.error;
    } catch {
      // Antwort ließ sich nicht lesen: Standardtext behalten
    }
    return { ok: false, fehler };
  }
  if (data?.ok) return { ok: true, issue: data.issue };
  return { ok: false, fehler: data?.error ?? "Senden fehlgeschlagen. Bitte später erneut versuchen." };
}

/**
 * Kleine Flagge an einem Bereich. Klick öffnet ein Formular (Titel und Beschreibung);
 * Absenden legt in YouTrack ein Ticket im passenden Hub-Epic an und versieht es mit dem Tag „Rohidee“.
 */
export function IdeaFlag({ hub }: { hub: IdeeHub }) {
  const [offen, setOffen] = useState(false);
  const [titel, setTitel] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const erstesFeld = useRef<HTMLInputElement>(null);
  const flagge = useRef<HTMLButtonElement>(null);
  const id = useId();
  const bereich = HUB_LABEL[hub];

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (offen && !el.open) {
      el.showModal();
      erstesFeld.current?.focus();
    } else if (!offen && el.open) {
      el.close();
    }
  }, [offen]);

  function schliessen() {
    setOffen(false);
    setFehler(null);
    flagge.current?.focus();
  }

  function absenden() {
    if (!ideeGueltig(titel) || laeuft) return;
    setLaeuft(true);
    setFehler(null);
    ideeSenden(hub, titel.trim(), beschreibung.trim())
      .then((a) => {
        if (a.ok) {
          setOffen(false);
          setTitel("");
          setBeschreibung("");
          meldung(a.issue ? `Danke, als Rohidee in ${bereich} gespeichert (${a.issue}).` : `Danke, als Rohidee in ${bereich} gespeichert.`, "hinweis");
          flagge.current?.focus();
        } else {
          setFehler(a.fehler);
        }
      })
      .catch(() => setFehler("Senden fehlgeschlagen. Bitte später erneut versuchen."))
      .finally(() => setLaeuft(false));
  }

  const gesperrt = !ideeGueltig(titel) || laeuft;

  return (
    <>
      <button
        ref={flagge}
        type="button"
        className="idee-flagge"
        aria-haspopup="dialog"
        aria-label={`Idee oder Fehler zu ${bereich} melden`}
        title={`Idee oder Fehler zu ${bereich} melden`}
        onClick={() => setOffen(true)}
      >
        <Icon name="flagge" groesse={18} />
      </button>

      <dialog
        ref={dialog}
        className="formular-dialog idee-dialog"
        aria-labelledby={`${id}-titel`}
        onCancel={(e) => {
          e.preventDefault();
          schliessen();
        }}
        onClick={(e) => {
          const r = dialog.current?.getBoundingClientRect();
          if (e.target === dialog.current && r && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) schliessen();
        }}
      >
        <form
          className="idee-form"
          onSubmit={(e) => {
            e.preventDefault();
            absenden();
          }}
        >
          <div>
            <h2 id={`${id}-titel`} className="rueckfrage-titel">
              Idee oder Fehler melden
            </h2>
            <p className="rueckfrage-text">
              Geht als Rohidee an das Team, Bereich {bereich}.
            </p>
          </div>

          <label className="idee-feld" htmlFor={`${id}-feld-titel`}>
            <span>Titel</span>
            <input
              ref={erstesFeld}
              id={`${id}-feld-titel`}
              value={titel}
              maxLength={200}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="Kurz und knapp"
            />
          </label>

          <label className="idee-feld" htmlFor={`${id}-feld-text`}>
            <span>Beschreibung</span>
            <textarea
              id={`${id}-feld-text`}
              value={beschreibung}
              maxLength={4000}
              onChange={(e) => setBeschreibung(e.target.value)}
              placeholder="Was ist dir aufgefallen oder was wünschst du dir?"
            />
          </label>

          {fehler && (
            <p className="auth-error" role="alert">
              {fehler}
            </p>
          )}

          <div className="rueckfrage-knoepfe">
            <button type="button" className="knopf leise" onClick={schliessen}>
              Abbrechen
            </button>
            <button type="submit" className="knopf haupt" aria-busy={laeuft || undefined} disabled={gesperrt}>
              {laeuft ? "Sendet" : "Senden"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
