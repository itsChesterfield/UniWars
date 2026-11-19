"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { AssistentChat } from "@/components/assistent/assistent-chat";
import { kontextAusPfad, type KontextEingabe } from "@/lib/ki/assistent";
import { aufteilungLesen, istEingebettet } from "@/lib/geteilte-ansicht";
import { markierterText, STUDIO_NEU, STUDIO_OEFFNEN, studioZustand } from "@/lib/ki/studio-kontext";
import { STUDIO_NAME } from "@/lib/ki/studio";
import { track } from "@/lib/analytics";
import { Icon } from "@/components/nav-icon";

const AUFTEILUNG_SCHLUESSEL = "uniwars-geteilte-ansicht-v1";
const NACHRICHT = "uniwars-studio-umschalten";

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
 * der Inhalt rückt zur Seite. Ohne eigenen Knopf; markierter Text wird mitgenommen.
 */
export function AssistentStarter() {
  const pfad = usePathname();
  const suche = useSearchParams();
  const [offen, setOffen] = useState(false);
  const [markiert, setMarkiert] = useState<string | null>(null);
  const [ablageKontext, setAblageKontext] = useState<Pick<KontextEingabe, "material" | "crashkursFachId">>({});
  const [startFrage, setStartFrage] = useState<{ text: string; nr: number } | null>(null);
  /** Privater Chat: Studio lernt nichts aus diesem Gespräch (gilt bis zum Neuladen) */
  const [privat, setPrivat] = useState(false);
  /** Große Ansicht (breite Leiste) – auf diesem Gerät gemerkt */
  const [gross, setGross] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        setGross(window.localStorage.getItem("uniwars-studio-gross") === "1");
      } catch {
        // egal
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-studio-gross", gross);
    return () => document.documentElement.removeAttribute("data-studio-gross");
  }, [gross]);
  const eingebettet = istEingebettet();

  const umschalten = useCallback((weg: string) => {
    setOffen((o) => {
      if (!o) {
        // Markierung VOR dem Fokuswechsel ins Eingabefeld merken
        setMarkiert(markierterText() || null);
        track("ki_assistent_geoeffnet", { weg });
      }
      return !o;
    });
  }, []);

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        // In der zweiten Ansicht (iframe) öffnet das Hauptfenster das Studio
        if (eingebettet) window.parent.postMessage({ typ: NACHRICHT }, window.location.origin);
        else umschalten("tastatur");
      } else if (e.key === "Escape" && offen) {
        setOffen(false);
        setAblageKontext({});
      }
    };
    const oeffnen = (e: Event) => {
      const detail = (e as CustomEvent<{ frage?: string | null; kontext?: typeof ablageKontext }>).detail;
      setAblageKontext(detail?.kontext ?? {});
      const frage = detail?.frage;
      if (frage) setStartFrage({ text: frage, nr: Date.now() });
      if (!offen) umschalten("hinweis");
    };
    const nachricht = (e: MessageEvent) => {
      if (e.origin === window.location.origin && (e.data as { typ?: string })?.typ === NACHRICHT) umschalten("zweite_ansicht");
    };
    window.addEventListener("keydown", taste);
    window.addEventListener(STUDIO_OEFFNEN, oeffnen);
    window.addEventListener("message", nachricht);
    return () => {
      window.removeEventListener("keydown", taste);
      window.removeEventListener(STUDIO_OEFFNEN, oeffnen);
      window.removeEventListener("message", nachricht);
    };
  }, [eingebettet, offen, umschalten]);

  // Inhalt zur Seite rücken, solange das Studio offen ist
  useEffect(() => {
    document.documentElement.toggleAttribute("data-studio-offen", offen);
    return () => document.documentElement.removeAttribute("data-studio-offen");
  }, [offen]);

  if (eingebettet || pfad.startsWith("/assistent") || !offen) return null;

  const kontext = { ...aktuellerKontext(pfad, suche.toString(), markiert), ...ablageKontext };

  // Direkt an <body>, damit keine Seitenebene (Seitenleiste, Dashboard) darüber liegt
  return createPortal(
    <aside className={`ki-panel studio-panel ${gross ? "gross" : ""}`} aria-label={STUDIO_NAME}>
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
          <button
            type="button"
            className="knopf leise klein nur-symbol studio-groesse"
            title={gross ? "Kleiner" : "Größer"}
            aria-label={gross ? "Studio verkleinern" : "Studio vergrößern"}
            aria-pressed={gross}
            onClick={() => {
              const neu = !gross;
              setGross(neu);
              try {
                window.localStorage.setItem("uniwars-studio-gross", neu ? "1" : "0");
              } catch {
                // egal
              }
              track("studio_groesse", { gross: neu });
            }}
          >
            <Icon name={gross ? "verkleinern" : "vergroessern"} />
          </button>
          <button type="button" className="knopf leise klein nur-symbol" aria-label="Studio schließen" title="Schließen (Strg+J)" onClick={() => { setOffen(false); setAblageKontext({}); }}>
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
      <AssistentChat
        unterhaltungId={null}
        kontext={kontext}
        kontextHolen={() => ({ ...aktuellerKontext(window.location.pathname, window.location.search.slice(1), markiert), ...ablageKontext })}
        onMarkierungEntfernen={() => setMarkiert(null)}
        startFrage={startFrage}
        privat={privat}
      />
    </aside>,
    document.body,
  );
}
