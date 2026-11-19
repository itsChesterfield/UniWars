"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { materialGeoeffnet } from "@/lib/dateiablage/material-aktivitaet";
import { allesSuchen, zuletztSichtbareTreffer } from "@/app/(hubs)/suche-actions";
import { notizAnlegen } from "@/app/(hubs)/notizen/actions";
import { stapelAnlegen } from "@/app/(hubs)/karteikarten/actions";
import { whiteboardAnlegen } from "@/app/(hubs)/whiteboard/actions";
import { mindmapAnlegen } from "@/app/(hubs)/mindmap/actions";
import { dokumentAnlegen } from "@/app/(hubs)/textverarbeitung/actions";
import { tabelleAnlegen } from "@/app/(hubs)/tabellen/actions";
import { praesentationAnlegen } from "@/app/(hubs)/praesentationen/actions";
import { createTodo } from "@/app/todo/actions";
import { SCHNELL_ERFASSEN, type QuickAddModus } from "@/components/quick-add";
import { absichtErkennen, bewertung, ERSTELLEN, type ErstellArt, type SuchTreffer } from "@/lib/befehle";
import { BEREICHE } from "@/lib/dashboard-bereiche";
import { WEITERE_HUBS } from "@/lib/hubs/navigation";
import { inZweiterAnsichtOeffnen, istEingebettet } from "@/lib/geteilte-ansicht";
import { studioOeffnen } from "@/lib/ki/studio-kontext";
import { fehlerMelden, track } from "@/lib/analytics";
import { DESIGN_NAMEN, THEMES, type Theme } from "@/lib/personalisierung";
import { designWaehlen, usePersoenlich } from "@/lib/personalisierung-store";

/** Ereignis: Befehlspalette öffnen (z. B. Knopf in der Seitenleiste) */
export const BEFEHLE_OEFFNEN = "uniwars-befehle-oeffnen";
const NACHRICHT = "uniwars-befehle-umschalten";
const ZULETZT_SCHLUESSEL = "uniwars-befehle-zuletzt-v1-v2";

export function befehleOeffnen() {
  window.dispatchEvent(new CustomEvent(BEFEHLE_OEFFNEN));
}

type Eintrag = {
  schluessel: string;
  gruppe: "Zuletzt" | "Erstellen" | "Öffnen" | "Einstellen" | "Gefunden" | "In PDFs" | "KI";
  icon: string;
  titel: string;
  info?: string;
  /** Treffer, die sich auch daneben (geteilte Ansicht) öffnen lassen */
  href?: string;
  treffer?: SuchTreffer;
  ausfuehren: (daneben: boolean) => void | Promise<void>;
};

const SEITEN: { name: string; href: string; icon: string; woerter?: string }[] = [
  { name: "Zentraler Hub", href: "/", icon: "🏠", woerter: "dashboard start übersicht home" },
  ...BEREICHE.filter((b) => b.href !== "/").map((b) => ({ name: b.name, href: b.href, icon: "📌", woerter: b.untertitel })),
  ...WEITERE_HUBS.filter((h) => h.href).map((h) => ({ name: h.name, href: h.href!, icon: "🧩" })),
  { name: "Einstellungen", href: "/einstellungen", icon: "⚙️", woerter: "profil konto passwort e-mail abmelden" },
  { name: "Personalisierung", href: "/einstellungen/personalisierung", icon: "⚙️", woerter: "design aussehen symbolleiste schrift dichte bewegung theme" },
  { name: "Was Studio über dich weiß", href: "/einstellungen/gedaechtnis", icon: "🧠", woerter: "gedächtnis über mich wissen persönlich kennenlernen wissensstand" },
];

const ICONS: Record<string, string> = {
  Termine: "📅",
  Aufgaben: "✅",
  Noten: "💯",
  Fortschritt: "📈",
  Fächer: "📚",
  Dateiablage: "🗄️",
  Notizen: "📝",
  Karteikarten: "🗂️",
  "PDF Reader": "📕",
  Lernraum: "🎓",
  "Work Station": "⏱️",
  MindMap: "🧠",
  Whiteboard: "🖍️",
  Literaturverwaltung: "📚",
  Textverarbeitung: "📄",
  Präsentationen: "🖥️",
  Tabellen: "📊",
  Transkription: "🎙️",
  Chat: "💬",
};

