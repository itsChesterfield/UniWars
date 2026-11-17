"use client";

import { Suspense, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FRAME_NAME,
  HUB_DRAG_TYP,
  OEFFNEN_EREIGNIS,
  PFAD_NACHRICHT,
  anteilAusPosition,
  anteilBegrenzen,
  aufteilungLesen,
  gegenueber,
  istAppPfad,
  istSeite,
  istWaagrecht,
  zoneAusPosition,
  type Aufteilung,
  type Seite,
} from "@/lib/geteilte-ansicht";
import { hubNameAusPfad } from "@/lib/hubs/navigation";
import { BEREICHE } from "@/lib/dashboard-bereiche";
import { track } from "@/lib/analytics";

// Die Aufteilung liegt im Browser, damit sie Seitenwechsel und Neuladen übersteht.
const SCHLUESSEL = "uniwars-geteilte-ansicht-v1";
const listeners = new Set<() => void>();
let ersatz: string | null = null;

function rohLesen(): string | null {
  try {
    return window.localStorage.getItem(SCHLUESSEL);
  } catch {
    return ersatz;
  }
}

function aufteilungSchreiben(a: Aufteilung | null) {
  const roh = a ? JSON.stringify(a) : null;
  try {
    if (roh) window.localStorage.setItem(SCHLUESSEL, roh);
    else window.localStorage.removeItem(SCHLUESSEL);
  } catch {
    // Privater Modus o. Ä.: dann gilt die Aufteilung nur bis zum Neuladen.
    ersatz = roh;
  }
  listeners.forEach((l) => l());
}

function abonnieren(listener: () => void) {
  listeners.add(listener);
  const beiStorage = (e: StorageEvent) => {
    if (e.key === SCHLUESSEL) listener();
  };
  window.addEventListener("storage", beiStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", beiStorage);
  };
}

const keinAbo = () => () => {};
/** Läuft diese Seite gerade als zweiter Hub im iframe? */
function useEingebettet() {
  return useSyncExternalStore(
    keinAbo,
    () => window.name === FRAME_NAME,
    () => false,
  );
}

/** Meldet dem Hauptfenster, wohin im zweiten Hub navigiert wurde (für das Wiederherstellen). */
function PfadMelder() {
  const pfad = usePathname();
  const suche = useSearchParams().toString();
  useEffect(() => {
    if (window.parent === window) return;
    window.parent.postMessage({ typ: PFAD_NACHRICHT, href: suche ? `${pfad}?${suche}` : pfad }, window.location.origin);
  }, [pfad, suche]);
  return null;
}

const SEITEN_TEXT: Record<Seite, string> = { links: "links", rechts: "rechts", oben: "oben", unten: "unten" };

/**
 * Hauptbereich neben der Sidebar. Zieht man ein Hub-Icon aus der Sidebar an einen
 * Rand, öffnet sich der Hub dort als zweite Ansicht (wie Windows Snap). Der zweite
 * Hub läuft in einem iframe derselben App – ohne Sidebar, sonst wie gewohnt.
 */
