"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { TeamUpdate } from "@/lib/team-updates-server";
import { TeamUpdateListe } from "./team-update-liste";

export function TeamUpdateDialog() {
  const pfad = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const titel = useRef<HTMLHeadingElement>(null);
  const pause = useRef(false);
  const bestaetigteUpdates = useRef<TeamUpdate[]>([]);
  const [updates, setUpdates] = useState<TeamUpdate[]>([]);
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState(false);
  const [abruf, setAbruf] = useState(0);

  useEffect(() => {
    if (pause.current || dialog.current?.open) return;
    const controller = new AbortController();
    void fetch("/api/team-updates", { cache: "no-store", signal: controller.signal })
      .then(async (antwort) => {
        if (!antwort.ok) return;
        const daten: { updates: TeamUpdate[] } = await antwort.json();
        if (!controller.signal.aborted && !pause.current) setUpdates(daten.updates);
      })
      .catch(() => {
        // Das Briefing soll den Einstieg auch bei einem Netzfehler nicht blockieren.
      });
    return () => controller.abort();
  }, [pfad, abruf]);

  useEffect(() => {
    const fenster = dialog.current;
    if (!fenster || !updates.length || pause.current) return;
    function oeffnen() {
      if (!fenster || fenster.open || pause.current || bestaetigteUpdates.current === updates || document.querySelector("dialog[open], [aria-modal='true']")) return;
      if (CSS.supports("selector(:popover-open)") && document.querySelector(":popover-open")) return;
      fenster.showModal();
      titel.current?.focus();
    }
    const observer = new MutationObserver(oeffnen);
    observer.observe(document.body, { attributes: true, attributeFilter: ["open", "aria-modal"], childList: true, subtree: true });
    document.addEventListener("toggle", oeffnen, true);
    oeffnen();
    return () => {
      observer.disconnect();
      document.removeEventListener("toggle", oeffnen, true);
    };
  }, [updates]);

  function spaeter() {
    pause.current = true;
    dialog.current?.close();
  }

  async function gelesen() {
    setSpeichert(true);
    setFehler(false);
    try {
      const antwort = await fetch("/api/team-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates.map(({ pr }) => pr)),
      });
      if (!antwort.ok) throw new Error("Lesestatus konnte nicht gespeichert werden");
      bestaetigteUpdates.current = updates;
      setUpdates([]);
      dialog.current?.close();
      setAbruf((wert) => wert + 1);
    } catch {
      setFehler(true);
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <dialog ref={dialog} className="card team-update-dialog" aria-labelledby="team-update-titel"
      onCancel={(ereignis) => { ereignis.preventDefault(); if (!speichert) spaeter(); }}>
      <h2 id="team-update-titel" tabIndex={-1} ref={titel}>Neue Team-Updates</h2>
      <div className="team-update-inhalt"><TeamUpdateListe updates={updates} /></div>
      {fehler && <p role="alert">Der Lesestatus konnte nicht gespeichert werden. Bitte versuche es erneut.</p>}
      <div className="team-update-aktionen">
        <Link href="/einstellungen/team-updates" onClick={spaeter}>Zum Verlauf</Link>
        <button className="btn" type="button" disabled={speichert} onClick={spaeter}>Später</button>
        <button className="btn btn-primary" type="button" disabled={speichert} onClick={gelesen}>
          {speichert ? "Wird gespeichert…" : "Als gelesen markieren"}
        </button>
      </div>
    </dialog>
  );
}
