"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AssistentChat } from "@/components/assistent/assistent-chat";
import { kontextAusPfad, type KontextEingabe } from "@/lib/ki/assistent";
import { aufteilungLesen, istAppPfad, istEingebettet, OEFFNEN_EREIGNIS } from "@/lib/geteilte-ansicht";
import { markierterText, STUDIO_NEU, STUDIO_OEFFNEN, studioZustand } from "@/lib/ki/studio-kontext";
import { STUDIO_BREITE, studioBreiteBegrenzen, studioBreiteLesen, studioMaximalbreite } from "@/lib/ki/studio-layout";
import { STUDIO_NAME } from "@/lib/ki/studio";
import { track } from "@/lib/analytics";
import { Icon } from "@/components/nav-icon";

const AUFTEILUNG_SCHLUESSEL = "uniwars-geteilte-ansicht-v1";
const NACHRICHT = "uniwars-studio-umschalten";
const BREITE_SCHLUESSEL = "uniwars-studio-breite";
const BREITE_SCHRITT = 24;

const SPALTEN = ".dashboard > .rail, .dashboard > aside.kontext";

function maximalbreite() {
  // Eine beim Drüberfahren ausgeklappte Leiste hat einen negativen Rand und belegt weiterhin nur 64 px.
  const spalten = Array.from(document.querySelectorAll<HTMLElement>(SPALTEN))
    .filter((spalte) => spalte.offsetWidth > 0)
    .map((spalte) => spalte.offsetWidth + (parseFloat(getComputedStyle(spalte).marginInlineEnd) || 0));
  return studioMaximalbreite(window.innerWidth, spalten.reduce((summe, breite) => summe + breite, 0));
}

function verlaufIm(dialog: HTMLDialogElement | null) {
  return dialog?.querySelector<HTMLElement>(".ki-chat-verlauf");
}

const serverMaximalbreite = () => STUDIO_BREITE.breit;

function wunschbreiteLesen() {
  if (typeof window === "undefined") return STUDIO_BREITE.standard;
  try {
    return studioBreiteLesen(window.localStorage.getItem(BREITE_SCHLUESSEL), window.localStorage.getItem("uniwars-studio-gross"));
  } catch {
    return STUDIO_BREITE.standard;
  }
}

function scrollpositionMerken(verlauf: HTMLElement | null | undefined) {
  if (!verlauf) return null;
  const amEnde = verlauf.scrollHeight - verlauf.clientHeight - verlauf.scrollTop <= 2;
  const oben = verlauf.getBoundingClientRect().top;
  const nachricht = Array.from(verlauf.children).find((kind) => kind.getBoundingClientRect().bottom > oben);
  const absatz = nachricht && Array.from(nachricht.querySelectorAll(".md-inhalt > *"))
    .find((block) => block.getBoundingClientRect().bottom > oben);
  const anker = absatz ?? nachricht;
  const position = anker?.getBoundingClientRect();
  const abstand = position ? position.top - oben : 0;
  // Nach dem Umbruch kann ein Absatz kürzer sein. Einen angeschnittenen Absatz anteilig im Blick halten.
  const abgeschnitten = position && abstand < 0 ? -abstand / position.height : 0;
  const scrollTop = verlauf.scrollTop;
  return () => {
    if (amEnde) verlauf.scrollTop = verlauf.scrollHeight;
    else if (anker && verlauf.contains(anker)) {
      const neu = anker.getBoundingClientRect();
      const zielAbstand = abgeschnitten ? -neu.height * abgeschnitten : abstand;
      verlauf.scrollTop += neu.top - verlauf.getBoundingClientRect().top - zielAbstand;
    } else verlauf.scrollTop = scrollTop;
  };
}

