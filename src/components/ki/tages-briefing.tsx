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
 * „Dein Tag“ auf dem Dashboard: immer eine Begrüßung und Vorschläge für heute.
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

  if (fehlt) return null;

  return (
    <section className="card span-12 tb-karte" aria-labelledby="tb-titel" aria-busy={!b || schreibt}>
      <div className="ch">
        <span className="ct" id="tb-titel">
          ✨ Dein Tag
        </span>
        <button
          type="button"
          className="link-knopf"
          onClick={() => {
            track("briefing_studio");
            studioOeffnen("Plan mit mir meinen Tag: Was sollte ich heute in welcher Reihenfolge machen – mit Zeiten?");
          }}
        >
          Mit Studio planen
        </button>
      </div>
      {!b ? (
        <p className="muted tb-gruss tb-laedt">Ich schaue mir deinen Tag an …</p>
      ) : (
        <>
          <p className={`tb-gruss ${schreibt ? "tb-schreibt" : ""}`} key={b.gruss}>
            {b.gruss}
          </p>
          {b.vorschlaege.length > 0 && (
            <ul className="tb-liste">
              {b.vorschlaege.map((v) => {
                const inhalt = (
                  <>
                    <span className="tb-icon" aria-hidden>
                      {v.icon}
                    </span>
                    <span className="tb-text">
                      <span className="tb-titel">{v.titel}</span>
                      <span className="tb-grund">{v.grund}</span>
                    </span>
                    <span className="tb-pfeil" aria-hidden>
                      {v.href ? "→" : "✨"}
                    </span>
                  </>
                );
                return (
                  <li key={v.id}>
                    {v.href ? (
                      <Link href={v.href} className="tb-vorschlag" onClick={() => track("briefing_vorschlag", { art: v.id.split("-")[0] })}>
                        {inhalt}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="tb-vorschlag"
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
          {schreibt && <p className="faint tb-fuss">UniVerse Studio formuliert deine Vorschläge …</p>}
        </>
      )}
    </section>
  );
}
