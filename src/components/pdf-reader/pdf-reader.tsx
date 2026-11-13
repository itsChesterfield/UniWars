"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import {
  markierungAendern,
  markierungAnlegen,
  markierungLoeschen,
  pdfStandSpeichern,
  type Markierung,
} from "@/app/(hubs)/pdf-reader/actions";
import { fehlerMelden, track } from "@/lib/analytics";
import {
  FARB_INFO,
  istFarbe,
  markierungenAlsText,
  punktTrifft,
  rechteckeAusAuswahl,
  type Farbe,
  type Rechteck,
} from "@/lib/pdf-reader/markierungen";
import { KiPdfLeiste } from "@/components/pdf-reader/ki-pdf-leiste";
import { AuswahlMenue, FarbPunkte, MarkierungMenue, MarkierungsListe, type MenuePosition } from "@/components/pdf-reader/markier-menue";

type Zoom = "breite" | "seite" | number;
type Masse = { breite: number; hoehe: number };
type Treffer = { seite: number; nr: number };
type Erfasst = { seite: number; rechtecke: Rechteck[]; text: string };

const STIFT_SPEICHER = "uniwars-pdf-stift";
const KEINE_MARKIERUNGEN: Markierung[] = [];

function gespeicherteFarbe(): Farbe {
  try {
    const wert = window.localStorage.getItem(STIFT_SPEICHER);
    return istFarbe(wert) ? wert : "GELB";
  } catch {
    return "GELB";
  }
}

/** Position für ein Menü über (oder, wenn oben kein Platz ist, unter) einem Bereich. */
function menuePosition(r: { left: number; top: number; width: number; bottom: number }): MenuePosition {
  const unten = r.top < 120;
  return { x: r.left + r.width / 2, y: unten ? r.bottom + 10 : r.top - 10, unten };
}

const ZOOM_STUFEN = [0.5, 0.75, 1, 1.25, 1.5, 2];
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const SEITEN_ABSTAND = 16;
const RAND = 32;

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

function pdfjsLaden() {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return pdfjs;
  });
  return pdfjsPromise;
}

function vorkommen(text: string, suche: string): number[] {
  const t = text.toLocaleLowerCase("de-DE");
  const positionen: number[] = [];
  if (!suche) return positionen;
  for (let i = t.indexOf(suche); i !== -1; i = t.indexOf(suche, i + suche.length)) positionen.push(i);
  return positionen;
}

