"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { markiereBenachrichtigungGelesen } from "@/app/benachrichtigung/actions";
import { einladungAnnehmen, einladungAblehnen } from "@/app/einladung/actions";
import type { Tables } from "@/lib/supabase/types";
import { absolutesDatum } from "@/lib/countdown";
import { track } from "@/lib/analytics";

type Benachrichtigung = Tables<"benachrichtigung">;
type Einladung = Tables<"einladung">;

function Glocke() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

/**
 * Benachrichtigungen in der Kopfleiste: Knopf mit Zahl, darunter ein Feld mit Einladungen und Hinweisen.
 * Escape und ein Klick daneben schließen, der Fokus geht zurück auf den Knopf.
 * Hinweise zu einer Frist (`ref_id`) öffnen die Frist in den Aufgaben und gelten dann als gelesen.
 */
export function NotificationBell({
  initial,
  initialEinladungen = [],
}: {
  initial: Benachrichtigung[];
  initialEinladungen?: Einladung[];
}) {
  const [items, setItems] = useState(initial);
  const [einladungen, setEinladungen] = useState(initialEinladungen);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const feldId = useId();
  const titelId = useId();
  const rahmen = useRef<HTMLDivElement>(null);
  const knopf = useRef<HTMLButtonElement>(null);

  const ungelesen = items.filter((n) => !n.gelesen).length + einladungen.length;

  useEffect(() => {
    if (!open) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      knopf.current?.focus();
    };
    const daneben = (e: PointerEvent) => {
      if (rahmen.current && !rahmen.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", taste);
    window.addEventListener("pointerdown", daneben);
    return () => {
      window.removeEventListener("keydown", taste);
      window.removeEventListener("pointerdown", daneben);
    };
  }, [open]);

  function markiereGelesen(id: string) {
    if (items.find((n) => n.id === id)?.gelesen) return;
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, gelesen: true } : n)));
    startTransition(() => markiereBenachrichtigungGelesen(id));
    track("benachrichtigung_gelesen");
  }

  function annehmen(id: string) {
    setEinladungen((prev) => prev.filter((e) => e.id !== id));
    startTransition(() => einladungAnnehmen(id));
    track("einladung_angenommen");
  }

  function ablehnen(id: string) {
    setEinladungen((prev) => prev.filter((e) => e.id !== id));
    startTransition(() => einladungAblehnen(id));
    track("einladung_abgelehnt");
  }

  return (
    <div className="glocke" ref={rahmen}>
      <button
        ref={knopf}
        type="button"
        className="symbolknopf glocke-knopf"
        aria-expanded={open}
        aria-controls={feldId}
        aria-label={ungelesen ? `Benachrichtigungen, ${ungelesen} neu` : "Benachrichtigungen"}
        onClick={() => {
          if (!open) {
            track("benachrichtigungen_geoeffnet", {
              ungelesen: items.filter((n) => !n.gelesen).length,
              offene_einladungen: einladungen.length,
            });
          }
          setOpen((o) => !o);
        }}
      >
        <Glocke />
        {ungelesen > 0 && (
          <span className="glocke-zahl zahl" aria-hidden>
            {ungelesen > 9 ? "9+" : ungelesen}
          </span>
        )}
      </button>

      <div id={feldId} className="glocke-feld" role="region" aria-labelledby={titelId} hidden={!open}>
        <div className="glocke-kopf">
          <p id={titelId} className="glocke-titel">Benachrichtigungen</p>
          {ungelesen > 0 && (
            <span>
              <span className="zahl">{ungelesen}</span> neu
            </span>
          )}
        </div>
        {einladungen.length === 0 && items.length === 0 ? (
          <p className="glocke-leer">Alles gelesen. Hier erscheinen Fristen, die bald fällig sind, und Einladungen.</p>
        ) : (
          <ul className="glocke-liste">
            {einladungen.map((e) => (
              <li key={e.id} className="glocke-eintrag neu">
                <div className="glocke-text">
                  <p>
                    <b>{e.von_username ?? "Jemand"}</b> lädt dich zu <b>„{e.ziel_titel}“</b> ein.
                  </p>
                  {e.ziel_faellig_am && (
                    <small>
                      Fällig {absolutesDatum(e.ziel_faellig_am)}
                    </small>
                  )}
                  <div className="glocke-aktionen">
                    <button type="button" className="knopf neben klein" onClick={() => annehmen(e.id)}>
                      Annehmen
                    </button>
                    <button type="button" className="knopf leise klein" onClick={() => ablehnen(e.id)}>
                      Ablehnen
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {items.map((n) => {
              const inhalt = (
                <>
                  <span className="glocke-text">
                    <span className="glocke-satz">{n.text}</span>
                    <small>{absolutesDatum(n.erstellt_am)}</small>
                  </span>
                  {!n.gelesen && <span className="vh">, neu</span>}
                </>
              );
              return (
                <li key={n.id} className={`glocke-eintrag${n.gelesen ? "" : " neu"}`}>
                  {n.ref_id ? (
                    <Link
                      className="glocke-auf"
                      href={`/aufgaben?detail=deadline:${n.ref_id}`}
                      onClick={() => {
                        markiereGelesen(n.id);
                        setOpen(false);
                      }}
                    >
                      {inhalt}
                    </Link>
                  ) : (
                    <button type="button" className="glocke-auf" onClick={() => markiereGelesen(n.id)} disabled={n.gelesen}>
                      {inhalt}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
