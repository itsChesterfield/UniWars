"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  whiteboardFachSetzen,
  whiteboardLoeschen,
  whiteboardSpeichern,
  whiteboardUmbenennen,
} from "@/app/(hubs)/whiteboard/actions";
import { uploadAbschliessen, uploadVorbereiten } from "@/app/(hubs)/dateiablage/actions";
import { DreiPunkteMenue } from "@/components/hubs/drei-punkte-menue";
import { bildUrl } from "@/components/hubs/bild-auswahl";
import { SPEICHER_TEXT, useAutoSpeichern } from "@/lib/hubs/auto-speichern";
import * as wb from "@/lib/whiteboard/elemente";
import { SVG_SCHRIFT, svgAlsPng, textBreite, useAnsicht, useImBrowser } from "@/lib/zeichnen/ansicht";
import { hochladenMitFortschritt } from "@/lib/dateiablage/upload";
import { dateiTyp } from "@/lib/dateiablage/dateien";
import { dateiname, dateiSpeichern } from "@/lib/textverarbeitung/docx-export";
import type { FachOption } from "@/lib/fach-option";
import { fehlerMelden, track } from "@/lib/analytics";

type Werkzeug = "auswahl" | "stift" | "linie" | "pfeil" | "rechteck" | "kreis" | "text" | "radierer";

const WERKZEUGE: { wert: Werkzeug; name: string; taste: string; icon: string }[] = [
  { wert: "auswahl", name: "Auswahl", taste: "V", icon: "M5 3l14 8-6 2-2 6Z" },
  { wert: "stift", name: "Stift", taste: "P", icon: "M4 20l4-1 11-11-3-3L5 16Z|M14 6l3 3" },
  { wert: "linie", name: "Linie", taste: "L", icon: "M5 19 19 5" },
  { wert: "pfeil", name: "Pfeil", taste: "A", icon: "M5 19 19 5|M11 5h8v8" },
  { wert: "rechteck", name: "Rechteck", taste: "R", icon: "M4 6h16v12H4Z" },
  { wert: "kreis", name: "Kreis", taste: "K", icon: "M12 4a8 8 0 1 0 0 16 8 8 0 1 0 0-16Z" },
  { wert: "text", name: "Text", taste: "T", icon: "M5 6V4h14v2|M12 4v16|M9 20h6" },
  { wert: "radierer", name: "Radierer", taste: "E", icon: "M8 20h12|M4 15l9-9 6 6-6 6H9Z" },
];

const tb = (t: string, px: number) => textBreite(t, `${px}px`);

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.split("|").map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

function pfeilSpitze(e: wb.Linie) {
  const winkel = Math.atan2(e.y2 - e.y1, e.x2 - e.x1);
  const laenge = 10 + e.staerke * 2.5;
  const a = winkel + Math.PI - 0.45;
  const b = winkel + Math.PI + 0.45;
  return `M ${e.x2 + laenge * Math.cos(a)} ${e.y2 + laenge * Math.sin(a)} L ${e.x2} ${e.y2} L ${e.x2 + laenge * Math.cos(b)} ${e.y2 + laenge * Math.sin(b)}`;
}

/** Ein Element mit inline-Attributen (wichtig für den PNG-Export). */
function ElementZeichnen({ e }: { e: wb.Element }) {
  const strich = { stroke: e.farbe, strokeWidth: e.staerke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const treffer = { stroke: "transparent", strokeWidth: e.staerke + 14, fill: "none" };
  switch (e.typ) {
    case "stift": {
      const d = wb.stiftPfad(e.punkte);
      return (
        <>
          <path d={d} {...treffer} />
          <path d={d} {...strich} />
        </>
      );
    }
    case "linie":
      return (
        <>
          <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} {...treffer} />
          <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} {...strich} />
          {e.pfeil && <path d={pfeilSpitze(e)} {...strich} />}
        </>
      );
    case "rechteck":
      return <rect x={e.x} y={e.y} width={e.b} height={e.h} rx={4} {...strich} fill="transparent" />;
    case "kreis":
      return <ellipse cx={e.x + e.b / 2} cy={e.y + e.h / 2} rx={Math.abs(e.b / 2)} ry={Math.abs(e.h / 2)} {...strich} fill="transparent" />;
    case "text":
      return (
        <text x={e.x} y={e.y} fill={e.farbe} fontSize={e.groesse} style={{ fontFamily: SVG_SCHRIFT }} dominantBaseline="hanging">
          {e.text.split("\n").map((z, i) => (
            <tspan key={i} x={e.x} dy={i === 0 ? 0 : e.groesse * 1.25}>
              {z || " "}
            </tspan>
          ))}
        </text>
      );
    case "bild":
      return <image href={bildUrl(e.datei_id)} x={e.x} y={e.y} width={e.b} height={e.h} preserveAspectRatio="none" />;
  }
}