export function PdfReader({
  datei,
  url,
  startSeite,
  startLesezeichen,
  startMarkierungen,
  kiVerfuegbar = false,
}: {
  datei: { id: string; name: string };
  url: string;
  startSeite: number;
  startLesezeichen: number[];
  startMarkierungen: Markierung[];
  /** KI-03: Mistral-Key gesetzt → "✨ KI"-Knopf anzeigen */
  kiVerfuegbar?: boolean;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [masse, setMasse] = useState<Masse[]>([]);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [zoom, setZoom] = useState<Zoom>("breite");
  const [flaeche, setFlaeche] = useState<Masse>({ breite: 0, hoehe: 0 });
  const [seite, setSeite] = useState(startSeite);
  const [seiteEingabe, setSeiteEingabe] = useState(String(startSeite));
  const [lesezeichen, setLesezeichen] = useState<number[]>(startLesezeichen);
  const [seitenleiste, setSeitenleiste] = useState(false);
  const [leistenTab, setLeistenTab] = useState<"markierungen" | "lesezeichen">("markierungen");
  const [markierungen, setMarkierungen] = useState<Markierung[]>(startMarkierungen);
  const [stift, setStift] = useState<Farbe | null>(null);
  const [auswahlMenue, setAuswahlMenue] = useState<MenuePosition | null>(null);
  const [aktiv, setAktiv] = useState<{ id: string; pos: MenuePosition } | null>(null);
  const [suchOffen, setSuchOffen] = useState(false);
  const [suchText, setSuchText] = useState("");
  const [gefundeneTreffer, setTreffer] = useState<{ suche: string; liste: Treffer[] }>({ suche: "", liste: [] });
  const [trefferIndex, setTrefferIndex] = useState(0);
  const [sucht, setSucht] = useState(false);
  const [kiOffen, setKiOffen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const seitenRefs = useRef<(HTMLDivElement | null)[]>([]);
  const textCache = useRef<Map<number, string[]>>(new Map());
  const suchFeld = useRef<HTMLInputElement>(null);
  const wiederhergestellt = useRef(false);
  const seiteRef = useRef(startSeite);
  const zeigerUnten = useRef(false);
  const stiftRef = useRef(stift);
  useEffect(() => {
    stiftRef.current = stift;
  }, [stift]);

  // --- Laden -----------------------------------------------------------------
  useEffect(() => {
    let abgebrochen = false;
    let geladen: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const pdfjs = await pdfjsLaden();
        geladen = await pdfjs.getDocument({ url }).promise;
        if (abgebrochen) return;
        const liste: Masse[] = [];
        for (let i = 1; i <= geladen.numPages; i++) {
          const p = await geladen.getPage(i);
          const v = p.getViewport({ scale: 1 });
          liste.push({ breite: v.width, hoehe: v.height });
        }
        if (abgebrochen) return;
        setDoc(geladen);
        setMasse(liste);
        track("pdf_geoeffnet", { seiten: geladen.numPages });
      } catch (err) {
        if (!abgebrochen) {
          setLadeFehler("Die PDF konnte nicht geladen werden.");
          fehlerMelden(err, { ort: "pdf_laden" });
        }
      }
    })();
    return () => {
      abgebrochen = true;
      void geladen?.destroy();
    };
  }, [url]);

  // Größe der Lesefläche für "Seitenbreite" / "Ganze Seite"
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const beobachter = new ResizeObserver(() => setFlaeche({ breite: el.clientWidth, hoehe: el.clientHeight }));
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, []);

  const massstab = useCallback(
    (m: Masse) => {
      if (typeof zoom === "number") return zoom;
      const breite = Math.max(100, flaeche.breite - RAND) / m.breite;
      if (zoom === "breite") return breite;
      return Math.min(breite, Math.max(100, flaeche.hoehe - SEITEN_ABSTAND * 2) / m.hoehe);
    },
    [zoom, flaeche],
  );

  const anzahl = masse.length;

  // --- Navigation ------------------------------------------------------------
  const zuSeite = useCallback(
    (nr: number, verhalten: ScrollBehavior = "auto") => {
      const ziel = Math.min(Math.max(1, nr), Math.max(1, anzahl));
      const el = seitenRefs.current[ziel - 1];
      const container = scrollRef.current;
      if (el && container) container.scrollTo({ top: el.offsetTop - SEITEN_ABSTAND / 2, behavior: verhalten });
      seiteRef.current = ziel;
      setSeite(ziel);
      setSeiteEingabe(String(ziel));
    },
    [anzahl],
  );

  // PDF-05: dort weiterlesen, wo man aufgehört hat
  useEffect(() => {
    if (wiederhergestellt.current || anzahl === 0 || flaeche.breite === 0) return;
    wiederhergestellt.current = true;
    requestAnimationFrame(() => zuSeite(startSeite));
  }, [anzahl, flaeche.breite, startSeite, zuSeite]);

  // Beim Zoomen auf der aktuellen Seite bleiben
  const letzterZoom = useRef(zoom);
  useEffect(() => {
    if (letzterZoom.current === zoom) return;
    letzterZoom.current = zoom;
    const nr = seiteRef.current;
    requestAnimationFrame(() => zuSeite(nr));
  }, [zoom, zuSeite]);

  function beimScrollen() {
    if (auswahlMenue) setAuswahlMenue(null);
    if (aktiv) setAktiv(null);
    const container = scrollRef.current;
    if (!container || anzahl === 0) return;
    const marke = container.scrollTop + container.clientHeight / 3;
    let aktuell = 1;
    for (let i = 0; i < anzahl; i++) {
      const el = seitenRefs.current[i];
      if (el && el.offsetTop <= marke) aktuell = i + 1;
      else break;
    }
    if (aktuell !== seiteRef.current) {
      seiteRef.current = aktuell;
      setSeite(aktuell);
      setSeiteEingabe(String(aktuell));
    }
  }

  // Zuletzt gelesene Seite speichern: kurz nach dem Blättern und beim Schließen
  useEffect(() => {
    if (anzahl === 0) return;
    const id = window.setTimeout(() => {
      pdfStandSpeichern(datei.id, { letzteSeite: seite }).catch(() => undefined);
    }, 1500);
    return () => window.clearTimeout(id);
  }, [seite, anzahl, datei.id]);

  useEffect(() => {
    const speichern = () => {
      void pdfStandSpeichern(datei.id, { letzteSeite: seiteRef.current }).catch(() => undefined);
    };
    window.addEventListener("pagehide", speichern);
    return () => {
      window.removeEventListener("pagehide", speichern);
      speichern();
    };
  }, [datei.id]);

  // --- Zoom (PDF-03) ---------------------------------------------------------
  const aktuellerMassstab = masse[seite - 1] ? massstab(masse[seite - 1]) : 1;
  function zoomSchritt(richtung: 1 | -1) {
    const basis = Math.round(aktuellerMassstab * 4) / 4;
    const neu = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, basis + richtung * 0.25));
    setZoom(neu);
    track("pdf_zoom", { stufe: neu });
  }

  // --- Lesezeichen (PDF-04) --------------------------------------------------
  const istLesezeichen = lesezeichen.includes(seite);
  function lesezeichenUmschalten() {
    const neu = istLesezeichen ? lesezeichen.filter((s) => s !== seite) : [...lesezeichen, seite].sort((a, b) => a - b);
    setLesezeichen(neu);
    track("pdf_lesezeichen", { gesetzt: !istLesezeichen });
    pdfStandSpeichern(datei.id, { lesezeichen: neu }).catch((err) => {
      setLesezeichen(lesezeichen);
      fehlerMelden(err, { ort: "pdf_lesezeichen" });
    });
  }

  // --- Textmarker -------------------------------------------------------------
  const nachSeite = useMemo(() => {
    const map = new Map<number, Markierung[]>();
    for (const m of markierungen) map.set(m.seite, [...(map.get(m.seite) ?? []), m]);
    return map;
  }, [markierungen]);

  /** Liest die aktuelle Textauswahl aus – aufgeteilt auf die betroffenen Seiten. */
  const auswahlErfassen = useCallback((): Erfasst[] => {
    const sel = window.getSelection();
    const flaeche = scrollRef.current;
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !flaeche) return [];
    const range = sel.getRangeAt(0);
    if (!flaeche.contains(range.commonAncestorContainer)) return [];
    const rects = Array.from(range.getClientRects());
    const seiten = seitenRefs.current
      .map((el, i) => ({ el, nr: i + 1 }))
      .filter((s): s is { el: HTMLDivElement; nr: number } => !!s.el && range.intersectsNode(s.el));
    const ergebnis: Erfasst[] = [];
    for (const { el, nr } of seiten) {
      const rechtecke = rechteckeAusAuswahl(rects, el.getBoundingClientRect());
      if (rechtecke.length === 0) continue;
      const text =
        seiten.length === 1
          ? sel.toString()
          : Array.from(el.querySelectorAll<HTMLElement>(".textLayer span:not(.highlight)"))
              .filter((span) => sel.containsNode(span, true))
              .map((span) => span.dataset.text ?? span.textContent ?? "")
              .join(" ");
      ergebnis.push({ seite: nr, rechtecke, text: text.replace(/\s+/g, " ").trim() });
    }
    return ergebnis;
  }, []);

  const markieren = useCallback(
    (farbe: Farbe) => {
      const erfasst = auswahlErfassen();
      window.getSelection()?.removeAllRanges();
      setAuswahlMenue(null);
      if (erfasst.length === 0) return;
      for (const e of erfasst) {
        const temp: Markierung = { id: `neu-${crypto.randomUUID()}`, seite: e.seite, farbe, rechtecke: e.rechtecke, text: e.text, notiz: null };
        setMarkierungen((l) => [...l, temp]);
        markierungAnlegen(datei.id, { seite: e.seite, farbe, rechtecke: e.rechtecke, text: e.text })
          .then((gespeichert) => setMarkierungen((l) => l.map((m) => (m.id === temp.id ? gespeichert : m))))
          .catch((err) => {
            setMarkierungen((l) => l.filter((m) => m.id !== temp.id));
            window.alert("Die Markierung konnte nicht gespeichert werden.");
            fehlerMelden(err, { ort: "pdf_markieren" });
          });
      }
      track("pdf_markiert", { farbe, seiten: erfasst.length, stift: stiftRef.current !== null });
    },
    [auswahlErfassen, datei.id],
  );

  function auswahlPruefen() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setAuswahlMenue(null);
      return;
    }
    if (auswahlErfassen().length === 0) return;
    if (stiftRef.current) {
      markieren(stiftRef.current);
      return;
    }
    setAktiv(null);
    setAuswahlMenue(menuePosition(sel.getRangeAt(0).getBoundingClientRect()));
  }

  // Touch/Tastatur: Auswahl endet ohne pointerup auf der Fläche → kurz nach der letzten Änderung prüfen
  useEffect(() => {
    let id = 0;
    const aenderung = () => {
      window.clearTimeout(id);
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setAuswahlMenue(null);
        return;
      }
      if (zeigerUnten.current) return;
      id = window.setTimeout(() => {
        const s = window.getSelection();
        if (!s || s.isCollapsed || s.rangeCount === 0 || auswahlErfassen().length === 0) return;
        setAktiv(null);
        setAuswahlMenue(menuePosition(s.getRangeAt(0).getBoundingClientRect()));
      }, 450);
    };
    document.addEventListener("selectionchange", aenderung);
    return () => {
      document.removeEventListener("selectionchange", aenderung);
      window.clearTimeout(id);
    };
  }, [auswahlErfassen]);

  // Maus losgelassen (auch außerhalb der Fläche) → Auswahl auswerten
  const auswahlPruefenRef = useRef(auswahlPruefen);
  useEffect(() => {
    auswahlPruefenRef.current = auswahlPruefen;
  });
  useEffect(() => {
    const los = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !zeigerUnten.current) return;
      zeigerUnten.current = false;
      scrollRef.current?.querySelectorAll(".textLayer.selecting").forEach((el) => el.classList.remove("selecting"));
      window.setTimeout(() => auswahlPruefenRef.current(), 0);
    };
    window.addEventListener("pointerup", los);
    return () => window.removeEventListener("pointerup", los);
  }, []);

  // Klick neben die Menüs (Leiste, Seitenleiste …) schließt sie
  const menueOffen = auswahlMenue !== null || aktiv !== null;
  useEffect(() => {
    if (!menueOffen) return;
    const daneben = (e: PointerEvent) => {
      const ziel = e.target as HTMLElement;
      if (ziel.closest(".pdf-markier-menue") || scrollRef.current?.contains(ziel)) return;
      setAuswahlMenue(null);
      setAktiv(null);
    };
    document.addEventListener("pointerdown", daneben);
    return () => document.removeEventListener("pointerdown", daneben);
  }, [menueOffen]);

  /** Klick auf eine bestehende Markierung öffnet ihr Menü. */
  function klickAufSeite(e: React.MouseEvent) {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const seitenEl = (e.target as HTMLElement).closest<HTMLElement>(".pdf-seite");
    const nr = Number(seitenEl?.dataset.seite);
    if (!seitenEl || !nr) {
      setAktiv(null);
      return;
    }
    const box = seitenEl.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    const y = (e.clientY - box.top) / box.height;
    const getroffen = [...(nachSeite.get(nr) ?? [])].reverse().find((m) => punktTrifft(m.rechtecke, x, y));
    if (!getroffen || getroffen.id.startsWith("neu-")) {
      setAktiv(null);
      return;
    }
    setAuswahlMenue(null);
    const [rx, ry, rw] = getroffen.rechtecke[0];
    setAktiv({
      id: getroffen.id,
      pos: menuePosition({ left: box.left + rx * box.width, top: box.top + ry * box.height, width: rw * box.width, bottom: e.clientY + 12 }),
    });
  }

  function markierungAktualisieren(id: string, aenderung: { farbe?: Farbe; notiz?: string | null }) {
    const vorher = markierungen;
    const notiz = aenderung.notiz === undefined ? undefined : aenderung.notiz?.trim() || null;
    setMarkierungen((l) =>
      l.map((m) => (m.id === id ? { ...m, ...(aenderung.farbe ? { farbe: aenderung.farbe } : {}), ...(notiz !== undefined ? { notiz } : {}) } : m)),
    );
    markierungAendern(id, aenderung).catch((err) => {
      setMarkierungen(vorher);
      window.alert("Die Änderung konnte nicht gespeichert werden.");
      fehlerMelden(err, { ort: "pdf_markierung_aendern" });
    });
    track(aenderung.farbe ? "pdf_markierung_farbe" : "pdf_markierung_notiz");
  }

  function markierungEntfernen(m: Markierung) {
    if (m.id.startsWith("neu-")) return;
    const vorher = markierungen;
    setMarkierungen((l) => l.filter((x) => x.id !== m.id));
    setAktiv(null);
    markierungLoeschen(m.id).catch((err) => {
      setMarkierungen(vorher);
      window.alert("Die Markierung konnte nicht gelöscht werden.");
      fehlerMelden(err, { ort: "pdf_markierung_loeschen" });
    });
    track("pdf_markierung_geloescht");
  }

  function stiftUmschalten(farbe?: Farbe) {
    setAuswahlMenue(null);
    if (!farbe && stift) {
      setStift(null);
      return;
    }
    const neu = farbe ?? gespeicherteFarbe();
    setStift(neu);
    try {
      window.localStorage.setItem(STIFT_SPEICHER, neu);
    } catch {
      // ohne Speicher eben nur für diese Sitzung
    }
    // Bereits ausgewählter Text wird sofort markiert
    if (auswahlErfassen().length > 0) markieren(neu);
  }

  function alleKopieren() {
    const text = markierungenAlsText(datei.name, markierungen);
    navigator.clipboard
      ?.writeText(text)
      .then(() => track("pdf_markierungen_kopiert", { anzahl: markierungen.length }))
      .catch(() => window.alert("Kopieren hat nicht geklappt."));
  }

  const aktiveMarkierung = aktiv ? markierungen.find((m) => m.id === aktiv.id) ?? null : null;

  // --- Suche (PDF-06) --------------------------------------------------------
  const seitenText = useCallback(
    async (nr: number): Promise<string[]> => {
      const vorhanden = textCache.current.get(nr);
      if (vorhanden) return vorhanden;
      if (!doc) return [];
      const p = await doc.getPage(nr);
      const inhalt = await p.getTextContent();
      const texte = inhalt.items.map((it) => ("str" in it ? it.str : ""));
      textCache.current.set(nr, texte);
      return texte;
    },
    [doc],
  );

  const normSuche = suchText.trim().toLocaleLowerCase("de-DE");
  const treffer = normSuche.length >= 2 && gefundeneTreffer.suche === normSuche ? gefundeneTreffer.liste : [];

  useEffect(() => {
    if (!doc || normSuche.length < 2) return;
    let abgebrochen = false;
    const id = window.setTimeout(async () => {
      setSucht(true);
      const gefunden: Treffer[] = [];
      for (let nr = 1; nr <= doc.numPages; nr++) {
        const texte = await seitenText(nr);
        if (abgebrochen) return;
        let laufend = 0;
        for (const t of texte) {
          for (let k = vorkommen(t, normSuche).length; k > 0; k--) gefunden.push({ seite: nr, nr: laufend++ });
        }
      }
      if (abgebrochen) return;
      setSucht(false);
      setTreffer({ suche: normSuche, liste: gefunden });
      const ab = gefunden.findIndex((t) => t.seite >= seiteRef.current);
      setTrefferIndex(ab === -1 ? 0 : ab);
      if (gefunden.length) zuSeite(gefunden[ab === -1 ? 0 : ab].seite);
      track("pdf_gesucht", { treffer: gefunden.length });
    }, 300);
    return () => {
      abgebrochen = true;
      window.clearTimeout(id);
    };
  }, [doc, normSuche, seitenText, zuSeite]);

  function trefferWechseln(richtung: 1 | -1) {
    if (treffer.length === 0) return;
    const neu = (trefferIndex + richtung + treffer.length) % treffer.length;
    setTrefferIndex(neu);
    zuSeite(treffer[neu].seite);
  }

  // --- Tastatur (PDF-02, PDF-06) -------------------------------------------
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSuchOffen(true);
        requestAnimationFrame(() => suchFeld.current?.select());
        return;
      }
      if (e.target instanceof HTMLElement && e.target.closest("input, select, textarea")) return;
      if (e.key === "Escape") {
        setStift(null);
        setAuswahlMenue(null);
        setAktiv(null);
        return;
      }
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        zuSeite(seiteRef.current + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        zuSeite(seiteRef.current - 1);
      }
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [zuSeite]);

  const aktiverTreffer = suchOffen ? treffer[trefferIndex] : undefined;
  const zoomWert = typeof zoom === "number" ? String(zoom) : zoom;
  const zoomOptionen = useMemo(
    () => (typeof zoom === "number" && !ZOOM_STUFEN.includes(zoom) ? [...ZOOM_STUFEN, zoom].sort((a, b) => a - b) : ZOOM_STUFEN),
    [zoom],
  );

  return (
    <div className="pdf-reader">
      <div className="pdf-leiste" role="toolbar" aria-label="PDF-Steuerung">
        <Link href="/pdf-reader" className="btng pdf-zurueck" title="Alle PDFs">
          ←
        </Link>
        <span className="pdf-name" title={datei.name}>
          {datei.name}
        </span>

        <div className="pdf-gruppe">
          <button type="button" className="icon-knopf" aria-label="Vorherige Seite" onClick={() => zuSeite(seite - 1)} disabled={seite <= 1}>
            ◀
          </button>
          <span className="pdf-seitenzahl">
            Seite
            <input
              className="field"
              inputMode="numeric"
              aria-label="Seitenzahl"
              value={seiteEingabe}
              onChange={(e) => setSeiteEingabe(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") zuSeite(Number(seiteEingabe) || 1);
              }}
              onBlur={() => setSeiteEingabe(String(seite))}
            />
            von {anzahl || "…"}
          </span>
          <button
            type="button"
            className="icon-knopf"
            aria-label="Nächste Seite"
            onClick={() => zuSeite(seite + 1)}
            disabled={seite >= anzahl}
          >
            ▶
          </button>
        </div>

        <div className="pdf-gruppe">
          <button type="button" className="icon-knopf" aria-label="Verkleinern" onClick={() => zoomSchritt(-1)} disabled={aktuellerMassstab <= MIN_ZOOM}>
            −
          </button>
          <select
            className="field pdf-zoom"
            aria-label="Zoom"
            value={zoomWert}
            onChange={(e) => {
              const w = e.target.value;
              setZoom(w === "breite" || w === "seite" ? w : Number(w));
            }}
          >
            <option value="breite">Seitenbreite</option>
            <option value="seite">Ganze Seite</option>
            {zoomOptionen.map((z) => (
              <option key={z} value={String(z)}>
                {Math.round(z * 100)} %
              </option>
            ))}
          </select>
          <button type="button" className="icon-knopf" aria-label="Vergrößern" onClick={() => zoomSchritt(1)} disabled={aktuellerMassstab >= MAX_ZOOM}>
            +
          </button>
        </div>

        <div className="pdf-gruppe pdf-stift-gruppe">
          <button
            type="button"
            className={`icon-knopf pdf-stift ${stift ? "an" : ""}`}
            style={stift ? ({ "--marker": FARB_INFO[stift].wert } as React.CSSProperties) : undefined}
            aria-label={stift ? "Textmarker ausschalten" : "Textmarker einschalten"}
            title={stift ? "Textmarker aus (Esc)" : "Textmarker: ausgewählter Text wird sofort markiert"}
            aria-pressed={stift !== null}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => stiftUmschalten()}
            disabled={anzahl === 0}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
              <path d="m9 15 6.5-11.2a1.6 1.6 0 0 1 2.2-.6l1.9 1.1a1.6 1.6 0 0 1 .6 2.2L13.7 17.7Z" />
              <path d="m9 15-1.4 2.4 1.2 2.6 3.6.3 1.3-2.6" />
              <path d="M3 21h6" className="pdf-stift-strich" />
            </svg>
          </button>
          {stift && <FarbPunkte aktiv={stift} onWahl={(f) => stiftUmschalten(f)} />}
        </div>

        <div className="pdf-gruppe">
          <button
            type="button"
            className={`icon-knopf ${istLesezeichen ? "pdf-lesezeichen-an" : ""}`}
            aria-label={istLesezeichen ? "Lesezeichen entfernen" : "Lesezeichen setzen"}
            title={istLesezeichen ? "Lesezeichen entfernen" : "Lesezeichen auf dieser Seite"}
            aria-pressed={istLesezeichen}
            onClick={lesezeichenUmschalten}
            disabled={anzahl === 0}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={istLesezeichen ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
              <path d="M6 3h12v18l-6-4-6 4Z" />
            </svg>
          </button>
          <button
            type="button"
            className={`icon-knopf ${seitenleiste ? "an" : ""}`}
            aria-label="Markierungen und Lesezeichen"
            title="Markierungen und Lesezeichen"
            aria-expanded={seitenleiste}
            onClick={() => setSeitenleiste((s) => !s)}
          >
            ☰
          </button>
          <button
            type="button"
            className="icon-knopf"
            aria-label="Im PDF suchen (Strg+F)"
            title="Suchen (Strg+F)"
            onClick={() => {
              setSuchOffen((o) => !o);
              requestAnimationFrame(() => suchFeld.current?.focus());
            }}
          >
            🔍
          </button>
          {kiVerfuegbar && (
            <button
              type="button"
              className={`btng pdf-ki-knopf ${kiOffen ? "an" : ""}`}
              aria-expanded={kiOffen}
              title="Fragen zum Skript, Seiten zusammenfassen, Karteikarten"
              onClick={() => setKiOffen((o) => !o)}
              disabled={!doc}
            >
              ✨ KI
            </button>
          )}
        </div>
      </div>

      {suchOffen && (
        <div className="pdf-suche">
          <input
            ref={suchFeld}
            className="field"
            type="search"
            placeholder="Im PDF suchen …"
            value={suchText}
            onChange={(e) => setSuchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") trefferWechseln(e.shiftKey ? -1 : 1);
              if (e.key === "Escape") setSuchOffen(false);
            }}
          />
          <span className="muted pdf-treffer" aria-live="polite">
            {normSuche.length < 2
              ? ""
              : sucht
                ? "Sucht …"
                : treffer.length === 0
                  ? "Keine Treffer"
                  : `Treffer ${trefferIndex + 1} von ${treffer.length}`}
          </span>
          <button type="button" className="icon-knopf" aria-label="Vorheriger Treffer" onClick={() => trefferWechseln(-1)} disabled={!treffer.length}>
            ↑
          </button>
          <button type="button" className="icon-knopf" aria-label="Nächster Treffer" onClick={() => trefferWechseln(1)} disabled={!treffer.length}>
            ↓
          </button>
          <button type="button" className="icon-knopf" aria-label="Suche schließen" onClick={() => setSuchOffen(false)}>
            ✕
          </button>
        </div>
      )}

      <div className={`pdf-koerper ${seitenleiste ? "mit-leiste" : ""} ${kiOffen && doc ? "mit-ki" : ""}`}>
        {seitenleiste && (
          <aside className="pdf-seitenleiste" aria-label="Markierungen und Lesezeichen">
            <div className="segwrap pdf-leisten-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={leistenTab === "markierungen"}
                title="Markierungen"
                className={`seg ${leistenTab === "markierungen" ? "on" : ""}`}
                onClick={() => setLeistenTab("markierungen")}
              >
                🖍&nbsp;{markierungen.length}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={leistenTab === "lesezeichen"}
                title="Lesezeichen"
                className={`seg ${leistenTab === "lesezeichen" ? "on" : ""}`}
                onClick={() => setLeistenTab("lesezeichen")}
              >
                🔖&nbsp;{lesezeichen.length}
              </button>
            </div>
            {leistenTab === "markierungen" ? (
              <MarkierungsListe
                markierungen={markierungen}
                seite={seite}
                onSpringen={(m) => zuSeite(m.seite, "smooth")}
                onLoeschen={markierungEntfernen}
                onKopieren={alleKopieren}
              />
            ) : lesezeichen.length === 0 ? (
              <p className="empty-state">Noch keine Lesezeichen. Setze eins mit dem Lesezeichen-Symbol oben.</p>
            ) : (
              <ul>
                {lesezeichen.map((s) => (
                  <li key={s}>
                    <button type="button" className={s === seite ? "aktiv" : ""} onClick={() => zuSeite(s)}>
                      🔖 Seite {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}

        <div
          className={`pdf-flaeche ${stift ? "stift-an" : ""}`}
          ref={scrollRef}
          onScroll={beimScrollen}
          tabIndex={-1}
          onPointerDown={(e) => {
            if (e.pointerType !== "mouse" || e.button !== 0) return;
            zeigerUnten.current = true;
            (e.target as HTMLElement).closest(".textLayer")?.classList.add("selecting");
          }}
          onClick={klickAufSeite}
        >
          {ladeFehler && <p className="auth-error">{ladeFehler}</p>}
          {!ladeFehler && !doc && <p className="muted pdf-laden">PDF wird geladen …</p>}
          {doc &&
            masse.map((m, i) => (
              <PdfSeite
                key={i}
                ref={(el) => {
                  seitenRefs.current[i] = el;
                }}
                doc={doc}
                nummer={i + 1}
                masse={m}
                massstab={massstab(m)}
                wurzel={scrollRef}
                suche={suchOffen ? normSuche : ""}
                aktiverTreffer={aktiverTreffer?.seite === i + 1 ? aktiverTreffer.nr : -1}
                markierungen={nachSeite.get(i + 1) ?? KEINE_MARKIERUNGEN}
                aktiveMarkierung={aktiv?.id ?? null}
              />
            ))}
        </div>

        {kiOffen && doc && (
          <KiPdfLeiste
            doc={doc}
            datei={datei}
            seite={seite}
            seitenText={seitenText}
            onSeite={(nr) => zuSeite(nr, "smooth")}
            onSchliessen={() => setKiOffen(false)}
          />
        )}
      </div>

      {auswahlMenue && <AuswahlMenue pos={auswahlMenue} onMarkieren={markieren} onKopieren={() => {
        const text = window.getSelection()?.toString() ?? "";
        void navigator.clipboard?.writeText(text).catch(() => undefined);
        setAuswahlMenue(null);
      }} />}
      {aktiv && aktiveMarkierung && (
        <MarkierungMenue
          key={aktiveMarkierung.id}
          markierung={aktiveMarkierung}
          pos={aktiv.pos}
          onFarbe={(f) => markierungAktualisieren(aktiveMarkierung.id, { farbe: f })}
          onNotiz={(n) => markierungAktualisieren(aktiveMarkierung.id, { notiz: n })}
          onLoeschen={() => markierungEntfernen(aktiveMarkierung)}
          onSchliessen={() => setAktiv(null)}
        />
      )}
    </div>
  );
}

type SeitenProps = {
  doc: PDFDocumentProxy;
  nummer: number;
  masse: Masse;
  massstab: number;
  wurzel: React.RefObject<HTMLDivElement | null>;
  suche: string;
  aktiverTreffer: number;
  markierungen: Markierung[];
  aktiveMarkierung: string | null;
  ref: (el: HTMLDivElement | null) => void;
};

/** Eine Seite: wird nur gerendert, solange sie in der Nähe des sichtbaren Bereichs ist. */
const PdfSeite = memo(function PdfSeite({
  doc,
  nummer,
  masse,
  massstab,
  wurzel,
  suche,
  aktiverTreffer,
  markierungen,
  aktiveMarkierung,
  ref,
}: SeitenProps) {
  const box = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const textEbene = useRef<HTMLDivElement>(null);
  const [nah, setNah] = useState(false);
  const [textFertig, setTextFertig] = useState(0);
  const sollScrollen = useRef(false);

  useEffect(() => {
    sollScrollen.current = aktiverTreffer !== -1;
  }, [suche, aktiverTreffer]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const beobachter = new IntersectionObserver(([e]) => setNah(e.isIntersecting), {
      root: wurzel.current,
      rootMargin: "1200px 0px",
    });
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, [wurzel]);

  useEffect(() => {
    const c = canvas.current;
    const t = textEbene.current;
    if (!nah || !c || !t) {
      // Speicher freigeben, wenn die Seite weit weg ist
      if (c) {
        c.width = 0;
        c.height = 0;
      }
      if (t) t.replaceChildren();
      return;
    }
    let abgebrochen = false;
    let aufgabe: RenderTask | null = null;
    let textLayer: { cancel: () => void } | null = null;
    (async () => {
      try {
        const pdfjs = await pdfjsLaden();
        const page = await doc.getPage(nummer);
        if (abgebrochen) return;
        const viewport = page.getViewport({ scale: massstab });
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        c.width = Math.floor(viewport.width * dpr);
        c.height = Math.floor(viewport.height * dpr);
        aufgabe = page.render({
          canvas: c,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        await aufgabe.promise;
        if (abgebrochen) return;
        t.replaceChildren();
        const layer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: t, viewport });
        textLayer = layer;
        await layer.render();
        // Wie im pdf.js-Viewer: verhindert, dass die Auswahl in Lücken zwischen Zeilen springt
        const ende = document.createElement("div");
        ende.className = "endOfContent";
        t.append(ende);
        if (!abgebrochen) setTextFertig((n) => n + 1);
      } catch {
        // Abgebrochene Renderings (Zoom/Scrollen) sind normal.
      }
    })();
    return () => {
      abgebrochen = true;
      aufgabe?.cancel();
      textLayer?.cancel();
    };
  }, [nah, doc, nummer, massstab]);

  // Suchtreffer markieren (PDF-06)
  useEffect(() => {
    const t = textEbene.current;
    if (!t) return;
    const spans = Array.from(t.children).filter((k): k is HTMLSpanElement => k instanceof HTMLSpanElement);
    let laufend = 0;
    for (const span of spans) {
      const text = span.dataset.text ?? span.textContent ?? "";
      if (span.dataset.text === undefined) span.dataset.text = text;
      const stellen = suche ? vorkommen(text, suche) : [];
      if (stellen.length === 0) {
        if (span.childElementCount > 0) span.textContent = text;
        continue;
      }
      const teile: Node[] = [];
      let pos = 0;
      for (const s of stellen) {
        if (s > pos) teile.push(document.createTextNode(text.slice(pos, s)));
        const mark = document.createElement("span");
        mark.className = `highlight appended${laufend === aktiverTreffer ? " selected" : ""}`;
        mark.textContent = text.slice(s, s + suche.length);
        teile.push(mark);
        pos = s + suche.length;
        laufend++;
      }
      if (pos < text.length) teile.push(document.createTextNode(text.slice(pos)));
      span.replaceChildren(...teile);
    }
    const markiert = t.querySelector(".highlight.selected");
    if (markiert && sollScrollen.current) {
      sollScrollen.current = false;
      markiert.scrollIntoView({ block: "center", inline: "nearest" });
    }
  }, [suche, aktiverTreffer, textFertig]);

  const breite = Math.floor(masse.breite * massstab);
  const hoehe = Math.floor(masse.hoehe * massstab);

  return (
    <div
      ref={(el) => {
        box.current = el;
        ref(el);
      }}
      className="pdf-seite"
      data-seite={nummer}
      style={
        {
          width: breite,
          height: hoehe,
          "--total-scale-factor": massstab,
          "--scale-round-x": "1px",
          "--scale-round-y": "1px",
        } as React.CSSProperties
      }
    >
      <canvas ref={canvas} style={{ width: breite, height: hoehe }} aria-label={`Seite ${nummer}`} />
      {markierungen.length > 0 && (
        <div className="pdf-markierungen" aria-hidden>
          {markierungen.map((m) =>
            m.rechtecke.map(([x, y, w, h], k) => (
              <div
                key={`${m.id}-${k}`}
                className={`pdf-marker ${m.id === aktiveMarkierung ? "aktiv" : ""} ${m.notiz ? "mit-notiz" : ""}`}
                style={{
                  left: `${x * 100}%`,
                  top: `${y * 100}%`,
                  width: `${w * 100}%`,
                  height: `${h * 100}%`,
                  background: FARB_INFO[m.farbe].wert,
                }}
              />
            )),
          )}
        </div>
      )}
      <div ref={textEbene} className="textLayer" />
    </div>
  );
});
