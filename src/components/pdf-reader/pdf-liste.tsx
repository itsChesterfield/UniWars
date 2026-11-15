"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { pdfInOrdner, pdfOrdnerAnlegen, pdfOrdnerLoeschen, pdfOrdnerUmbenennen, type PdfOrdner } from "@/app/(hubs)/pdf-reader/actions";
import { UmbenennenFeld } from "@/components/dateiablage/dateiablage";
import { DreiPunkteMenue, type MenuePunkt } from "@/components/hubs/drei-punkte-menue";
import { groesseText } from "@/lib/dateiablage/dateien";
import { fehlerMelden, track } from "@/lib/analytics";

export type PdfEintrag = {
  id: string;
  name: string;
  groesse: number;
  ordnerId: string | null;
  fach: { name: string; farbe: string | null } | null;
  letzteSeite: number | null;
};

const OHNE = "ohne";
const PDF_DRAG_TYP = "application/x-uniwars-pdf";

function OrdnerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  );
}

/** Kleines Eingabefeld für neue oder umbenannte Ordner (Enter speichert, Esc bricht ab). */
function OrdnerNameFeld({
  start = "",
  onSpeichern,
  onAbbrechen,
}: {
  start?: string;
  onSpeichern: (name: string) => Promise<void>;
  onAbbrechen: () => void;
}) {
  const [wert, setWert] = useState(start);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function speichern() {
    if (laeuft) return;
    if (!wert.trim() || wert.trim() === start) {
      onAbbrechen();
      return;
    }
    setLaeuft(true);
    try {
      await onSpeichern(wert);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Das hat nicht geklappt.");
      setLaeuft(false);
    }
  }

  return (
    <span className="pdf-ordner-feld">
      <input
        className="field"
        autoFocus
        value={wert}
        maxLength={100}
        placeholder="Ordnername"
        aria-label="Ordnername"
        disabled={laeuft}
        onChange={(e) => {
          setWert(e.target.value);
          setFehler(null);
        }}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void speichern();
          } else if (e.key === "Escape") onAbbrechen();
        }}
        onBlur={() => void speichern()}
      />
      {fehler && <span className="dat-upload-fehler">{fehler}</span>}
    </span>
  );
}