/** Was gerade offen ist – wird beim Senden frisch gelesen */
export function aktuellerKontext(pfad: string, suche: string, markiert: string | null): KontextEingabe {
  const k = kontextAusPfad(pfad, new URLSearchParams(suche));
  const zustand = studioZustand();
  let zweite: KontextEingabe["zweite"] = null;
  try {
    const a = aufteilungLesen(window.localStorage.getItem(AUFTEILUNG_SCHLUESSEL));
    if (a) {
      const [p, q] = a.href.split("?");
      const z = kontextAusPfad(p, new URLSearchParams(q ?? ""));
      if (z.objekt) zweite = { ...z.objekt, seite: z.objekt.art === "pdf" ? Number(new URLSearchParams(q ?? "").get("seite")) || null : null };
    }
  } catch {
    // ohne Speicher keine zweite Ansicht
  }
  return {
    ...k,
    seite: k.objekt?.art === "pdf" && zustand.pdf?.id === k.objekt.id ? zustand.pdf.seite : null,
    zweite,
    karte: k.hub === "karteikarten" && zustand.karte ? { vorderseite: zustand.karte.vorderseite, rueckseite: zustand.karte.rueckseite } : null,
    markiert,
  };
}

/**
 * UniVerse Studio: EIN Chat für die ganze App. Öffnet per Strg+J (⌘J) als Leiste rechts –
 * die Arbeitsfläche rückt zur Seite. Im Vollbild bleibt dieselbe Chat-Komponente geöffnet.
 */