const SCHNELL: ErstellArt[] = ["abgabe", "pruefung", "todo", "notiz", "stapel", "quiz"];

/**
 * Strg/⌘+O: eine Suchleiste für alles – Bereiche öffnen, PDFs/Notizen/Stapel … finden (auch im Text der PDFs),
 * Deadlines, Prüfungen, To-dos, Notizen, Whiteboards … erstellen. Strg+J bleibt die KI.
 */
export function Befehlspalette({ userId, kiVerfuegbar, theme = "HELL" }: { userId: string; kiVerfuegbar: boolean; theme?: Theme }) {
  const router = useRouter();
  const design = usePersoenlich("theme", theme);
  const [offen, setOffen] = useState(false);
  const [q, setQ] = useState("");
  const [gefunden, setGefunden] = useState<{ fuer: string; liste: SuchTreffer[] }>({ fuer: "", liste: [] });
  const [laedt, setLaedt] = useState(false);
  const [aktiv, setAktiv] = useState(0);
  const [beschaeftigt, setBeschaeftigt] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [zuletzt, setZuletzt] = useState<SuchTreffer[]>([]);
  const eingabe = useRef<HTMLInputElement>(null);
  const liste = useRef<HTMLDivElement>(null);
  const eingebettet = istEingebettet();

  const schliessen = useCallback(() => {
    setOffen(false);
    setQ("");
    setFehler(null);
    setBeschaeftigt(null);
  }, []);

  const oeffnen = useCallback(() => {
    try {
      const roh = window.localStorage.getItem(ZULETZT_SCHLUESSEL);
      setZuletzt([]);
      if (roh) void zuletztSichtbareTreffer(JSON.parse(roh)).then(setZuletzt).catch(() => setZuletzt([]));
    } catch {
      setZuletzt([]);
    }
    setAktiv(0);
    setOffen(true);
    track("befehle_geoeffnet");
  }, []);

  // Strg/⌘+O überall; in der zweiten Ansicht öffnet das Hauptfenster die Palette
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        if (eingebettet) window.parent.postMessage({ typ: NACHRICHT }, window.location.origin);
        else if (offen) schliessen();
        else oeffnen();
      }
    };
    const nachricht = (e: MessageEvent) => {
      if (e.origin === window.location.origin && (e.data as { typ?: string })?.typ === NACHRICHT) oeffnen();
    };
    window.addEventListener("keydown", taste);
    window.addEventListener(BEFEHLE_OEFFNEN, oeffnen);
    window.addEventListener("message", nachricht);
    return () => {
      window.removeEventListener("keydown", taste);
      window.removeEventListener(BEFEHLE_OEFFNEN, oeffnen);
      window.removeEventListener("message", nachricht);
    };
  }, [eingebettet, offen, oeffnen, schliessen]);

  useEffect(() => {
    if (offen) eingabe.current?.focus();
  }, [offen]);

  // Daten suchen (kurz verzögert)
  useEffect(() => {
    const suche = q.trim();
    if (!offen || suche.length < 2) return;
    const id = window.setTimeout(() => {
      setLaedt(true);
      allesSuchen(suche)
        .then((liste) => setGefunden({ fuer: suche, liste }))
        .catch((err) => fehlerMelden(err, { ort: "befehle_suche" }))
        .finally(() => setLaedt(false));
    }, 160);
    return () => window.clearTimeout(id);
  }, [q, offen]);

  const gehe = useCallback(
    (href: string, daneben: boolean) => {
      if (daneben) inZweiterAnsichtOeffnen(href, "rechts");
      else router.push(href);
    },
    [router],
  );

  const merken = useCallback((t: SuchTreffer) => {
    if (t.art === "datei") materialGeoeffnet(userId, `datei:${t.id}`);
    try {
      const roh = window.localStorage.getItem(ZULETZT_SCHLUESSEL);
      const alt = roh ? JSON.parse(roh) as { art: string; id: string; seite?: number }[] : [];
      const [pfad, query] = t.href.split("?");
      const neu = t.art === "fundstelle"
        ? { art: t.art, id: pfad.split("/").at(-1), seite: Number(new URLSearchParams(query).get("seite")) }
        : { art: t.art, id: t.id };
      window.localStorage.setItem(ZULETZT_SCHLUESSEL, JSON.stringify([
        neu, ...alt.filter((x) => x.art !== neu.art || x.id !== neu.id || x.seite !== neu.seite),
      ].slice(0, 6)));
    } catch {
      // ohne Speicher keine „Zuletzt“-Liste
    }
  }, [userId]);

  /** Etwas erstellen – direkt anlegen und öffnen oder „Schnell erfassen“ vorbefüllt öffnen */
  const erstellen = useCallback(
    async (art: ErstellArt, titel: string, daneben: boolean) => {
      const quick = (modus: QuickAddModus) => {
        schliessen();
        window.dispatchEvent(new CustomEvent(SCHNELL_ERFASSEN, { detail: { modus, titel } }));
      };
      track("befehle_erstellt", { art });
      switch (art) {
        case "abgabe":
        case "deadline":
          return quick("ABGABE");
        case "termin":
          return quick("TERMIN");
        case "gruppenarbeit":
          return quick("GRUPPENARBEIT");
        case "pruefung":
          return quick("PRUEFUNG");
        case "fach":
          return quick("FACH");
        case "note":
          return quick("NOTE");
        case "quiz":
          schliessen();
          return gehe("/karteikarten?neu=quiz", daneben);
        case "podcast":
          schliessen();
          return gehe("/transkription?neu=podcast", daneben);
        case "aufnahme":
          schliessen();
          return gehe("/transkription", daneben);
      }
      setBeschaeftigt(art);
      setFehler(null);
      try {
        let href = "/";
        if (art === "todo") {
          if (!titel) {
            setBeschaeftigt(null);
            setFehler("Schreib den To-do-Titel dazu, z. B. „todo Bücher zurückgeben“.");
            return;
          }
          await createTodo({ titel: titel.slice(0, 300), fach_id: null, prioritaet: "MITTEL" });
          router.refresh();
          schliessen();
          return;
        }
        if (art === "notiz") href = `/notizen?id=${(await notizAnlegen(null, "leer", titel || undefined)).id}`;
        if (art === "stapel") href = `/karteikarten/${(await stapelAnlegen(titel || "Neuer Stapel", null)).id}`;
        if (art === "whiteboard") href = `/whiteboard/${await whiteboardAnlegen(null, titel || undefined)}`;
        if (art === "mindmap") href = `/mindmap/${await mindmapAnlegen(null, titel || undefined)}`;
        if (art === "dokument") href = `/textverarbeitung/${await dokumentAnlegen(null)}`;
        if (art === "tabelle") href = `/tabellen/${await tabelleAnlegen(null)}`;
        if (art === "praesentation") href = `/praesentationen/${await praesentationAnlegen(null)}`;
        schliessen();
        gehe(href, daneben);
      } catch (err) {
        fehlerMelden(err, { ort: "befehle_erstellen", art });
        setFehler("Das hat nicht geklappt. Bitte versuch es noch einmal.");
        setBeschaeftigt(null);
      }
    },
    [gehe, router, schliessen],
  );

  const eintraege = useMemo<Eintrag[]>(() => {
    const suche = q.trim();
    const liste: Eintrag[] = [];
    const trefferEintrag = (t: SuchTreffer, gruppe: Eintrag["gruppe"]): Eintrag => ({
      schluessel: `${gruppe}-${t.art}-${t.id}`,
      gruppe,
      icon: t.icon,
      titel: t.titel,
      info: t.info,
      href: t.href,
      treffer: t,
      ausfuehren: (daneben) => {
        merken(t);
        schliessen();
        gehe(t.href, daneben);
      },
    });
    const erstellEintrag = (art: ErstellArt, titel: string): Eintrag => {
      const e = ERSTELLEN.find((x) => x.art === art)!;
      return {
        schluessel: `neu-${art}-${titel}`,
        gruppe: "Erstellen",
        icon: e.icon,
        titel: titel ? `${e.name}: „${titel}“` : `${e.name} erstellen`,
        info: titel ? "erstellen" : undefined,
        ausfuehren: (daneben) => erstellen(art, titel, daneben),
      };
    };
    const seitenEintrag = (s: (typeof SEITEN)[number]): Eintrag => ({
      schluessel: `seite-${s.href}`,
      gruppe: "Öffnen",
      icon: ICONS[s.name] ?? s.icon,
      titel: s.name,
      info: "Bereich",
      href: s.href,
      ausfuehren: (daneben) => {
        schliessen();
        gehe(s.href, daneben);
      },
    });

    // Personalisierung: Design wechseln (DESIGN.md Abschnitt 6)
    const einstellen: (Eintrag & { woerter: string })[] = [
      ...THEMES.filter((t) => t !== design).map((t) => ({
        schluessel: `design-${t}`,
        gruppe: "Einstellen" as const,
        icon: "🎨",
        titel: `${DESIGN_NAMEN[t]} verwenden`,
        info: "Design",
        woerter: `design theme aussehen ${t === "DUNKEL" ? "dunkel nacht" : t === "HELL" ? "hell weiß" : "system automatisch gerät"}`,
        ausfuehren: async () => {
          schliessen();
          track("theme_gewechselt", { theme: t, ort: "befehlspalette" });
          await designWaehlen(t);
        },
      })),
    ];

    if (!suche) {
      for (const t of zuletzt) liste.push(trefferEintrag(t, "Zuletzt"));
      for (const a of SCHNELL) liste.push(erstellEintrag(a, ""));
      for (const s of SEITEN) liste.push(seitenEintrag(s));
      liste.push(...einstellen);
      return liste;
    }

    // 1. Ausdrücklich erstellen („neue Notiz …“, „klausur Mathe am 3.2.“)
    const absicht = absichtErkennen(suche);
    if (absicht) liste.push(erstellEintrag(absicht.art, absicht.titel));

    // 2. Bereiche
    const seiten = SEITEN.map((s) => ({ s, p: Math.max(bewertung(s.name, suche), s.woerter ? bewertung(s.woerter, suche) * 0.6 : 0) }))
      .filter((x) => x.p > 0)
      .sort((a, b) => b.p - a.p)
      .slice(0, 5);
    // 3. Gefundene Daten (Fundstellen in PDFs getrennt)
    const daten = gefunden.fuer === suche ? gefunden.liste : [];
    const objekte = daten
      .filter((t) => t.art !== "fundstelle")
      .map((t) => ({ t, p: bewertung(t.titel, suche) || 20 }))
      .sort((a, b) => b.p - a.p)
      .slice(0, 12);
    const fundstellen = daten.filter((t) => t.art === "fundstelle").slice(0, 5);

    // beste Bereichstreffer vor den Daten, wenn sie sehr gut passen
    const besteSeite = seiten[0]?.p ?? 0;
    if (besteSeite >= 80) for (const x of seiten) liste.push(seitenEintrag(x.s));
    for (const x of objekte) liste.push(trefferEintrag(x.t, "Gefunden"));
    if (besteSeite < 80) for (const x of seiten) liste.push(seitenEintrag(x.s));
    liste.push(...einstellen.filter((e) => Math.max(bewertung(e.titel, suche), bewertung(e.woerter, suche) * 0.6) >= 35));
    for (const t of fundstellen) liste.push(trefferEintrag(t, "In PDFs"));

    // 4. Erstellen-Befehle, die zum Suchwort passen („whiteboard“ → Whiteboard erstellen)
    if (!absicht) {
      const passend = ERSTELLEN.filter((e) => bewertung(e.name, suche) >= 60 || e.woerter.some((w) => bewertung(w, suche) >= 80));
      for (const e of passend.slice(0, 3)) liste.push(erstellEintrag(e.art, ""));
      // Freitext als neuer Eintrag
      if (suche.length >= 3 && !passend.length) {
        liste.push(erstellEintrag("abgabe", suche));
        liste.push(erstellEintrag("todo", suche));
        liste.push(erstellEintrag("notiz", suche));
      }
    }

    // 5. KI fragen
    if (kiVerfuegbar) {
      liste.push({
        schluessel: "ki",
        gruppe: "KI",
        icon: "✨",
        titel: `UniVerse Studio fragen: „${suche}“`,
        info: "Strg J",
        ausfuehren: () => {
          schliessen();
          studioOeffnen(suche);
        },
      });
    }
    return liste;
  }, [q, gefunden, zuletzt, kiVerfuegbar, erstellen, gehe, merken, schliessen, design]);

  const aktivIndex = Math.min(aktiv, Math.max(0, eintraege.length - 1));

  useEffect(() => {
    liste.current?.querySelector(`[data-index="${aktivIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [aktivIndex]);

  if (!offen) return null;

  function tasten(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAktiv((i) => (Math.min(i, eintraege.length - 1) + 1) % Math.max(1, eintraege.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAktiv((i) => (Math.min(i, eintraege.length - 1) - 1 + eintraege.length) % Math.max(1, eintraege.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const ziel = eintraege[aktivIndex];
      if (ziel && !beschaeftigt) void ziel.ausfuehren(e.ctrlKey || e.metaKey);
    } else if (e.key === "Escape") {
      e.preventDefault();
      schliessen();
    }
  }

  let letzteGruppe = "";
  // Direkt an <body>: sonst liegt die Palette in der Ebene der Seitenleiste und Dashboard-Elemente überdecken sie
  return createPortal(
    <div className="bp-hintergrund" onMouseDown={(e) => e.target === e.currentTarget && schliessen()}>
      <div className="bp-fenster" role="dialog" aria-modal="true" aria-label="Suchen, öffnen, erstellen">
        <div className="bp-eingabe">
          <span aria-hidden>🔍</span>
          <input
            ref={eingabe}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setAktiv(0);
              setFehler(null);
            }}
            onKeyDown={tasten}
            placeholder="Suchen, öffnen oder erstellen … (z. B. „neue Notiz Statistik“)"
            aria-label="Suchen, öffnen oder erstellen"
            aria-controls="bp-liste"
            aria-activedescendant={eintraege[aktivIndex] ? `bp-${aktivIndex}` : undefined}
            role="combobox"
            aria-expanded
            autoComplete="off"
            spellCheck={false}
          />
          {laedt && <span className="bp-laedt" aria-label="Sucht …" />}
          <kbd>Esc</kbd>
        </div>
        {fehler && <p className="auth-error bp-fehler">{fehler}</p>}
        <div className="bp-liste" id="bp-liste" role="listbox" ref={liste}>
          {eintraege.length === 0 && <p className="faint bp-leer">{laedt ? "Suche …" : "Nichts gefunden."}</p>}
          {eintraege.map((e, i) => {
            const kopf = e.gruppe !== letzteGruppe ? e.gruppe : null;
            letzteGruppe = e.gruppe;
            return (
              <div key={e.schluessel}>
                {kopf && <div className="bp-gruppe">{kopf}</div>}
                <button
                  type="button"
                  id={`bp-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === aktivIndex}
                  className={`bp-eintrag ${i === aktivIndex ? "aktiv" : ""}`}
                  onMouseMove={() => i !== aktivIndex && setAktiv(i)}
                  onClick={(ev) => !beschaeftigt && void e.ausfuehren(ev.ctrlKey || ev.metaKey)}
                  disabled={beschaeftigt !== null}
                >
                  <span className="bp-icon" aria-hidden>
                    {e.icon}
                  </span>
                  <span className="bp-text">
                    <span className="bp-titel">{e.titel}</span>
                    {e.info && <span className="bp-info">{e.info}</span>}
                    {e.treffer?.ausschnitt && (
                      <span className="bp-info">
                        {e.treffer.ausschnitt.davor}<mark>{e.treffer.ausschnitt.begriff}</mark>{e.treffer.ausschnitt.danach}
                      </span>
                    )}
                  </span>
                  {i === aktivIndex && <span className="bp-enter">{e.href ? "↵ öffnen" : "↵"}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="bp-fuss faint">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> wählen
          </span>
          <span>
            <kbd>↵</kbd> öffnen
          </span>
          <span>
            <kbd>Strg</kbd>
            <kbd>↵</kbd> daneben öffnen
          </span>
          {kiVerfuegbar && (
            <span>
              <kbd>Strg</kbd>
              <kbd>J</kbd> KI
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