export function PdfListe({ startPdfs, startOrdner }: { startPdfs: PdfEintrag[]; startOrdner: PdfOrdner[] }) {
  const router = useRouter();
  const pfad = usePathname();
  const searchParams = useSearchParams();
  const auswahl = searchParams.get("ordner");

  const [pdfs, setPdfs] = useState(startPdfs);
  const [ordner, setOrdner] = useState(() => [...startOrdner].sort((a, b) => a.name.localeCompare(b.name, "de")));
  const [neuerOrdner, setNeuerOrdner] = useState(false);
  const [ordnerUmbenennen, setOrdnerUmbenennen] = useState<string | null>(null);
  const [umbenennenId, setUmbenennenId] = useState<string | null>(null);
  const [ziehZiel, setZiehZiel] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const aktiverOrdner = ordner.find((o) => o.id === auswahl) ?? null;
  const filter = aktiverOrdner ? aktiverOrdner.id : auswahl === OHNE ? OHNE : null;
  const sichtbar = pdfs.filter((p) => (filter === null ? true : filter === OHNE ? !p.ordnerId : p.ordnerId === filter));
  const anzahl = (id: string | null) => pdfs.filter((p) => p.ordnerId === id).length;
  const ordnerName = (id: string | null) => ordner.find((o) => o.id === id)?.name ?? null;
  const sortiert = (liste: PdfOrdner[]) => [...liste].sort((a, b) => a.name.localeCompare(b.name, "de"));

  function waehlen(wert: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (wert) params.set("ordner", wert);
    else params.delete("ordner");
    const query = params.toString();
    router.push(query ? `${pfad}?${query}` : pfad, { scroll: false });
  }

  async function anlegen(name: string) {
    const neu = await pdfOrdnerAnlegen(name);
    setOrdner((l) => sortiert([...l, neu]));
    setNeuerOrdner(false);
    track("pdf_ordner_angelegt");
    waehlen(neu.id);
  }

  async function umbenennen(id: string, name: string) {
    const neu = await pdfOrdnerUmbenennen(id, name);
    setOrdner((l) => sortiert(l.map((o) => (o.id === id ? neu : o))));
    setOrdnerUmbenennen(null);
    track("pdf_ordner_umbenannt");
  }

  function loeschen(o: PdfOrdner) {
    const n = anzahl(o.id);
    const hinweis = n > 0 ? ` Die ${n === 1 ? "PDF darin bleibt" : `${n} PDFs darin bleiben`} erhalten und ${n === 1 ? "landet" : "landen"} in „Ohne Ordner“.` : "";
    if (!window.confirm(`Ordner „${o.name}“ löschen?${hinweis}`)) return;
    const vorher = { ordner, pdfs };
    setOrdner((l) => l.filter((x) => x.id !== o.id));
    setPdfs((l) => l.map((p) => (p.ordnerId === o.id ? { ...p, ordnerId: null } : p)));
    waehlen(null);
    track("pdf_ordner_geloescht", { pdfs: n });
    pdfOrdnerLoeschen(o.id).catch((err) => {
      setOrdner(vorher.ordner);
      setPdfs(vorher.pdfs);
      setFehler("Der Ordner konnte nicht gelöscht werden.");
      fehlerMelden(err, { ort: "pdf_ordner_loeschen" });
    });
  }

  function verschieben(pdfId: string, ordnerId: string | null) {
    const pdf = pdfs.find((p) => p.id === pdfId);
    if (!pdf || pdf.ordnerId === ordnerId) return;
    setFehler(null);
    setPdfs((l) => l.map((p) => (p.id === pdfId ? { ...p, ordnerId } : p)));
    track("pdf_verschoben", { in_ordner: Boolean(ordnerId) });
    pdfInOrdner(pdfId, ordnerId).catch((err) => {
      setPdfs((l) => l.map((p) => (p.id === pdfId ? { ...p, ordnerId: pdf.ordnerId } : p)));
      setFehler("Verschieben hat nicht geklappt.");
      fehlerMelden(err, { ort: "pdf_verschieben" });
    });
  }

  /** Chip als Ablageziel: PDF-Zeile auf einen Ordner ziehen. */
  function ablageZiel(ziel: string | null) {
    const schluessel = ziel ?? OHNE;
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes(PDF_DRAG_TYP)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (ziehZiel !== schluessel) setZiehZiel(schluessel);
      },
      onDragLeave: () => setZiehZiel(null),
      onDrop: (e: React.DragEvent) => {
        const id = e.dataTransfer.getData(PDF_DRAG_TYP);
        setZiehZiel(null);
        if (id) {
          e.preventDefault();
          verschieben(id, ziel);
        }
      },
    };
  }

  function menue(p: PdfEintrag): MenuePunkt[] {
    const punkte: MenuePunkt[] = [{ label: "Umbenennen", onClick: () => setUmbenennenId(p.id) }];
    for (const o of ordner) {
      if (o.id !== p.ordnerId) punkte.push({ label: `In „${o.name}“ verschieben`, onClick: () => verschieben(p.id, o.id) });
    }
    if (p.ordnerId) punkte.push({ label: "Aus dem Ordner nehmen", onClick: () => verschieben(p.id, null) });
    if (ordner.length === 0) punkte.push({ label: "Neuer Ordner …", onClick: () => setNeuerOrdner(true) });
    return punkte;
  }

  return (
    <>
      <div className="pdf-ordner-leiste" role="toolbar" aria-label="Ordner">
        <button type="button" className={`chip ${filter === null ? "chip-active" : ""}`} onClick={() => waehlen(null)}>
          Alle <span className="pdf-ordner-zahl">{pdfs.length}</span>
        </button>
        {ordner.map((o) =>
          ordnerUmbenennen === o.id ? (
            <OrdnerNameFeld key={o.id} start={o.name} onSpeichern={(name) => umbenennen(o.id, name)} onAbbrechen={() => setOrdnerUmbenennen(null)} />
          ) : (
            <button
              key={o.id}
              type="button"
              className={`chip ${filter === o.id ? "chip-active" : ""} ${ziehZiel === o.id ? "pdf-ordner-ziel" : ""}`}
              onClick={() => waehlen(o.id)}
              onDoubleClick={() => setOrdnerUmbenennen(o.id)}
              title="Doppelklick zum Umbenennen – PDFs hierher ziehen zum Verschieben"
              {...ablageZiel(o.id)}
            >
              <OrdnerIcon /> {o.name} <span className="pdf-ordner-zahl">{anzahl(o.id)}</span>
            </button>
          ),
        )}
        {ordner.length > 0 && (
          <button
            type="button"
            className={`chip ${filter === OHNE ? "chip-active" : ""} ${ziehZiel === OHNE ? "pdf-ordner-ziel" : ""}`}
            onClick={() => waehlen(OHNE)}
            {...ablageZiel(null)}
          >
            Ohne Ordner <span className="pdf-ordner-zahl">{anzahl(null)}</span>
          </button>
        )}
        {neuerOrdner ? (
          <OrdnerNameFeld onSpeichern={anlegen} onAbbrechen={() => setNeuerOrdner(false)} />
        ) : (
          <button type="button" className="chip pdf-ordner-neu" onClick={() => setNeuerOrdner(true)}>
            + Neuer Ordner
          </button>
        )}
        {aktiverOrdner && ordnerUmbenennen !== aktiverOrdner.id && (
          <span className="pdf-ordner-aktionen">
            <DreiPunkteMenue
              label="Ordner-Aktionen"
              punkte={[
                { label: "Ordner umbenennen", onClick: () => setOrdnerUmbenennen(aktiverOrdner.id) },
                { label: "Ordner löschen", onClick: () => loeschen(aktiverOrdner), gefahr: true },
              ]}
            />
          </span>
        )}
      </div>
      {fehler && <p className="auth-error">{fehler}</p>}

      <section className="card">
        {sichtbar.length === 0 ? (
          <p className="empty-state">
            {filter === null ? "Noch keine PDFs." : "Dieser Ordner ist leer. Zieh eine PDF auf den Ordner oder nutze ⋯ → Verschieben."}
          </p>
        ) : (
          <ul className="pdf-liste">
            {sichtbar.map((d) => (
              <li
                key={d.id}
                className="pdf-liste-eintrag"
                draggable={umbenennenId !== d.id}
                onDragStart={(e) => {
                  e.dataTransfer.setData(PDF_DRAG_TYP, d.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
              >
                {umbenennenId === d.id ? (
                  <div className="pdf-liste-zeile">
                    <span aria-hidden>📕</span>
                    <UmbenennenFeld
                      datei={d}
                      onFertig={(neu) => {
                        setUmbenennenId(null);
                        if (neu) setPdfs((l) => l.map((p) => (p.id === d.id ? { ...p, name: neu.name } : p)));
                      }}
                    />
                  </div>
                ) : (
                  <Link href={`/pdf-reader/${d.id}`} className="pdf-liste-zeile" draggable={false}>
                    <span aria-hidden>📕</span>
                    <span className="pdf-liste-name">{d.name}</span>
                    {filter === null && d.ordnerId && (
                      <span className="muted pdf-liste-fach">
                        <OrdnerIcon /> {ordnerName(d.ordnerId)}
                      </span>
                    )}
                    <span className="muted pdf-liste-fach">
                      {d.fach ? (
                        <>
                          <span className="dot" style={{ background: d.fach.farbe ?? "#94a3b8" }} /> {d.fach.name}
                        </>
                      ) : (
                        "Allgemein"
                      )}
                    </span>
                    <span className="faint mono">{groesseText(d.groesse)}</span>
                    {d.letzteSeite && <span className="tag tag-accent">weiter bei S. {d.letzteSeite}</span>}
                  </Link>
                )}
                <DreiPunkteMenue label={`Aktionen für ${d.name}`} punkte={menue(d)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
