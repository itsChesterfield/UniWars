"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { pdfStandSpeichern } from "@/app/(hubs)/pdf-reader/actions";
import { fehlerMelden, track } from "@/lib/analytics";

type Zoom = "breite" | "seite" | number;
type Masse = { breite: number; hoehe: number };
type Treffer = { seite: number; nr: number };

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
}: {
  datei: { id: string; name: string };
  url: string;
  startSeite: number;
  startLesezeichen: number[];
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
  const [suchOffen, setSuchOffen] = useState(false);
  const [suchText, setSuchText] = useState("");
  const [gefundeneTreffer, setTreffer] = useState<{ suche: string; liste: Treffer[] }>({ suche: "", liste: [] });
  const [trefferIndex, setTrefferIndex] = useState(0);
  const [sucht, setSucht] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const seitenRefs = useRef<(HTMLDivElement | null)[]>([]);
  const textCache = useRef<Map<number, string[]>>(new Map());
  const suchFeld = useRef<HTMLInputElement>(null);
  const wiederhergestellt = useRef(false);
  const seiteRef = useRef(startSeite);

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
            aria-label="Lesezeichen-Liste"
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

      <div className={`pdf-koerper ${seitenleiste ? "mit-leiste" : ""}`}>
        {seitenleiste && (
          <aside className="pdf-seitenleiste" aria-label="Lesezeichen">
            <h3>Lesezeichen</h3>
            {lesezeichen.length === 0 ? (
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

        <div className="pdf-flaeche" ref={scrollRef} onScroll={beimScrollen} tabIndex={-1}>
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
              />
            ))}
        </div>
      </div>
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
  ref: (el: HTMLDivElement | null) => void;
};

/** Eine Seite: wird nur gerendert, solange sie in der Nähe des sichtbaren Bereichs ist. */
const PdfSeite = memo(function PdfSeite({ doc, nummer, masse, massstab, wurzel, suche, aktiverTreffer, ref }: SeitenProps) {
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
      <div ref={textEbene} className="textLayer" />
    </div>
  );
});