type Aktion =
  | { art: "zeichnen" }
  | { art: "bewegen"; id: string; px: number; py: number; start: wb.Element; vorher: wb.Element[]; bewegt: boolean }
  | { art: "groesse"; id: string; ende: "a" | "b"; vorher: wb.Element[] }
  | { art: "radieren"; vorher: wb.Element[]; geloescht: boolean }
  | { art: "pan" };

export function WhiteboardEditor({
  id,
  startName,
  startFachId,
  startElemente,
  faecher,
}: {
  id: string;
  startName: string;
  startFachId: string | null;
  startElemente: wb.Element[];
  faecher: FachOption[];
}) {
  const router = useRouter();
  const imBrowser = useImBrowser();
  const [name, setName] = useState(startName);
  const [fachId, setFachId] = useState(startFachId);
  const [elemente, setElemente] = useState(startElemente);
  const [verlauf, setVerlauf] = useState<wb.Verlauf>({ zurueck: [], vor: [] });
  const [werkzeug, setWerkzeug] = useState<Werkzeug>("stift");
  const [farbe, setFarbe] = useState<string>(wb.WB_FARBEN[0].wert);
  const [staerke, setStaerke] = useState<number>(4);
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<wb.Element | null>(null);
  const [textEingabe, setTextEingabe] = useState<{ x: number; y: number; text: string; id: string | null; groesse: number; farbe: string } | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const aktion = useRef<Aktion | null>(null);
  const elementeRef = useRef(elemente);
  useEffect(() => {
    elementeRef.current = elemente;
  }, [elemente]);
  const inhalt = useRef<SVGGElement>(null);
  const { ansicht, flaeche, welt, panStart, panBewegen, panEnde, einpassen, zoomen } = useAnsicht();
  const { status, aendern } = useAutoSpeichern<{ elemente: wb.Element[] }>((a) => whiteboardSpeichern(id, a.elemente ?? []));

  const setzen = useCallback(
    (neu: wb.Element[], vorher: wb.Element[] | null) => {
      if (vorher) setVerlauf((v) => wb.merken(v, vorher));
      setElemente(neu);
      aendern({ elemente: neu });
    },
    [aendern],
  );

  // Beim Öffnen alles einpassen
  const eingepasst = useRef(false);
  useEffect(() => {
    if (eingepasst.current || !imBrowser) return;
    eingepasst.current = true;
    const r = wb.gesamtRahmen(startElemente, tb);
    if (r) einpassen(r, 1);
  }, [imBrowser, startElemente, einpassen]);

  // --- WB-04 -----------------------------------------------------------------
  function rueckgaengig() {
    const letzte = verlauf.zurueck[verlauf.zurueck.length - 1];
    if (!letzte) return;
    setVerlauf({ zurueck: verlauf.zurueck.slice(0, -1), vor: [elemente, ...verlauf.vor].slice(0, wb.MAX_SCHRITTE) });
    setElemente(letzte);
    aendern({ elemente: letzte });
    setAuswahl(null);
  }

  function wiederholen() {
    const naechste = verlauf.vor[0];
    if (!naechste) return;
    setVerlauf({ zurueck: [...verlauf.zurueck, elemente].slice(-wb.MAX_SCHRITTE), vor: verlauf.vor.slice(1) });
    setElemente(naechste);
    aendern({ elemente: naechste });
    setAuswahl(null);
  }

  // --- Text -------------------------------------------------------------------
  function textUebernehmen() {
    if (!textEingabe) return;
    const { text, id: tid, x, y, groesse, farbe: tf } = textEingabe;
    setTextEingabe(null);
    const ohne = tid ? elemente.filter((e) => e.id !== tid) : elemente;
    if (!text.trim()) {
      if (tid) setzen(ohne, elemente);
      return;
    }
    const element: wb.Text = { id: tid ?? wb.neueId(), typ: "text", x, y, text: text.slice(0, 2000), groesse, farbe: tf, staerke };
    const neu = tid ? elemente.map((e) => (e.id === tid ? element : e)) : [...elemente, element];
    setzen(neu, elemente);
    flaeche.current?.focus({ preventScroll: true });
  }

  // --- Zeigen/Ziehen ---------------------------------------------------------------
  function zielId(e: React.PointerEvent): { id: string | null; griff: "a" | "b" | null } {
    const el = (e.target as Element).closest("[data-id],[data-griff]");
    if (!el) return { id: null, griff: null };
    const griff = el.getAttribute("data-griff") as "a" | "b" | null;
    return { id: el.getAttribute("data-id") ?? el.getAttribute("data-fuer"), griff };
  }

  function runter(e: React.PointerEvent) {
    if (textEingabe) {
      textUebernehmen();
      return;
    }
    flaeche.current?.focus({ preventScroll: true });
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      aktion.current = { art: "pan" };
      panStart(e);
      return;
    }
    if (e.button !== 0) return;
    const p = welt(e.clientX, e.clientY);
    const { id: tid, griff } = zielId(e);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);

    switch (werkzeug) {
      case "auswahl": {
        if (griff && tid) {
          aktion.current = { art: "groesse", id: tid, ende: griff, vorher: elemente };
          return;
        }
        if (tid) {
          const el = elemente.find((x) => x.id === tid);
          if (!el) return;
          setAuswahl(tid);
          aktion.current = { art: "bewegen", id: tid, px: p.x, py: p.y, start: el, vorher: elemente, bewegt: false };
          return;
        }
        setAuswahl(null);
        aktion.current = { art: "pan" };
        panStart(e);
        return;
      }
      case "radierer": {
        aktion.current = { art: "radieren", vorher: elemente, geloescht: false };
        if (tid) {
          setElemente((l) => l.filter((x) => x.id !== tid));
          aktion.current.geloescht = true;
        }
        return;
      }
      case "text": {
        // Sonst holt sich die Fläche nach dem Klick den Fokus zurück und das neue Textfeld schließt sofort.
        e.preventDefault();
        const vorhanden = tid ? elemente.find((x) => x.id === tid && x.typ === "text") : undefined;
        if (vorhanden && vorhanden.typ === "text") {
          setTextEingabe({ x: vorhanden.x, y: vorhanden.y, text: vorhanden.text, id: vorhanden.id, groesse: vorhanden.groesse, farbe: vorhanden.farbe });
        } else {
          setTextEingabe({ x: p.x, y: p.y, text: "", id: null, groesse: wb.textGroesse(staerke), farbe });
        }
        return;
      }
      case "stift":
        setEntwurf({ id: wb.neueId(), typ: "stift", farbe, staerke, punkte: [p.x, p.y] });
        break;
      case "linie":
      case "pfeil":
        setEntwurf({ id: wb.neueId(), typ: "linie", farbe, staerke, x1: p.x, y1: p.y, x2: p.x, y2: p.y, pfeil: werkzeug === "pfeil" });
        break;
      case "rechteck":
      case "kreis":
        setEntwurf({ id: wb.neueId(), typ: werkzeug, farbe, staerke, x: p.x, y: p.y, b: 0, h: 0 });
        break;
    }
    aktion.current = { art: "zeichnen" };
  }

  function bewegen(e: React.PointerEvent) {
    const a = aktion.current;
    if (!a) return;
    if (a.art === "pan") {
      panBewegen(e);
      return;
    }
    const p = welt(e.clientX, e.clientY);
    if (a.art === "zeichnen") {
      setEntwurf((d) => {
        if (!d) return d;
        if (d.typ === "stift") return { ...d, punkte: [...d.punkte, p.x, p.y] };
        if (d.typ === "linie") return { ...d, x2: p.x, y2: p.y };
        if (d.typ === "rechteck" || d.typ === "kreis") {
          let b = p.x - d.x;
          let h = p.y - d.y;
          if (e.shiftKey) b = h = Math.sign(b || 1) * Math.max(Math.abs(b), Math.abs(h));
          return { ...d, b, h };
        }
        return d;
      });
    } else if (a.art === "bewegen") {
      const dx = p.x - a.px;
      const dy = p.y - a.py;
      if (!a.bewegt && Math.hypot(dx, dy) * ansicht.zoom < 3) return;
      a.bewegt = true;
      setElemente((l) => l.map((x) => (x.id === a.id ? wb.verschieben(a.start, dx, dy) : x)));
    } else if (a.art === "groesse") {
      setElemente((l) =>
        l.map((x) => {
          if (x.id !== a.id) return x;
          if (x.typ === "linie" && a.ende === "a") return { ...x, x1: p.x, y1: p.y };
          return wb.groesseAendern(x, p.x, p.y, x.typ === "bild" && !e.shiftKey);
        }),
      );
    } else if (a.art === "radieren" && e.buttons === 1) {
      const { id: tid } = zielId(e);
      if (tid) {
        setElemente((l) => l.filter((x) => x.id !== tid));
        a.geloescht = true;
      }
    }
  }

  function hoch() {
    const a = aktion.current;
    aktion.current = null;
    if (!a) return;
    if (a.art === "pan") {
      panEnde();
      return;
    }
    if (a.art === "zeichnen" && entwurf) {
      let fertig = entwurf;
      if (fertig.typ === "stift") fertig = { ...fertig, punkte: wb.punkteAusduennen(fertig.punkte) };
      if (fertig.typ === "rechteck" || fertig.typ === "kreis") fertig = wb.normalisieren(fertig);
      setEntwurf(null);
      const r = wb.rahmen(fertig);
      const zuKlein = fertig.typ !== "stift" && Math.max(r.x2 - r.x1, r.y2 - r.y1) < 3;
      if (!zuKlein && elemente.length < wb.MAX_ELEMENTE) {
        setzen([...elemente, fertig], elemente);
        track("whiteboard_gezeichnet", { werkzeug });
      }
      return;
    }
    if ((a.art === "bewegen" && a.bewegt) || a.art === "groesse" || (a.art === "radieren" && a.geloescht)) {
      setzen(
        elemente.map((x) => (x.typ === "rechteck" || x.typ === "kreis" ? wb.normalisieren(x) : x)),
        a.vorher,
      );
    }
  }

  // --- Tastatur ----------------------------------------------------------------------
  function taste(e: React.KeyboardEvent) {
    if (textEingabe) return;
    const strg = e.ctrlKey || e.metaKey;
    if (strg && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) wiederholen();
      else rueckgaengig();
      return;
    }
    if (strg && e.key.toLowerCase() === "y") {
      e.preventDefault();
      wiederholen();
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && auswahl) {
      e.preventDefault();
      setzen(
        elemente.filter((x) => x.id !== auswahl),
        elemente,
      );
      setAuswahl(null);
      return;
    }
    if (e.key === "Escape") {
      setAuswahl(null);
      return;
    }
    if (!strg && !e.altKey) {
      const w = WERKZEUGE.find((x) => x.taste.toLowerCase() === e.key.toLowerCase());
      if (w) {
        setWerkzeug(w.wert);
        if (w.wert !== "auswahl") setAuswahl(null);
      }
    }
  }

  // --- WB-07: Bilder -------------------------------------------------------------------
  async function bildEinfuegen(datei: File, punkt?: { x: number; y: number }) {
    if (dateiTyp(datei.name || "bild.png")?.art !== "bild" && !/^image\/(png|jpeg)$/.test(datei.type)) {
      setHinweis("Nur JPG- oder PNG-Bilder.");
      return;
    }
    const benannt = datei.name ? datei : new File([datei], `whiteboard-${Date.now()}.${datei.type === "image/jpeg" ? "jpg" : "png"}`, { type: datei.type });
    setHinweis("Bild wird hochgeladen …");
    try {
      const bitmap = await createImageBitmap(benannt);
      const faktor = Math.min(1, 400 / Math.max(bitmap.width, bitmap.height));
      const b = bitmap.width * faktor;
      const h = bitmap.height * faktor;
      bitmap.close();
      const ticket = await uploadVorbereiten({ name: benannt.name, groesse: benannt.size, fachId });
      await hochladenMitFortschritt(ticket.signedUrl, benannt, ticket.mime, () => undefined);
      const neu = await uploadAbschliessen({ pfad: ticket.pfad, name: ticket.name, fachId });
      const mitte = punkt ?? welt((flaeche.current?.getBoundingClientRect().left ?? 0) + (flaeche.current?.clientWidth ?? 0) / 2, (flaeche.current?.getBoundingClientRect().top ?? 0) + (flaeche.current?.clientHeight ?? 0) / 2);
      const element: wb.Bild = { id: wb.neueId(), typ: "bild", x: mitte.x - b / 2, y: mitte.y - h / 2, b, h, datei_id: neu.id, farbe, staerke };
      // Während des Hochladens kann weitergezeichnet worden sein -> aktuellen Stand nehmen
      const aktuell = elementeRef.current;
      setzen([...aktuell, element], aktuell);
      setWerkzeug("auswahl");
      setAuswahl(element.id);
      setHinweis(null);
      track("whiteboard_bild");
    } catch (err) {
      setHinweis(err instanceof Error ? err.message : "Bild konnte nicht eingefügt werden.");
      fehlerMelden(err, { ort: "whiteboard_bild" });
    }
  }

  useEffect(() => {
    const einfuegen = (e: ClipboardEvent) => {
      if (!flaeche.current?.contains(document.activeElement) && document.activeElement !== flaeche.current) return;
      const bild = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (bild) {
        e.preventDefault();
        void bildEinfuegen(bild);
      }
    };
    window.addEventListener("paste", einfuegen);
    return () => window.removeEventListener("paste", einfuegen);
  });

  useEffect(() => {
    if (!hinweis || hinweis.endsWith("…")) return;
    const t = window.setTimeout(() => setHinweis(null), 4000);
    return () => window.clearTimeout(t);
  }, [hinweis]);

  async function exportieren() {
    if (!inhalt.current) return;
    const r = wb.gesamtRahmen(elemente, tb);
    if (!r) {
      setHinweis("Das Whiteboard ist noch leer.");
      return;
    }
    try {
      dateiSpeichern(await svgAlsPng(inhalt.current, r), dateiname(name, "png"));
      track("whiteboard_exportiert");
    } catch (err) {
      fehlerMelden(err, { ort: "whiteboard_export" });
      setHinweis("Export hat nicht geklappt.");
    }
  }

  async function umbenennen() {
    const neu = window.prompt("Neuer Name", name)?.trim();
    if (!neu || neu === name) return;
    setName(neu);
    whiteboardUmbenennen(id, neu).catch((err) => fehlerMelden(err, { ort: "whiteboard_name" }));
  }

  async function entfernen() {
    if (!window.confirm(`Whiteboard „${name}“ wirklich löschen?`)) return;
    try {
      await whiteboardLoeschen(id);
      track("whiteboard_geloescht");
      router.push("/whiteboard");
    } catch (err) {
      fehlerMelden(err, { ort: "whiteboard_loeschen" });
      window.alert("Löschen hat nicht geklappt.");
    }
  }

  const gewaehlt = auswahl ? elemente.find((e) => e.id === auswahl) : undefined;
  const auswahlRahmen = gewaehlt ? wb.rahmen(gewaehlt, tb) : null;
  const cursor =
    werkzeug === "auswahl" ? "default" : werkzeug === "text" ? "text" : werkzeug === "radierer" ? "cell" : "crosshair";

  return (
    <div className="zf-seite">
      <div className="txt-kopf">
        <Link href="/whiteboard" className="hub-zurueck-link">
          ← Alle Whiteboards
        </Link>
        <div className="txt-kopf-zeile">
          <h1 className="zf-titel">{name}</h1>
          <div className="txt-kopf-aktionen">
            <span className={`speicher-status ${status}`} aria-live="polite">
              {hinweis ?? SPEICHER_TEXT[status]}
            </span>
            <select
              className="field txt-fach"
              aria-label="Fach"
              value={fachId ?? ""}
              onChange={(e) => {
                setFachId(e.target.value || null);
                whiteboardFachSetzen(id, e.target.value || null).catch((err) => fehlerMelden(err, { ort: "whiteboard_fach" }));
              }}
            >
              <option value="">Ohne Fach</option>
              {faecher.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <button type="button" className="btng" onClick={() => void exportieren()}>
              Als PNG exportieren
            </button>
            <DreiPunkteMenue
              punkte={[
                { label: "Umbenennen", onClick: () => void umbenennen() },
                { label: "Whiteboard löschen", onClick: () => void entfernen(), gefahr: true },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="wb-arbeitsbereich">
        {/* WB-02 / WB-03 / WB-04: senkrechte Werkzeugleiste */}
        <div className="wb-werkzeuge" role="toolbar" aria-label="Werkzeuge" aria-orientation="vertical">
          {WERKZEUGE.map((w) => (
            <button
              key={w.wert}
              type="button"
              className={`wb-werkzeug ${werkzeug === w.wert ? "an" : ""}`}
              title={`${w.name} (${w.taste})`}
              aria-label={w.name}
              aria-pressed={werkzeug === w.wert}
              onClick={() => {
                setWerkzeug(w.wert);
                if (w.wert !== "auswahl") setAuswahl(null);
                flaeche.current?.focus({ preventScroll: true });
              }}
            >
              <Icon d={w.icon} />
            </button>
          ))}
          <span className="wb-trenner" />
          {wb.WB_FARBEN.map((f) => (
            <button
              key={f.wert}
              type="button"
              className={`wb-farbe ${farbe === f.wert ? "an" : ""}`}
              style={{ background: f.wert }}
              title={f.name}
              aria-label={`Farbe ${f.name}`}
              aria-pressed={farbe === f.wert}
              onClick={() => {
                setFarbe(f.wert);
                if (gewaehlt && gewaehlt.typ !== "bild") setzen(elemente.map((x) => (x.id === gewaehlt.id ? { ...x, farbe: f.wert } : x)), elemente);
              }}
            />
          ))}
          <span className="wb-trenner" />
          {wb.STAERKEN.map((s) => (
            <button
              key={s.wert}
              type="button"
              className={`wb-werkzeug ${staerke === s.wert ? "an" : ""}`}
              title={s.name}
              aria-label={`Strichstärke ${s.name}`}
              aria-pressed={staerke === s.wert}
              onClick={() => {
                setStaerke(s.wert);
                if (gewaehlt && gewaehlt.typ !== "bild")
                  setzen(
                    elemente.map((x) =>
                      x.id === gewaehlt.id ? (x.typ === "text" ? { ...x, staerke: s.wert, groesse: wb.textGroesse(s.wert) } : { ...x, staerke: s.wert }) : x,
                    ),
                    elemente,
                  );
              }}
            >
              <span className="wb-staerke" style={{ height: s.wert }} />
            </button>
          ))}
          <span className="wb-trenner" />
          <button type="button" className="wb-werkzeug" title="Rückgängig (Strg+Z)" aria-label="Rückgängig" onClick={rueckgaengig} disabled={!verlauf.zurueck.length}>
            ↶
          </button>
          <button type="button" className="wb-werkzeug" title="Wiederholen (Strg+Y)" aria-label="Wiederholen" onClick={wiederholen} disabled={!verlauf.vor.length}>
            ↷
          </button>
          <span className="wb-trenner" />
          <button type="button" className="wb-werkzeug" title="Verkleinern" aria-label="Verkleinern" onClick={() => zoomen(1 / 1.2)}>
            −
          </button>
          <span className="mono wb-zoom">{Math.round(ansicht.zoom * 100)}%</span>
          <button type="button" className="wb-werkzeug" title="Vergrößern" aria-label="Vergrößern" onClick={() => zoomen(1.2)}>
            +
          </button>
        </div>

        <div
          ref={flaeche}
          className="zf-flaeche wb-flaeche"
          style={{ cursor }}
          tabIndex={0}
          role="application"
          aria-label="Whiteboard-Zeichenfläche"
          onKeyDown={taste}
          onPointerDown={runter}
          onPointerMove={bewegen}
          onPointerUp={hoch}
          onPointerCancel={hoch}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) e.preventDefault();
          }}
          onDrop={(e) => {
            const datei = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
            if (!datei) return;
            e.preventDefault();
            void bildEinfuegen(datei, welt(e.clientX, e.clientY));
          }}
        >
          <svg className="zf-svg" width="100%" height="100%">
            <defs>
              <pattern id="wb-raster" width={24 * ansicht.zoom} height={24 * ansicht.zoom} patternUnits="userSpaceOnUse" x={ansicht.x} y={ansicht.y}>
                <circle cx={1} cy={1} r={1} fill="var(--border)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#wb-raster)" />
            <g ref={inhalt} transform={`translate(${ansicht.x} ${ansicht.y}) scale(${ansicht.zoom})`}>
              {imBrowser &&
                elemente.map((e) => (
                  <g key={e.id} data-id={e.id} style={{ display: textEingabe?.id === e.id ? "none" : undefined }}>
                    <ElementZeichnen e={e} />
                  </g>
                ))}
              {entwurf && (
                <g className="ui">
                  <ElementZeichnen e={entwurf.typ === "rechteck" || entwurf.typ === "kreis" ? wb.normalisieren(entwurf) : entwurf} />
                </g>
              )}
              {gewaehlt && auswahlRahmen && werkzeug === "auswahl" && (
                <g className="ui">
                  <rect
                    x={auswahlRahmen.x1 - 6}
                    y={auswahlRahmen.y1 - 6}
                    width={auswahlRahmen.x2 - auswahlRahmen.x1 + 12}
                    height={auswahlRahmen.y2 - auswahlRahmen.y1 + 12}
                    fill="none"
                    stroke="#b9822a"
                    strokeWidth={1.5 / ansicht.zoom}
                    strokeDasharray={`${6 / ansicht.zoom} ${4 / ansicht.zoom}`}
                    pointerEvents="none"
                  />
                  {gewaehlt.typ === "linie" ? (
                    <>
                      <circle data-griff="a" data-fuer={gewaehlt.id} cx={gewaehlt.x1} cy={gewaehlt.y1} r={7 / ansicht.zoom} fill="#fff" stroke="#b9822a" strokeWidth={2 / ansicht.zoom} style={{ cursor: "move" }} />
                      <circle data-griff="b" data-fuer={gewaehlt.id} cx={gewaehlt.x2} cy={gewaehlt.y2} r={7 / ansicht.zoom} fill="#fff" stroke="#b9822a" strokeWidth={2 / ansicht.zoom} style={{ cursor: "move" }} />
                    </>
                  ) : gewaehlt.typ === "rechteck" || gewaehlt.typ === "kreis" || gewaehlt.typ === "bild" ? (
                    <rect
                      data-griff="b"
                      data-fuer={gewaehlt.id}
                      x={auswahlRahmen.x2 - 6 / ansicht.zoom}
                      y={auswahlRahmen.y2 - 6 / ansicht.zoom}
                      width={12 / ansicht.zoom}
                      height={12 / ansicht.zoom}
                      fill="#fff"
                      stroke="#b9822a"
                      strokeWidth={2 / ansicht.zoom}
                      style={{ cursor: "nwse-resize" }}
                    />
                  ) : null}
                </g>
              )}
            </g>
          </svg>

          {textEingabe && (
            <textarea
              className="wb-texteingabe"
              autoFocus
              value={textEingabe.text}
              placeholder="Text …"
              aria-label="Text"
              style={{
                left: textEingabe.x * ansicht.zoom + ansicht.x,
                top: textEingabe.y * ansicht.zoom + ansicht.y,
                fontSize: textEingabe.groesse * ansicht.zoom,
                color: textEingabe.farbe,
              }}
              onChange={(e) => setTextEingabe({ ...textEingabe, text: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Escape") {
                  e.preventDefault();
                  setTextEingabe(null);
                } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  textUebernehmen();
                }
              }}
              onBlur={textUebernehmen}
            />
          )}
          {elemente.length === 0 && !entwurf && (
            <p className="wb-leer faint">Wähle ein Werkzeug und leg los. Bilder kannst du hierher ziehen oder mit Strg+V einfügen.</p>
          )}
          <p className="zf-hilfe faint">Mausrad: Zoom · Alt/Mittelklick + Ziehen: verschieben · Strg+Z: rückgängig · Entf: Auswahl löschen</p>
        </div>
      </div>
    </div>
  );
}
