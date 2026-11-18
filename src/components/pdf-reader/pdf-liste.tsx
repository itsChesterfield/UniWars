"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/nav-icon";
import { Zustand } from "@/components/zustand";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  pdfOrdnerAnlegen,
  pdfOrdnerLoeschen,
  pdfOrdnerUmbenennen,
  pdfVerschieben,
  type PdfOrdner,
  type PdfZiel,
} from "@/app/(hubs)/pdf-reader/actions";
import { uploadAbschliessen, uploadVerwerfen, uploadVorbereiten } from "@/app/(hubs)/dateiablage/actions";
import { UmbenennenFeld } from "@/components/dateiablage/dateiablage";
import { DreiPunkteMenue, type MenuePunkt } from "@/components/hubs/drei-punkte-menue";
import { groesseText } from "@/lib/dateiablage/dateien";
import { hochladenMitFortschritt } from "@/lib/dateiablage/upload";
import { mitteVon, punktFlug, ziehbildSetzen } from "@/lib/bewegung/punkt";
import { fehlerMelden, track } from "@/lib/analytics";

export type PdfEintrag = {
  id: string;
  name: string;
  groesse: number;
  fachId: string | null;
  ordnerId: string | null;
  letzteSeite: number | null;
};

export type PdfFach = { id: string; name: string; farbe: string | null };

/** Ordner-Schlüssel in der Adresse: "f:<fach>" oder "o:<eigener Ordner>"; ohne = oberste Ebene. */
type Ort = string | null;
type Ordner = { schluessel: string; name: string; farbe: string | null; eigen: boolean; id: string };
type Upload = { schluessel: string; name: string; anteil: number; fehler: string | null; fertig?: boolean; wiederholbar?: boolean; datei?: File; nach?: Ort };

/**
 * Lichtspur beim Hochladen (Entscheidung 15.11.): Eine Spur läuft mit dem Fortschritt um das Symbol
 * und schließt sich am Ende zum Haken. Bei einem Fehler bleibt das Symbol ohne Spur.
 */
function UploadMarke({ anteil, fertig, fehler }: { anteil: number; fertig: boolean; fehler: boolean }) {
  return (
    <span className="upload-marke" aria-hidden>
      <svg viewBox="-12 -12 24 24">
        <circle className="upload-bahn" r="10" />
        {!fehler && <circle className="upload-spur" r="10" pathLength={100} strokeDasharray={`${Math.round(anteil * 100)} 100`} transform="rotate(-90)" />}
        {fertig && <path className="upload-haken" d="M-4.5 0.5 L-1.4 3.6 L4.8 -3.4" pathLength={1} />}
      </svg>
      {!fertig && <Icon name={fehler ? "hochladen" : "pdf"} groesse={12} />}
    </span>
  );
}

const PDF_DRAG_TYP = "application/x-uniwars-pdf";

function ortVon(p: PdfEintrag): Ort {
  if (p.ordnerId) return `o:${p.ordnerId}`;
  if (p.fachId) return `f:${p.fachId}`;
  return null;
}

function zielVon(ort: Ort): PdfZiel {
  if (ort?.startsWith("o:")) return { art: "ordner", id: ort.slice(2) };
  if (ort?.startsWith("f:")) return { art: "fach", id: ort.slice(2) };
  return { art: "wurzel" };
}

function istPdf(datei: File) {
  return datei.type === "application/pdf" || datei.name.toLowerCase().endsWith(".pdf");
}