export function AssistentStarter() {
  const pfad = usePathname();
  const suche = useSearchParams();
  const router = useRouter();
  const [ansicht, setAnsicht] = useState<"zu" | "chat" | "quelle">("zu");
  const [markiert, setMarkiert] = useState<string | null>(null);
  const [ablageKontext, setAblageKontext] = useState<Pick<KontextEingabe, "material" | "crashkursFachId">>({});
  const [startFrage, setStartFrage] = useState<{ text: string; nr: number } | null>(null);
  /** Privater Chat: Studio lernt nichts aus diesem Gespräch (gilt bis zum Neuladen) */
  const [privat, setPrivat] = useState(false);
  const [wunschbreite, setWunschbreite] = useState(wunschbreiteLesen);
  const [ziehbreite, setZiehbreite] = useState<number | null>(null);
  const [vollbild, setVollbild] = useState(false);
  const panel = useRef<HTMLDialogElement>(null);
  const breitenmenue = useRef<HTMLDetailsElement>(null);
  const ausloeser = useRef<HTMLElement | null>(null);
  const scrollWiederherstellen = useRef<(() => void) | null>(null);
  const letzteVollbildPosition = useRef<(() => void) | null>(null);
  const zug = useRef<{ zeiger: number; startX: number; startBreite: number; breite: number } | null>(null);
  const eingebettet = istEingebettet();
  const chatEingebunden = ansicht !== "zu" && !eingebettet && !pfad.startsWith("/assistent");
  const sichtbar = chatEingebunden && ansicht === "chat";
  const groesseAbonnieren = useCallback((aktualisieren: () => void) => {
    const groesseGeaendert = () => {
      const dialog = panel.current;
      if (dialog?.open && !vollbild) {
        const warModal = dialog.matches(":modal");
        const wirdModal = maximalbreite() < STUDIO_BREITE.schmal;
        if (warModal !== wirdModal && !scrollWiederherstellen.current) {
          scrollWiederherstellen.current =
            (warModal && letzteVollbildPosition.current) || scrollpositionMerken(verlaufIm(dialog));
        }
      }
      aktualisieren();
    };

    const beobachter = new ResizeObserver(groesseGeaendert);
    const spalten = pfad.startsWith("/einstellungen") ? SPALTEN : ".dashboard > .rail";
    document.querySelectorAll(spalten).forEach((spalte) => beobachter.observe(spalte));
    window.addEventListener("resize", groesseGeaendert);
    return () => {
      beobachter.disconnect();
      window.removeEventListener("resize", groesseGeaendert);
    };
  }, [pfad, vollbild]);
  const maximum = useSyncExternalStore(groesseAbonnieren, maximalbreite, serverMaximalbreite);
  const platzZumAndocken = maximum >= STUDIO_BREITE.schmal;
  const alsVollbild = vollbild || !platzZumAndocken;
  const breite = studioBreiteBegrenzen(ziehbreite ?? wunschbreite, maximum);

  const schliessen = useCallback(() => {
    panel.current?.close();
    ausloeser.current?.focus({ preventScroll: true });
    setAnsicht("zu");
    setVollbild(false);
    setAblageKontext({});
    zug.current = null;
    setZiehbreite(null);
    scrollWiederherstellen.current = null;
    letzteVollbildPosition.current = null;
  }, []);

  const umschalten = useCallback((weg: string) => {
    if (ansicht === "chat") {
      schliessen();
      return;
    }
    // Markierung und Auslöser vor dem Fokuswechsel ins Eingabefeld merken.
    ausloeser.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (ansicht === "zu") setMarkiert(markierterText() || null);
    track("ki_assistent_geoeffnet", { weg });
    setAnsicht("chat");
  }, [ansicht, schliessen]);

  const vollbildSetzen = useCallback((neu: boolean) => {
    scrollWiederherstellen.current = scrollpositionMerken(verlaufIm(panel.current));
    setVollbild(neu);
    track("studio_groesse", { vollbild: neu });
  }, []);

  function breiteSpeichern(wert: number) {
    const neu = studioBreiteBegrenzen(wert, maximum);
    setWunschbreite(neu);
    try {
      localStorage.setItem(BREITE_SCHLUESSEL, String(neu));
    } catch {
      // Ohne Speicher gilt die gewählte Breite bis zum Neuladen.
    }
  }

  function ziehenAbbrechen(zeiger: number) {
    if (zug.current?.zeiger !== zeiger) return;
    zug.current = null;
    setZiehbreite(null);
  }

  const ziehgriffAnbinden = useCallback((griff: HTMLDivElement | null) => {
    if (!griff) return;
    return () => {
      // Bei einem Ansichtswechsel verschwindet der Griff vor pointercancel oder lostpointercapture.
      if (!zug.current) return;
      zug.current = null;
      setZiehbreite(null);
    };
  }, []);

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        // In der zweiten Ansicht (iframe) öffnet das Hauptfenster das Studio
        if (eingebettet) window.parent.postMessage({ typ: NACHRICHT }, window.location.origin);
        else umschalten("tastatur");
      } else if (e.key === "Escape" && sichtbar && !alsVollbild && !e.defaultPrevented) {
        schliessen();
      }
    };
    const oeffnen = (e: Event) => {
      const detail = (e as CustomEvent<{ frage?: string | null; kontext?: typeof ablageKontext }>).detail;
      setAblageKontext(detail?.kontext ?? {});
      const frage = detail?.frage;
      if (frage) setStartFrage({ text: frage, nr: Date.now() });
      if (ansicht !== "chat") umschalten("hinweis");
    };
    const nachricht = (e: MessageEvent) => {
      if (e.origin === window.location.origin && (e.data as { typ?: string })?.typ === NACHRICHT) umschalten("zweite_ansicht");
    };
    const quelleOeffnen = (e: Event) => {
      if (!sichtbar || !alsVollbild) return;
      const href = (e as CustomEvent<{ href?: unknown }>).detail?.href;
      if (!istAppPfad(href)) return;
      if (platzZumAndocken) {
        vollbildSetzen(false);
      } else {
        // In einer schmalen Ansicht öffnet die Quelle im Hauptbereich. Studio bleibt im Hintergrund eingebunden.
        e.preventDefault();
        scrollWiederherstellen.current = scrollpositionMerken(verlaufIm(panel.current));
        setAnsicht("quelle");
        setVollbild(false);
        router.push(href);
      }
    };
    window.addEventListener("keydown", taste);
    window.addEventListener(STUDIO_OEFFNEN, oeffnen);
    window.addEventListener("message", nachricht);
    window.addEventListener(OEFFNEN_EREIGNIS, quelleOeffnen, true);
    return () => {
      window.removeEventListener("keydown", taste);
      window.removeEventListener(STUDIO_OEFFNEN, oeffnen);
      window.removeEventListener("message", nachricht);
      window.removeEventListener(OEFFNEN_EREIGNIS, quelleOeffnen, true);
    };
  }, [alsVollbild, ansicht, eingebettet, platzZumAndocken, router, schliessen, sichtbar, umschalten, vollbildSetzen]);

  useLayoutEffect(() => {
    if (!sichtbar) return;
    const html = document.documentElement;
    html.toggleAttribute("data-studio-vollbild", alsVollbild);
    html.toggleAttribute("data-studio-offen", !alsVollbild);
    if (!alsVollbild) html.style.setProperty("--studio-breite", `${breite}px`);
    return () => {
      html.style.removeProperty("--studio-breite");
      html.removeAttribute("data-studio-vollbild");
      html.removeAttribute("data-studio-offen");
    };
  }, [alsVollbild, breite, sichtbar]);

  useLayoutEffect(() => {
    const dialog = panel.current;
    if (!dialog) return;
    if (!sichtbar) {
      dialog.close();
      return;
    }
    const fokus = document.activeElement;
    const imPanel = fokus instanceof HTMLElement && dialog.contains(fokus);
    if (dialog.open) dialog.close();
    if (alsVollbild) dialog.showModal();
    else dialog.show();
    if (imPanel && fokus.getClientRects().length) fokus.focus({ preventScroll: true });
    scrollWiederherstellen.current?.();
    scrollWiederherstellen.current = null;
    letzteVollbildPosition.current = alsVollbild ? scrollpositionMerken(verlaufIm(dialog)) : null;
  }, [alsVollbild, sichtbar]);

  if (!chatEingebunden) return null;

  const kontext = { ...aktuellerKontext(pfad, suche.toString(), markiert), ...ablageKontext };

  // Direkt an <body>, damit keine Seitenebene (Seitenleiste, Dashboard) darüber liegt
  return createPortal(
    <dialog
      ref={panel}
      className="ki-panel studio-panel"
      aria-label={STUDIO_NAME}
      data-vollbild={alsVollbild ? "" : undefined}
      onScrollCapture={(e) => {
        if (
          alsVollbild && !vollbild && maximalbreite() < STUDIO_BREITE.schmal &&
          e.target instanceof HTMLElement && e.target.matches(".ki-chat-verlauf")
        ) {
          letzteVollbildPosition.current = scrollpositionMerken(e.target);
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        if (platzZumAndocken) vollbildSetzen(false);
        else schliessen();
      }}
    >
      {!alsVollbild && (
        <div
          ref={ziehgriffAnbinden}
          className="studio-trenner"
          role="separator"
          tabIndex={0}
          aria-label="Breite von UniVerse Studio ändern"
          aria-controls="studio-chat"
          aria-orientation="vertical"
          aria-valuemin={STUDIO_BREITE.schmal}
          aria-valuemax={maximum}
          aria-valuenow={breite}
          aria-valuetext={`${breite} Pixel`}
          title="Breite ändern (ziehen oder Pfeiltasten)"
          onPointerDown={(e) => {
            if (e.button !== 0 || zug.current) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            zug.current = { zeiger: e.pointerId, startX: e.clientX, startBreite: breite, breite };
          }}
          onPointerMove={(e) => {
            const start = zug.current;
            if (start?.zeiger !== e.pointerId) return;
            start.breite = studioBreiteBegrenzen(start.startBreite + start.startX - e.clientX, maximum);
            setZiehbreite(start.breite);
          }}
          onPointerUp={(e) => {
            if (zug.current?.zeiger !== e.pointerId) return;
            if (zug.current.startBreite !== zug.current.breite) breiteSpeichern(zug.current.breite);
            zug.current = null;
            setZiehbreite(null);
          }}
          onPointerCancel={(e) => ziehenAbbrechen(e.pointerId)}
          onLostPointerCapture={(e) => ziehenAbbrechen(e.pointerId)}
          onDoubleClick={() => breiteSpeichern(STUDIO_BREITE.standard)}
          onKeyDown={(e) => {
            const grenzen: Record<string, number> = {
              ArrowLeft: breite + BREITE_SCHRITT,
              ArrowRight: breite - BREITE_SCHRITT,
              Home: STUDIO_BREITE.schmal,
              End: maximum,
            };
            if (!Object.hasOwn(grenzen, e.key)) return;
            e.preventDefault();
            breiteSpeichern(grenzen[e.key]);
          }}
        />
      )}
      <div className="ki-panel-kopf">
        <h2>
          <Icon name="studio" />
          {STUDIO_NAME}
        </h2>
        <span className="ki-panel-knoepfe">
          <button
            type="button"
            className="knopf leise klein nur-symbol"
            title="Neuer Chat (Studio behält, was es über dich weiß)"
            aria-label="Neuer Chat"
            onClick={() => {
              window.dispatchEvent(new Event(STUDIO_NEU));
              track("studio_neuer_chat");
            }}
          >
            <Icon name="plus" />
          </button>
          <button
            type="button"
            className="knopf leise klein nur-symbol"
            aria-pressed={privat}
            aria-label="Privater Chat"
            title={privat ? "Privater Chat: Studio lernt nichts aus diesem Gespräch. Klicken zum Beenden." : "Privater Chat: Studio lernt nichts aus diesem Gespräch"}
            onClick={() => setPrivat((p) => !p)}
          >
            <Icon name="privat" />
          </button>
          {!alsVollbild && (
            <details
              ref={breitenmenue}
              className="studio-breitenmenue"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.open = false;
              }}
              onKeyDown={(e) => {
                if (e.key !== "Escape" || !e.currentTarget.open) return;
                e.preventDefault();
                e.currentTarget.open = false;
                e.currentTarget.querySelector("summary")?.focus();
              }}
            >
              <summary className="knopf leise klein nur-symbol" aria-label="Studio-Breite wählen" title="Studio-Breite wählen">
                <Icon name="mehr" />
              </summary>
              <div className="studio-breitenwahl">
                {([["Schmal", STUDIO_BREITE.schmal], ["Standard", STUDIO_BREITE.standard], ["Breit", maximum]] as const).map(([name, wert]) => (
                  <button key={name} type="button" className="knopf leise klein" onClick={() => {
                    breiteSpeichern(wert);
                    if (breitenmenue.current) breitenmenue.current.open = false;
                    breitenmenue.current?.querySelector("summary")?.focus();
                  }}>
                    {name}
                  </button>
                ))}
              </div>
            </details>
          )}
          {platzZumAndocken && <button
            type="button"
            className="knopf leise klein nur-symbol"
            title={alsVollbild ? "Zurück zur Seitenleiste (Esc)" : "Vollbild öffnen"}
            aria-label={alsVollbild ? "Zurück zur Seitenleiste" : "Vollbild öffnen"}
            onClick={() => vollbildSetzen(!alsVollbild)}
          >
            <Icon name={alsVollbild ? "verkleinern" : "vergroessern"} />
          </button>}
          <button type="button" className="knopf leise klein nur-symbol" aria-label="Studio schließen" title="Schließen (Strg+J)" onClick={schliessen}>
            <Icon name="schliessen" />
          </button>
        </span>
      </div>
      {privat && (
        <p className="studio-privat-hinweis">
          <Icon name="privat" groesse={16} />
          Privater Chat. Studio nutzt, was es weiß, lernt aber nichts Neues.
        </p>
      )}
      <div id="studio-chat" className="studio-chat">
        <AssistentChat
          unterhaltungId={null}
          kontext={kontext}
          kontextHolen={() => ({ ...aktuellerKontext(window.location.pathname, window.location.search.slice(1), markiert), ...ablageKontext })}
          onMarkierungEntfernen={() => setMarkiert(null)}
          startFrage={startFrage}
          privat={privat}
        />
      </div>
    </dialog>,
    document.body,
  );
}