export function GeteilteAnsicht({ children, mainKlasse: grundKlasse }: { children: ReactNode; mainKlasse: string }) {
  // Zentraler Hub (Übersicht, Termine …) hat eigene Ränder; die Übersicht reicht bis an den Rand
  const pfadJetzt = usePathname();
  const zentral = BEREICHE.some((b) => b.href === pfadJetzt);
  const mainKlasse = zentral ? `dashboard-main hub-zentral${pfadJetzt === "/" ? " hub-randlos" : ""}` : grundKlasse;
  const eingebettet = useEingebettet();
  const roh = useSyncExternalStore(abonnieren, rohLesen, () => null);
  const aufteilung = eingebettet ? null : aufteilungLesen(roh);
  const router = useRouter();

  const rahmenRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ziehen, setZiehen] = useState(false);
  const [zone, setZone] = useState<Seite | null>(null);
  const [trennerAktiv, setTrennerAktiv] = useState(false);

  // Adresse des iframes nur beim Öffnen setzen – Navigation im Frame selbst
  // ändert nur die gespeicherte Adresse, sonst würde der Frame neu laden.
  const [frameQuelle, setFrameQuelle] = useState<string | null>(null);
  if (aufteilung && frameQuelle === null) setFrameQuelle(aufteilung.href);
  if (!aufteilung && frameQuelle !== null) setFrameQuelle(null);

  useEffect(() => {
    if (eingebettet) return;
    const start = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes(HUB_DRAG_TYP)) setZiehen(true);
    };
    const ende = () => {
      setZiehen(false);
      setZone(null);
    };
    const nachricht = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      const daten = e.data as { typ?: string; href?: unknown };
      if (daten?.typ !== PFAD_NACHRICHT || !istAppPfad(daten.href)) return;
      const aktuell = aufteilungLesen(rohLesen());
      if (aktuell && aktuell.href !== daten.href) aufteilungSchreiben({ ...aktuell, href: daten.href });
    };
    // Andere Komponenten (z. B. PDF Reader → Notiz) öffnen etwas als zweite Ansicht
    const oeffnenWunsch = (e: Event) => {
      const { href, seite } = (e as CustomEvent<{ href: unknown; seite: unknown }>).detail ?? {};
      if (!istAppPfad(href)) return;
      const aktuell = aufteilungLesen(rohLesen());
      const ziel: Seite = istSeite(seite) ? seite : (aktuell?.seite ?? "rechts");
      aufteilungSchreiben({ href, seite: ziel, anteil: aktuell?.anteil ?? 0.5 });
      setFrameQuelle(href);
      track("geteilte_ansicht_geoeffnet", { hub: hubNameAusPfad(href), seite: ziel, ersetzt: Boolean(aktuell), ausloeser: "verknuepfung" });
    };
    window.addEventListener(OEFFNEN_EREIGNIS, oeffnenWunsch);
    window.addEventListener("dragstart", start);
    window.addEventListener("dragend", ende);
    window.addEventListener("drop", ende);
    window.addEventListener("message", nachricht);
    return () => {
      window.removeEventListener(OEFFNEN_EREIGNIS, oeffnenWunsch);
      window.removeEventListener("dragstart", start);
      window.removeEventListener("dragend", ende);
      window.removeEventListener("drop", ende);
      window.removeEventListener("message", nachricht);
    };
  }, [eingebettet]);

  if (eingebettet) {
    return (
      <main className={mainKlasse}>
        {children}
        <Suspense fallback={null}>
          <PfadMelder />
        </Suspense>
      </main>
    );
  }

  function zoneBestimmen(x: number, y: number): Seite | null {
    const r = rahmenRef.current?.getBoundingClientRect();
    return r ? zoneAusPosition(x - r.left, y - r.top, r.width, r.height) : null;
  }

  function oeffnen(href: string, seite: Seite) {
    aufteilungSchreiben({ href, seite, anteil: aufteilung?.anteil ?? 0.5 });
    setFrameQuelle(href);
    track("geteilte_ansicht_geoeffnet", { hub: hubNameAusPfad(href), seite, ersetzt: Boolean(aufteilung) });
  }

  function schliessen() {
    aufteilungSchreiben(null);
    track("geteilte_ansicht_geschlossen");
  }

  function anteilSetzen(anteil: number) {
    if (aufteilung) aufteilungSchreiben({ ...aufteilung, anteil: anteilBegrenzen(anteil) });
  }

  function trennerTaste(e: KeyboardEvent) {
    if (!aufteilung) return;
    const waagrecht = istWaagrecht(aufteilung.seite);
    const zurueck = waagrecht ? "ArrowLeft" : "ArrowUp";
    const vor = waagrecht ? "ArrowRight" : "ArrowDown";
    if (e.key !== zurueck && e.key !== vor) return;
    e.preventDefault();
    // Der zweite Hub wächst, wenn sich der Trenner von seiner Seite weg bewegt.
    const richtung = e.key === vor ? 1 : -1;
    const waechstMit = aufteilung.seite === "links" || aufteilung.seite === "oben" ? 1 : -1;
    anteilSetzen(aufteilung.anteil + 0.05 * richtung * waechstMit);
  }

  const vorschau = zone ?? null;
  const vorschauAnteil = aufteilung?.anteil ?? 0.5;

  return (
    <div
      ref={rahmenRef}
      className="split-rahmen"
      data-aktiv={aufteilung ? "" : undefined}
      data-seite={aufteilung?.seite}
      data-blockiert={ziehen || trennerAktiv ? "" : undefined}
      style={aufteilung ? ({ "--split-anteil": aufteilung.anteil } as CSSProperties) : undefined}
    >
      <main className={`${mainKlasse} split-haupt`}>{children}</main>

      {aufteilung && frameQuelle && (
        <>
          <div
            className="split-trenner"
            role="separator"
            tabIndex={0}
            aria-orientation={istWaagrecht(aufteilung.seite) ? "vertical" : "horizontal"}
            aria-valuemin={20}
            aria-valuemax={80}
            aria-valuenow={Math.round(aufteilung.anteil * 100)}
            aria-label="Größe der beiden Ansichten ändern"
            title="Ziehen, um die Größe zu ändern (Doppelklick: halbe-halbe)"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setTrennerAktiv(true);
            }}
            onPointerMove={(e) => {
              if (!trennerAktiv) return;
              const r = rahmenRef.current?.getBoundingClientRect();
              if (r) anteilSetzen(anteilAusPosition(aufteilung.seite, { x: e.clientX, y: e.clientY }, r));
            }}
            onPointerUp={() => setTrennerAktiv(false)}
            onPointerCancel={() => setTrennerAktiv(false)}
            onDoubleClick={() => anteilSetzen(0.5)}
            onKeyDown={trennerTaste}
          />
          <section className="split-zweite" aria-label={`Zweite Ansicht: ${hubNameAusPfad(aufteilung.href)}`}>
            <div className="split-kopf">
              <span className="split-titel">{hubNameAusPfad(aufteilung.href)}</span>
              <span className="split-knoepfe">
                <button
                  type="button"
                  className="icon-knopf"
                  title="Seite wechseln"
                  aria-label="Seite wechseln"
                  onClick={() => aufteilungSchreiben({ ...aufteilung, seite: gegenueber(aufteilung.seite) })}
                >
                  ⇄
                </button>
                <button
                  type="button"
                  className="icon-knopf"
                  title={istWaagrecht(aufteilung.seite) ? "Übereinander anzeigen" : "Nebeneinander anzeigen"}
                  aria-label={istWaagrecht(aufteilung.seite) ? "Übereinander anzeigen" : "Nebeneinander anzeigen"}
                  onClick={() => aufteilungSchreiben({ ...aufteilung, seite: istWaagrecht(aufteilung.seite) ? "unten" : "rechts" })}
                >
                  {istWaagrecht(aufteilung.seite) ? "⬓" : "◫"}
                </button>
                <button
                  type="button"
                  className="icon-knopf"
                  title="Als Hauptansicht öffnen"
                  aria-label="Als Hauptansicht öffnen"
                  onClick={() => {
                    const ziel = aufteilung.href;
                    aufteilungSchreiben(null);
                    router.push(ziel);
                  }}
                >
                  ⤢
                </button>
                <button type="button" className="icon-knopf" title="Zweite Ansicht schließen" aria-label="Zweite Ansicht schließen" onClick={schliessen}>
                  ✕
                </button>
              </span>
            </div>
            <iframe ref={frameRef} name={FRAME_NAME} src={frameQuelle} title={hubNameAusPfad(aufteilung.href)} className="split-frame" />
          </section>
        </>
      )}

      {ziehen && (
        <div
          className="split-zonen"
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(HUB_DRAG_TYP)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            const neu = zoneBestimmen(e.clientX, e.clientY);
            if (neu !== zone) setZone(neu);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setZone(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const href = e.dataTransfer.getData(HUB_DRAG_TYP);
            const ziel = zoneBestimmen(e.clientX, e.clientY);
            setZiehen(false);
            setZone(null);
            if (istAppPfad(href) && ziel) oeffnen(href, ziel);
          }}
        >
          {vorschau ? (
            <div
              className="split-vorschau"
              data-seite={vorschau}
              style={{ "--split-anteil": vorschauAnteil } as CSSProperties}
            >
              <span>Hier ablegen ({SEITEN_TEXT[vorschau]})</span>
            </div>
          ) : (
            <p className="split-hinweis">An einen Rand ziehen, um den Bildschirm zu teilen</p>
          )}
        </div>
      )}
    </div>
  );
}
