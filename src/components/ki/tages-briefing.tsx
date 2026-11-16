"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { tagesbriefing, tagesbriefingKi, type Briefing } from "@/app/(hubs)/assistent/briefing-actions";
import { studioOeffnen } from "@/lib/ki/studio-kontext";
import { track } from "@/lib/analytics";

/** Ereignis: neues Briefing (Überschrift im Dashboard-Kopf hört mit) */
export const BRIEFING_EREIGNIS = "uniwars-briefing";

let erstesBriefing: Promise<Briefing | null> | null = null;
/** Einmal pro Seitenaufruf laden – Kopf und Karte teilen sich das Ergebnis */
export function briefingHolen(): Promise<Briefing | null> {
  erstesBriefing ??= tagesbriefing().catch(() => null);
  return erstesBriefing;
}

function melden(b: Briefing) {
  window.dispatchEvent(new CustomEvent(BRIEFING_EREIGNIS, { detail: b }));
}

/**
 * „Dein Tag“ im Zentralen Hub (Baustein der Übersicht): immer eine Begrüßung und Vorschläge für heute.
 * Erst sofort aus den Daten, dann – falls noch nicht da – persönlich von der KI formuliert.
 */
export function TagesBriefing() {
  const [b, setB] = useState<Briefing | null>(null);
  const [schreibt, setSchreibt] = useState(false);
  const [fehlt, setFehlt] = useState(false);

  useEffect(() => {
    let ab = false;
    briefingHolen()
      .then((erst) => {
        if (ab) return;
        if (!erst) return setFehlt(true);
        setB(erst);
        melden(erst);
        if (!erst.kiMoeglich) return;
        setSchreibt(true);
        tagesbriefingKi()
          .then((ki) => {
            if (ab || !ki) return;
            setB(ki);
            melden(ki);
          })
          .catch(() => undefined)
          .finally(() => !ab && setSchreibt(false));
      })
      .catch(() => !ab && setFehlt(true));
    return () => {
      ab = true;
    };
  }, []);

  return (
    <section className="vorschlag" aria-labelledby="tb-titel" aria-busy={!fehlt && (!b || schreibt)}>
      <div className="kopfzeile">
        <h2 id="tb-titel">Dein Tag</h2>
        <button
          type="button"
          className="link rechts"
          onClick={() => {
            track("briefing_studio");
            studioOeffnen("Plan mit mir meinen Tag: Was sollte ich heute in welcher Reihenfolge machen – mit Zeiten?");
          }}
        >
          Mit Studio planen
        </button>
      </div>
      {fehlt ? (
        <p className="vleer">Die Vorschläge für heute lassen sich gerade nicht laden.</p>
      ) : !b ? (
        <p className="tb-gruss tb-laedt">Ich schaue mir deinen Tag an …</p>
      ) : (
        <>
          <p className={`tb-gruss ${schreibt ? "tb-schreibt" : ""}`} key={b.gruss}>
            {b.gruss}
          </p>
          {b.vorschlaege.length > 0 && (
            <ul className="vliste">
              {b.vorschlaege.map((v) => {
                const inhalt = (
                  <>
                    <span className="balken" aria-hidden />
                    <span>
                      <strong>{v.titel}</strong>
                      <span className="meta">{v.grund}</span>
                    </span>
                  </>
                );
                return (
                  <li key={v.id}>
                    {v.href ? (
                      <Link href={v.href} onClick={() => track("briefing_vorschlag", { art: v.id.split("-")[0] })}>
                        {inhalt}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          track("briefing_vorschlag", { art: v.id.split("-")[0] });
                          if (v.frage) studioOeffnen(v.frage);
                        }}
                      >
                        {inhalt}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {schreibt && <p className="vfuss tb-fuss">UniVerse Studio formuliert deine Vorschläge …</p>}
        </>
      )}
    </section>
  );
}