function OrdnerIcon({ farbe, gross = false }: { farbe?: string | null; gross?: boolean }) {
  const g = gross ? 34 : 15;
  return (
    <svg width={g} height={g} viewBox="0 0 24 24" aria-hidden className="pdf-ordner-icon">
      <path
        d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"
        fill={farbe ?? "var(--accent)"}
        fillOpacity={gross ? 0.85 : 0}
        stroke={gross ? "none" : "currentColor"}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
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

/**
 * PDF Reader wie ein Datei-Explorer (à la OneDrive): oben die Ordner als Kacheln –
 * jedes Fach ist automatisch ein Ordner, dazu eigene Ordner –, darunter die PDFs.
 * PDFs per Drag & Drop in Ordner hinein oder (auf "Meine PDFs") wieder heraus ziehen;
 * PDFs vom Computer hineinziehen lädt sie direkt dort hoch.
 */
export function PdfListe({ startPdfs, startOrdner, faecher }: { startPdfs: PdfEintrag[]; startOrdner: PdfOrdner[]; faecher: PdfFach[] }) {
  const router = useRouter();
  const pfad = usePathname();
  const searchParams = useSearchParams();

  const [pdfs, setPdfs] = useState(startPdfs);
  const [eigene, setEigene] = useState(startOrdner);
  const [neuerOrdner, setNeuerOrdner] = useState(false);
  const [ordnerUmbenennen, setOrdnerUmbenennen] = useState<string | null>(null);
  const [umbenennenId, setUmbenennenId] = useState<string | null>(null);
  const [ziel, setZiel] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);

  const ordner: Ordner[] = [
    ...faecher.map((f) => ({ schluessel: `f:${f.id}`, name: f.name, farbe: f.farbe, eigen: false, id: f.id })),
    ...[...eigene]
      .sort((a, b) => a.name.localeCompare(b.name, "de"))
      .map((o) => ({ schluessel: `o:${o.id}`, name: o.name, farbe: null, eigen: true, id: o.id })),
  ];
  const gewaehlt = searchParams.get("ordner");
  const aktuell = ordner.find((o) => o.schluessel === gewaehlt) ?? null;
  const ort: Ort = aktuell?.schluessel ?? null;
  const sichtbar = pdfs.filter((p) => ortVon(p) === ort);
  const anzahl = (schluessel: string) => pdfs.filter((p) => ortVon(p) === schluessel).length;

  function oeffnen(schluessel: Ort) {
    const params = new URLSearchParams(searchParams.toString());
    if (schluessel) params.set("ordner", schluessel);
    else params.delete("ordner");
    const query = params.toString();
    router.push(query ? `${pfad}?${query}` : pfad, { scroll: false });
  }

  // --- Ordner -----------------------------------------------------------------
  async function anlegen(name: string) {
    const neu = await pdfOrdnerAnlegen(name);
    setEigene((l) => [...l, neu]);
    setNeuerOrdner(false);
    track("pdf_ordner_angelegt");
  }

  async function umbenennen(id: string, name: string) {
    const neu = await pdfOrdnerUmbenennen(id, name);
    setEigene((l) => l.map((o) => (o.id === id ? neu : o)));
    setOrdnerUmbenennen(null);
    track("pdf_ordner_umbenannt");
  }

  function loeschen(o: Ordner) {
    const n = anzahl(o.schluessel);
    const hinweis = n > 0 ? ` ${n === 1 ? "Die PDF darin bleibt" : `Die ${n} PDFs darin bleiben`} erhalten.` : "";
    if (!window.confirm(`Ordner „${o.name}“ löschen?${hinweis}`)) return;
    const vorher = { eigene, pdfs };
    setEigene((l) => l.filter((x) => x.id !== o.id));
    setPdfs((l) => l.map((p) => (p.ordnerId === o.id ? { ...p, ordnerId: null } : p)));
    if (ort === o.schluessel) oeffnen(null);
    track("pdf_ordner_geloescht", { pdfs: n });
    pdfOrdnerLoeschen(o.id).catch((err) => {
      setEigene(vorher.eigene);
      setPdfs(vorher.pdfs);
      setFehler("Der Ordner konnte nicht gelöscht werden.");
      fehlerMelden(err, { ort: "pdf_ordner_loeschen" });
    });
  }

  // --- Verschieben ------------------------------------------------------------
  async function verschieben(pdfId: string, nach: Ort) {
    const pdf = pdfs.find((p) => p.id === pdfId);
    if (!pdf || ortVon(pdf) === nach) return;
    // Bewegung: die Zeile tritt zurück, ein goldener Punkt fliegt vom Symbol zum Ziel
    const zeile = document.querySelector<HTMLElement>(`[data-pdf="${pdfId}"]`);
    const zielEl = document.querySelector(`[data-ort="${nach ?? "wurzel"}"]`);
    if (zeile) {
      zeile.animate([{ opacity: 1 }, { opacity: 0.25 }], { duration: 120, fill: "forwards" });
      if (zielEl) {
        await punktFlug(mitteVon(zeile.querySelector(".dat-typ") ?? zeile), mitteVon(zielEl));
        zielEl.classList.add("ortswechsel-ziel");
        window.setTimeout(() => zielEl.classList.remove("ortswechsel-ziel"), 600);
      }
    }
    const z = zielVon(nach);
    const neu: PdfEintrag =
      z.art === "ordner"
        ? { ...pdf, ordnerId: z.id }
        : z.art === "fach"
          ? { ...pdf, ordnerId: null, fachId: z.id }
          : { ...pdf, ordnerId: null, fachId: null };
    setFehler(null);
    setPdfs((l) => l.map((p) => (p.id === pdfId ? neu : p)));
    track("pdf_verschoben", { ziel: z.art });
    pdfVerschieben(pdfId, z)
      .then(({ name }) => setPdfs((l) => l.map((p) => (p.id === pdfId ? { ...p, name } : p))))
      .catch((err) => {
        setPdfs((l) => l.map((p) => (p.id === pdfId ? pdf : p)));
        zeile?.getAnimations().forEach((a) => a.cancel());
        setFehler("Verschieben hat nicht geklappt.");
        fehlerMelden(err, { ort: "pdf_verschieben" });
      });
  }

  // --- Hochladen (PDFs vom Computer hineinziehen) -----------------------------
  async function eineHochladen(datei: File, nach: Ort, schluessel: string) {
    const setzen = (teil: Partial<Upload>) => setUploads((l) => l.map((u) => (u.schluessel === schluessel ? { ...u, ...teil } : u)));
    const z = zielVon(nach);
    const fachId = z.art === "fach" ? z.id : null;
    let ticketPfad: string | null = null;
    try {
      const ticket = await uploadVorbereiten({ name: datei.name, groesse: datei.size, fachId });
      ticketPfad = ticket.pfad;
      setzen({ name: ticket.name });
      await hochladenMitFortschritt(ticket.signedUrl, datei, ticket.mime, (anteil) => setzen({ anteil }));
      const neu = await uploadAbschliessen({ pfad: ticket.pfad, name: ticket.name, fachId });
      ticketPfad = null;
      if (z.art === "ordner") await pdfVerschieben(neu.id, z);
      setPdfs((l) => [
        { id: neu.id, name: neu.name, groesse: Number(neu.groesse), fachId: neu.fach_id, ordnerId: z.art === "ordner" ? z.id : null, letzteSeite: null },
        ...l,
      ]);
      // Die Lichtspur schließt sich zum Haken, danach verschwindet der Eintrag
      setzen({ anteil: 1, fertig: true });
      window.setTimeout(() => setUploads((l) => l.filter((u) => u.schluessel !== schluessel)), 1100);
      track("datei_hochgeladen", { art: "pdf", kb: Math.round(datei.size / 1024), mit_fach: Boolean(fachId), ort: "pdf_reader" });
    } catch (err) {
      if (ticketPfad) void uploadVerwerfen(ticketPfad).catch(() => undefined);
      setzen({ fehler: err instanceof Error ? err.message : "Upload fehlgeschlagen.", wiederholbar: true });
      fehlerMelden(err, { ort: "pdf_upload" });
    }
  }

  function hochladen(dateien: File[], nach: Ort) {
    const neue: Upload[] = [];
    const starten: [File, string][] = [];
    for (const datei of dateien) {
      const schluessel = crypto.randomUUID();
      if (!istPdf(datei)) {
        neue.push({ schluessel, name: datei.name, anteil: 0, fehler: "Nur PDFs – andere Dateien bitte in der Dateiablage hochladen." });
        continue;
      }
      // Datei bleibt am Eintrag, damit ein abgebrochener Upload erneut versucht werden kann
      neue.push({ schluessel, name: datei.name, anteil: 0, fehler: null, datei, nach });
      starten.push([datei, schluessel]);
    }
    setUploads((u) => [...u, ...neue]);
    const warteschlange = [...starten];
    const arbeiter = async () => {
      for (let n = warteschlange.shift(); n; n = warteschlange.shift()) await eineHochladen(n[0], nach, n[1]);
    };
    void Promise.all([arbeiter(), arbeiter()]);
  }

  function erneutHochladen(u: Upload) {
    if (!u.datei || u.nach === undefined) return;
    setUploads((l) => l.map((x) => (x.schluessel === u.schluessel ? { ...x, anteil: 0, fehler: null, wiederholbar: false } : x)));
    void eineHochladen(u.datei, u.nach, u.schluessel);
  }

  /** Ablageziel für PDFs aus der Liste (verschieben) und vom Computer (hochladen). */
  function ablage(nach: Ort, kennung: string) {
    return {
      "data-ort": kennung,
      onDragOver: (e: React.DragEvent) => {
        const typen = e.dataTransfer.types;
        if (!typen.includes(PDF_DRAG_TYP) && !typen.includes("Files")) return;
        // Die ganze Fläche nimmt nur Dateien vom Computer an (eine PDF aus der Liste liegt ja schon hier)
        if (kennung === "hier" && !typen.includes("Files")) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = typen.includes("Files") ? "copy" : "move";
        if (ziel !== kennung) setZiel(kennung);
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setZiel((z) => (z === kennung ? null : z));
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setZiel(null);
        const id = e.dataTransfer.getData(PDF_DRAG_TYP);
        if (id) void verschieben(id, nach);
        else if (e.dataTransfer.files.length) hochladen(Array.from(e.dataTransfer.files), nach);
      },
    };
  }

  function menue(p: PdfEintrag): MenuePunkt[] {
    const punkte: MenuePunkt[] = [{ label: "Umbenennen", onClick: () => setUmbenennenId(p.id) }];
    for (const o of ordner) {
      if (o.schluessel !== ortVon(p)) punkte.push({ label: `Nach „${o.name}“ verschieben`, onClick: () => void verschieben(p.id, o.schluessel) });
    }
    if (ortVon(p)) punkte.push({ label: "Aus dem Ordner nehmen", onClick: () => void verschieben(p.id, null) });
    return punkte;
  }

  return (
    <div className={`pdf-explorer ${ziel === "hier" ? "pdf-ablage-aktiv" : ""}`} {...ablage(ort, "hier")}>
      <nav className="pdf-pfad" aria-label="Ordnerpfad">
        <button
          type="button"
          className={`pdf-pfad-teil ${ziel === "wurzel" ? "pdf-ordner-ziel" : ""}`}
          onClick={() => oeffnen(null)}
          aria-current={ort === null ? "page" : undefined}
          title={ort ? "Zurück – PDFs hierher ziehen, um sie aus dem Ordner zu nehmen" : undefined}
          {...(ort ? ablage(null, "wurzel") : {})}
        >
          Meine PDFs
        </button>
        {aktuell && (
          <>
            <span className="pdf-pfad-trenner" aria-hidden>
              ›
            </span>
            {ordnerUmbenennen === aktuell.schluessel ? (
              <OrdnerNameFeld start={aktuell.name} onSpeichern={(name) => umbenennen(aktuell.id, name)} onAbbrechen={() => setOrdnerUmbenennen(null)} />
            ) : (
              <span className="pdf-pfad-teil aktiv" aria-current="page">
                <OrdnerIcon farbe={aktuell.farbe} /> {aktuell.name}
              </span>
            )}
            {aktuell.eigen ? (
              <DreiPunkteMenue
                label="Ordner-Aktionen"
                punkte={[
                  { label: "Ordner umbenennen", onClick: () => setOrdnerUmbenennen(aktuell.schluessel) },
                  { label: "Ordner löschen", onClick: () => loeschen(aktuell), gefahr: true },
                ]}
              />
            ) : (
              <span className="pdf-pfad-hinweis">Fach-Ordner, auch in der Dateiablage</span>
            )}
          </>
        )}
      </nav>

      {fehler && (
        <p className="formular-fehler" role="alert">
          {fehler}
        </p>
      )}

      {uploads.length > 0 && (
        <ul className="pdf-uploads">
          {uploads.map((u) => (
            <li key={u.schluessel} className={u.fertig ? "fertig" : u.fehler ? "fehler" : undefined}>
              <UploadMarke anteil={u.anteil} fertig={Boolean(u.fertig)} fehler={Boolean(u.fehler)} />
              <span className="pdf-upload-name">{u.name}</span>
              {u.fehler ? (
                <>
                  <span className="dat-upload-fehler">{u.fehler}</span>
                  {u.wiederholbar && (
                    <button type="button" className="knopf neben klein" onClick={() => erneutHochladen(u)}>
                      Erneut versuchen
                    </button>
                  )}
                  <button
                    type="button"
                    className="knopf leise klein nur-symbol"
                    aria-label="Ausblenden"
                    onClick={() => setUploads((l) => l.filter((x) => x.schluessel !== u.schluessel))}
                  >
                    <Icon name="schliessen" groesse={16} />
                  </button>
                </>
              ) : (
                <span className="pdf-upload-stand zahl">{u.fertig ? "Hochgeladen" : `${Math.round(u.anteil * 100)} %`}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {ort === null && (
        <section aria-label="Ordner">
          <div className="pdf-ordner-raster">
            {ordner.map((o) =>
              ordnerUmbenennen === o.schluessel ? (
                <div key={o.schluessel} className="pdf-ordner-kachel">
                  <OrdnerIcon farbe={o.farbe} gross />
                  <OrdnerNameFeld start={o.name} onSpeichern={(name) => umbenennen(o.id, name)} onAbbrechen={() => setOrdnerUmbenennen(null)} />
                </div>
              ) : (
                <div key={o.schluessel} className={`pdf-ordner-kachel ${ziel === o.schluessel ? "pdf-ordner-ziel" : ""}`} {...ablage(o.schluessel, o.schluessel)}>
                  <button type="button" className="pdf-ordner-oeffnen" onClick={() => oeffnen(o.schluessel)} title={o.eigen ? o.name : `${o.name} (Fach)`}>
                    <OrdnerIcon farbe={o.farbe} gross />
                    <span className="pdf-ordner-name">{o.name}</span>
                    <span className="pdf-ordner-zahl">
                      {anzahl(o.schluessel)} {anzahl(o.schluessel) === 1 ? "PDF" : "PDFs"}
                      {!o.eigen && " · Fach"}
                    </span>
                  </button>
                  {o.eigen && (
                    <DreiPunkteMenue
                      label={`Aktionen für Ordner ${o.name}`}
                      punkte={[
                        { label: "Umbenennen", onClick: () => setOrdnerUmbenennen(o.schluessel) },
                        { label: "Löschen", onClick: () => loeschen(o), gefahr: true },
                      ]}
                    />
                  )}
                </div>
              ),
            )}
            {neuerOrdner ? (
              <div className="pdf-ordner-kachel pdf-ordner-neu">
                <OrdnerIcon gross />
                <OrdnerNameFeld onSpeichern={anlegen} onAbbrechen={() => setNeuerOrdner(false)} />
              </div>
            ) : (
              <button type="button" className="pdf-ordner-kachel pdf-ordner-neu" onClick={() => setNeuerOrdner(true)}>
                <span className="pdf-ordner-plus" aria-hidden>
                  <Icon name="plus" groesse={20} />
                </span>
                <span className="pdf-ordner-name">Neuer Ordner</span>
              </button>
            )}
          </div>
        </section>
      )}

      <section className="pdf-dateien" aria-label="PDFs">
        {sichtbar.length === 0 ? (
          <Zustand art="leer" region ebene={3} icon="pdf" titel={ort === null ? "Noch keine PDFs ohne Ordner." : "Dieser Ordner ist leer."}>
            {ort === null
              ? "Zieh PDFs von deinem Computer hierher, um sie hochzuladen."
              : "Zieh PDFs von deinem Computer hierher oder verschiebe welche über das Menü einer PDF."}
          </Zustand>
        ) : (
          <ul className="pdf-liste">
            {sichtbar.map((d) => (
              <li
                key={d.id}
                className="pdf-liste-eintrag"
                data-pdf={d.id}
                draggable={umbenennenId !== d.id}
                title="In einen Ordner ziehen zum Verschieben"
                onDragStart={(e) => {
                  e.dataTransfer.setData(PDF_DRAG_TYP, d.id);
                  e.dataTransfer.effectAllowed = "move";
                  ziehbildSetzen(e, d.name);
                }}
              >
                {umbenennenId === d.id ? (
                  <div className="pdf-liste-zeile">
                    <span className="dat-typ" aria-hidden>
                      <Icon name="pdf" groesse={14} />
                    </span>
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
                    <span className="dat-typ" aria-hidden>
                      <Icon name="pdf" groesse={14} />
                    </span>
                    <span className="pdf-liste-name">{d.name}</span>
                    <span className="pdf-liste-groesse zahl">{groesseText(d.groesse)}</span>
                    {d.letzteSeite && <span className="pdf-weiter">weiter bei S. {d.letzteSeite}</span>}
                  </Link>
                )}
                <DreiPunkteMenue label={`Aktionen für ${d.name}`} punkte={menue(d)} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="pdf-explorer-tipp">
        Tipp: PDFs auf einen Ordner ziehen verschiebt sie – auf „Meine PDFs“ ziehen nimmt sie wieder heraus.
      </p>
    </div>
  );
}
