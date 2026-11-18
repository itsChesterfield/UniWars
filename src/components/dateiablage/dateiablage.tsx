"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  dateiLink,
  dateiLoeschen,
  dateiUmbenennen,
  dateiVerschieben,
  dateiVerwendung,
  ausLinkImportieren,
  uploadAbschliessen,
  uploadVerwerfen,
  uploadVorbereiten,
  type Datei,
} from "@/app/(hubs)/dateiablage/actions";
import { Zustand } from "@/components/zustand";
import { Icon } from "@/components/nav-icon";
import type { IconName } from "@/lib/icons";
import { UploadMarke } from "@/components/bewegung/upload-marke";
import { RollText } from "@/components/bewegung/roll-text";
import { bewegungReduziert } from "@/lib/personalisierung-store";
import { mitteVon, punktFlug, ziehbildSetzen } from "@/lib/bewegung/punkt";
import { DreiPunkteMenue } from "@/components/hubs/drei-punkte-menue";
import {
  ACCEPT_ATTRIBUT,
  dateiTyp,
  endung,
  groesseText,
  nameOhneEndung,
  uploadPruefen,
  type DateiArt,
} from "@/lib/dateiablage/dateien";
import { hochladenMitFortschritt } from "@/lib/dateiablage/upload";
import { linkNormalisieren } from "@/lib/dateiablage/link-import";
import { fehlerMelden, track } from "@/lib/analytics";

export type Ordner = { id: string | null; name: string; farbe: string | null };

type Upload = {
  schluessel: string;
  name: string;
  anteil: number;
  fehler: string | null;
  vonLink?: boolean;
  fertig?: boolean;
  wiederholbar?: boolean;
  datei?: File;
  fachId?: string | null;
};
type Sortierung = { spalte: "name" | "datum" | "groesse"; absteigend: boolean };
type Vorschau = { art: "bild" | "audio"; url: string; name: string; id: string };

// Design B3: Symbole aus dem eigenen Satz statt Emojis
const ART_ICON: Record<DateiArt, IconName> = { pdf: "pdf", bild: "bild", office: "notizen", text: "notizen", audio: "kopfhoerer" };
const OFFICE_ICON: Record<string, IconName> = { docx: "text", pptx: "praesentation", xlsx: "tabelle" };

function icon(name: string): IconName {
  const typ = dateiTyp(name);
  if (!typ) return "notizen";
  return typ.art === "office" ? (OFFICE_ICON[endung(name)] ?? "notizen") : ART_ICON[typ.art];
}

/** Farbquadrat des Fachs; der Ordner „Allgemein“ hat ein Ordnersymbol. */
function OrdnerZeichen({ ordner }: { ordner: Ordner }) {
  return ordner.id ? (
    <span className="f" style={{ "--c": ordner.farbe ?? "var(--text-3)" } as CSSProperties} aria-hidden />
  ) : (
    <Icon name="dateiablage" groesse={14} className="i" />
  );
}

const DRAG_TYP = "application/x-uniwars-datei";

export function Dateiablage({ initialDateien, ordner, limit }: { initialDateien: Datei[]; ordner: Ordner[]; limit: number }) {
  const router = useRouter();
  const pfad = usePathname();
  const searchParams = useSearchParams();
  const ordnerParam = searchParams.get("ordner");
  const aktuellerOrdner = ordner.find((o) => o.id === ordnerParam) ?? ordner[0];

  const [dateien, setDateien] = useState(initialDateien);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [sortierung, setSortierung] = useState<Sortierung>({ spalte: "datum", absteigend: true });
  const [umbenennenId, setUmbenennenId] = useState<string | null>(null);
  const [verschiebenId, setVerschiebenId] = useState<string | null>(null);
  const [vorschau, setVorschau] = useState<Vorschau | null>(null);
  const [ziehenUeber, setZiehenUeber] = useState(false);
  const [ordnerZiel, setOrdnerZiel] = useState<string | null | undefined>(undefined);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [linkOffen, setLinkOffen] = useState(false);
  const [linkWert, setLinkWert] = useState("");
  const eingabe = useRef<HTMLInputElement>(null);
  const einfuegenRef = useRef<(e: ClipboardEvent) => void>(() => undefined);

  const belegt = dateien.reduce((s, d) => s + Number(d.groesse), 0);
  const voll = belegt >= limit;

  const imOrdner = useMemo(() => {
    const liste = dateien.filter((d) => (d.fach_id ?? null) === aktuellerOrdner.id);
    const faktor = sortierung.absteigend ? -1 : 1;
    return liste.sort((a, b) => {
      if (sortierung.spalte === "name") return faktor * a.name.localeCompare(b.name, "de", { numeric: true });
      if (sortierung.spalte === "groesse") return faktor * (Number(a.groesse) - Number(b.groesse));
      return faktor * a.erstellt_am.localeCompare(b.erstellt_am);
    });
  }, [dateien, aktuellerOrdner.id, sortierung]);

  function ordnerOeffnen(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("ordner", id);
    else params.delete("ordner");
    const query = params.toString();
    router.push(query ? `${pfad}?${query}` : pfad, { scroll: false });
  }

  function anzahl(id: string | null) {
    return dateien.filter((d) => (d.fach_id ?? null) === id).length;
  }

  // --- DAT-02 Hochladen ---------------------------------------------------
  async function eineHochladen(datei: File, fachId: string | null, schluessel: string) {
    const setzen = (teil: Partial<Upload>) =>
      setUploads((liste) => liste.map((u) => (u.schluessel === schluessel ? { ...u, ...teil } : u)));
    let ticketPfad: string | null = null;
    try {
      const ticket = await uploadVorbereiten({ name: datei.name, groesse: datei.size, fachId });
      ticketPfad = ticket.pfad;
      setzen({ name: ticket.name });
      await hochladenMitFortschritt(ticket.signedUrl, datei, ticket.mime, (anteil) => setzen({ anteil }));
      const neu = await uploadAbschliessen({ pfad: ticket.pfad, name: ticket.name, fachId });
      ticketPfad = null;
      setDateien((liste) => [neu, ...liste]);
      // Die Lichtspur schließt sich zum Haken, danach verschwindet der Eintrag
      setzen({ anteil: 1, fertig: true });
      window.setTimeout(() => setUploads((liste) => liste.filter((u) => u.schluessel !== schluessel)), 1100);
      track("datei_hochgeladen", { art: dateiTyp(datei.name)?.art ?? "unbekannt", kb: Math.round(datei.size / 1024), mit_fach: Boolean(fachId) });
    } catch (err) {
      if (ticketPfad) void uploadVerwerfen(ticketPfad).catch(() => undefined);
      setzen({ fehler: err instanceof Error ? err.message : "Upload fehlgeschlagen.", wiederholbar: true });
      fehlerMelden(err, { ort: "datei_upload" });
    }
  }

  function hochladen(liste: FileList | File[]) {
    const fachId = aktuellerOrdner.id;
    let reserviert = belegt;
    const neue: Upload[] = [];
    const starten: [File, string][] = [];
    for (const datei of Array.from(liste)) {
      const schluessel = crypto.randomUUID();
      const pruefung = uploadPruefen(datei.name, datei.size, reserviert);
      if (!pruefung.ok) {
        neue.push({ schluessel, name: datei.name, anteil: 0, fehler: pruefung.fehler });
        continue;
      }
      reserviert += datei.size;
      // Datei bleibt am Eintrag, damit ein abgebrochener Upload erneut versucht werden kann
      neue.push({ schluessel, name: datei.name, anteil: 0, fehler: null, datei, fachId });
      starten.push([datei, schluessel]);
    }
    setUploads((u) => [...u, ...neue]);
    // Höchstens drei gleichzeitig
    const warteschlange = [...starten];
    const arbeiter = async () => {
      for (let naechste = warteschlange.shift(); naechste; naechste = warteschlange.shift()) {
        await eineHochladen(naechste[0], fachId, naechste[1]);
      }
    };
    void Promise.all([arbeiter(), arbeiter(), arbeiter()]);
  }

  function erneutHochladen(u: Upload) {
    if (!u.datei || u.fachId === undefined) return;
    setUploads((l) => l.map((x) => (x.schluessel === u.schluessel ? { ...x, anteil: 0, fehler: null, wiederholbar: false } : x)));
    void eineHochladen(u.datei, u.fachId, u.schluessel);
  }

  // --- Import über einen Link (öffentliche Dateien, der Server lädt sie herunter) ---
  async function ausLink(link: string) {
    const fachId = aktuellerOrdner.id;
    const schluessel = crypto.randomUUID();
    let anzeige = link.trim();
    try {
      const u = linkNormalisieren(link);
      if (u) anzeige = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? u.hostname) || u.hostname;
    } catch {
      // Anzeige bleibt der Link
    }
    setUploads((u) => [...u, { schluessel, name: anzeige, anteil: 0, fehler: null, vonLink: true }]);
    const a = await ausLinkImportieren({ link, fachId }).catch(() => null);
    if (!a?.ok) {
      const fehler = a && !a.ok ? a.fehler : "Keine Verbindung. Bitte versuch es noch einmal.";
      setUploads((liste) => liste.map((u) => (u.schluessel === schluessel ? { ...u, fehler } : u)));
      track("datei_link_import_fehler", {});
      return;
    }
    setDateien((liste) => [a.datei, ...liste]);
    setUploads((liste) => liste.filter((u) => u.schluessel !== schluessel));
    track("datei_hochgeladen", { art: dateiTyp(a.datei.name)?.art ?? "unbekannt", kb: Math.round(Number(a.datei.groesse) / 1024), mit_fach: Boolean(fachId), quelle: "link" });
  }

  function linkAbschicken() {
    if (!linkNormalisieren(linkWert)) return;
    void ausLink(linkWert);
    setLinkWert("");
    setLinkOffen(false);
  }

  // Strg+V auf der Seite: kopierter Link wird importiert, kopierte Dateien hochgeladen
  useEffect(() => {
    einfuegenRef.current = (e: ClipboardEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (ziel && (ziel.tagName === "INPUT" || ziel.tagName === "TEXTAREA" || ziel.isContentEditable)) return;
      if (document.querySelector("dialog[open], .quick-add-overlay")) return;
      const kopierteDateien = Array.from(e.clipboardData?.files ?? []);
      if (kopierteDateien.length) {
        e.preventDefault();
        if (!voll) hochladen(kopierteDateien);
        return;
      }
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (linkNormalisieren(text)) {
        e.preventDefault();
        if (voll) setMeldung("Dein Speicherplatz ist voll (2 GB).");
        else void ausLink(text);
      }
    };
  });
  useEffect(() => {
    const einfuegen = (e: ClipboardEvent) => einfuegenRef.current(e);
    window.addEventListener("paste", einfuegen);
    return () => window.removeEventListener("paste", einfuegen);
  }, []);

  // --- DAT-04 Öffnen ------------------------------------------------------
  async function oeffnen(d: Datei) {
    const art = dateiTyp(d.name)?.art;
    track("datei_geoeffnet", { art: art ?? "unbekannt" });
    if (art === "pdf") {
      router.push(`/pdf-reader/${d.id}`);
      return;
    }
    try {
      if (art === "bild" || art === "audio") {
        setVorschau({ art, url: await dateiLink(d.id), name: d.name, id: d.id });
      } else {
        window.location.assign(await dateiLink(d.id, true));
      }
    } catch (err) {
      setMeldung("Datei konnte nicht geöffnet werden.");
      fehlerMelden(err, { ort: "datei_oeffnen" });
    }
  }

  async function herunterladen(d: Datei) {
    try {
      window.location.assign(await dateiLink(d.id, true));
      track("datei_heruntergeladen", { art: dateiTyp(d.name)?.art ?? "unbekannt" });
    } catch (err) {
      setMeldung("Download hat nicht geklappt.");
      fehlerMelden(err, { ort: "datei_download" });
    }
  }

  async function verschieben(d: Datei, fachId: string | null) {
    setVerschiebenId(null);
    if ((d.fach_id ?? null) === fachId) return;
    // Bewegung: die Zeile tritt zurück, ein goldener Punkt fliegt vom Symbol zum Ordner
    const zeile = document.querySelector<HTMLElement>(`[data-datei="${d.id}"]`);
    const zielEl = document.querySelector(`[data-ort="${fachId ?? "allgemein"}"]`);
    if (zeile && zielEl) {
      zeile.animate([{ opacity: 1 }, { opacity: 0.25 }], { duration: 120, fill: "forwards" });
      await punktFlug(mitteVon(zeile.querySelector(".dat-typ") ?? zeile), mitteVon(zielEl));
      zielEl.classList.add("ortswechsel-ziel");
      window.setTimeout(() => zielEl.classList.remove("ortswechsel-ziel"), 600);
    }
    try {
      const neu = await dateiVerschieben(d.id, fachId);
      setDateien((liste) => liste.map((x) => (x.id === d.id ? neu : x)));
      track("datei_verschoben");
    } catch (err) {
      zeile?.getAnimations().forEach((a) => a.cancel());
      setMeldung("Verschieben hat nicht geklappt.");
      fehlerMelden(err, { ort: "datei_verschieben" });
    }
  }

  async function loeschen(d: Datei) {
    let hinweis = "";
    try {
      const { anhaenge, quellen } = await dateiVerwendung(d.id);
      const teile = [
        anhaenge > 0 ? `an ${anhaenge} ${anhaenge === 1 ? "Eintrag" : "Einträgen"} angehängt` : "",
        quellen > 0 ? `mit ${quellen} ${quellen === 1 ? "Quelle" : "Quellen"} verknüpft` : "",
      ].filter(Boolean);
      if (teile.length) hinweis = `\n\nDiese Datei ist ${teile.join(" und ")}.`;
    } catch {
      // Hinweis ist optional
    }
    if (!window.confirm(`„${d.name}“ wirklich löschen?${hinweis}`)) return;
    // Bewegung: die Zeile tritt zurück, bevor sie verschwindet (nur Deckkraft, kein Weg)
    const zeile = document.querySelector<HTMLElement>(`[data-datei="${d.id}"]`);
    if (zeile && !bewegungReduziert()) {
      await zeile.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "cubic-bezier(0.4, 0, 0.9, 0.5)", fill: "forwards" }).finished.catch(() => undefined);
    }
    setDateien((liste) => liste.filter((x) => x.id !== d.id));
    try {
      await dateiLoeschen(d.id);
      track("datei_geloescht");
    } catch (err) {
      setDateien((liste) => [d, ...liste]);
      setMeldung("Löschen hat nicht geklappt.");
      fehlerMelden(err, { ort: "datei_loeschen" });
    }
  }

  function sortierenNach(spalte: Sortierung["spalte"]) {
    setSortierung((s) => (s.spalte === spalte ? { spalte, absteigend: !s.absteigend } : { spalte, absteigend: spalte !== "name" }));
  }

  const pfeil = (spalte: Sortierung["spalte"]) => (sortierung.spalte === spalte ? (sortierung.absteigend ? " ↓" : " ↑") : "");
  const ariaSort = (spalte: Sortierung["spalte"]) =>
    sortierung.spalte === spalte ? (sortierung.absteigend ? "descending" : "ascending") : "none";

  const hochladenKnopf = (
    <>
      <button
        type="button"
        className="knopf leise"
        onClick={() => setLinkOffen((o) => !o)}
        disabled={voll}
        aria-expanded={linkOffen}
        title="Datei über einen Link importieren (oder Link mit Strg+V einfügen)"
      >
        <Icon name="link" groesse={16} />
        Aus Link
      </button>
      <button type="button" className="knopf haupt" onClick={() => eingabe.current?.click()} disabled={voll} title={voll ? "Speicher voll" : undefined}>
        <Icon name="hochladen" groesse={16} />
        Hochladen
      </button>
      <input
        ref={eingabe}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUT}
        hidden
        onChange={(e) => {
          if (e.target.files?.length) hochladen(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );

  return (
    <>
      <header className="seitenkopf">
        <div>
          <h1>Dateiablage</h1>
          <p>Alle Uni-Dateien an einem Ort, nach Fach geordnet.</p>
        </div>
        <div className="rechts">{hochladenKnopf}</div>
      </header>
      {linkOffen && (
        <form
          className="crud-form dat-link-form"
          onSubmit={(e) => {
            e.preventDefault();
            linkAbschicken();
          }}
        >
          <label className="dat-link-zeile">
            <span className="sr-only">Link zur Datei</span>
            <input
              className="field"
              type="url"
              inputMode="url"
              autoFocus
              placeholder="https://… Link zur Datei einfügen"
              value={linkWert}
              onChange={(e) => setLinkWert(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setLinkOffen(false);
              }}
            />
          </label>
          <button type="submit" className="knopf haupt" disabled={!linkNormalisieren(linkWert)}>
            Importieren
          </button>
          <button type="button" className="knopf leise" onClick={() => setLinkOffen(false)}>
            Abbrechen
          </button>
          <p className="muted dat-link-tipp">
            Öffne die PDF im Browser, kopiere die Adresse und füg sie hier ein – oder drück einfach Strg+V auf dieser Seite. Die Datei landet im
            Ordner „{aktuellerOrdner.name}“. Links hinter einer Anmeldung (z. B. Moodle, ILIAS) gehen nicht – die Datei dann herunterladen und
            hierher ziehen.
          </p>
        </form>
      )}
      {meldung && (
        <p className="formular-fehler dat-meldung" role="alert">
          {meldung}
          <button type="button" className="knopf leise klein nur-symbol" aria-label="Meldung schließen" onClick={() => setMeldung(null)}>
            <Icon name="schliessen" groesse={16} />
          </button>
        </p>
      )}

      <div className="dat-layout">
        <aside className="dat-ordner" aria-label="Ordner">
          <h2 className="gt">Ordner</h2>
          <ul className="kliste">
            {ordner.map((o) => (
              <li key={o.id ?? "allgemein"}>
                <button
                  type="button"
                  className={`keintrag dat-ordner-knopf${ordnerZiel === o.id ? " ziel" : ""}`}
                  data-ort={o.id ?? "allgemein"}
                  aria-current={o.id === aktuellerOrdner.id ? "true" : undefined}
                  onClick={() => ordnerOeffnen(o.id)}
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes(DRAG_TYP)) {
                      e.preventDefault();
                      setOrdnerZiel(o.id);
                    }
                  }}
                  onDragLeave={() => setOrdnerZiel(undefined)}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData(DRAG_TYP);
                    setOrdnerZiel(undefined);
                    const d = dateien.find((x) => x.id === id);
                    if (d) {
                      e.preventDefault();
                      void verschieben(d, o.id);
                    }
                  }}
                >
                  <OrdnerZeichen ordner={o} />
                  <span className="n">{o.name}</span>
                  <RollText className="z" wert={String(anzahl(o.id))} />
                </button>
              </li>
            ))}
          </ul>

          {/* DAT-09 */}
          <div className="dat-speicher">
            <span className={`balkenf${voll ? " voll" : ""}`} aria-hidden>
              <i style={{ width: `${Math.min(100, (belegt / limit) * 100)}%` }} />
            </span>
            <span className={voll ? "dat-speicher-voll" : undefined}>
              {groesseText(belegt)} von {groesseText(limit)} belegt
            </span>
            {voll && <span className="dat-speicher-voll">Speicher voll – lösche Dateien, um neue hochzuladen.</span>}
          </div>
        </aside>

        <section
          className={`dat-inhalt${ziehenUeber ? " dat-ablegen" : ""}`}
          aria-label={`Dateien in ${aktuellerOrdner.name}`}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files") || e.dataTransfer.types.includes("text/uri-list")) {
              e.preventDefault();
              setZiehenUeber(true);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setZiehenUeber(false);
          }}
          onDrop={(e) => {
            if (!e.dataTransfer.files.length) {
              const link = e.dataTransfer.getData("text/uri-list").split("\n").find((z) => z && !z.startsWith("#")) ?? "";
              if (!linkNormalisieren(link)) return;
              e.preventDefault();
              setZiehenUeber(false);
              if (!voll) void ausLink(link);
              return;
            }
            e.preventDefault();
            setZiehenUeber(false);
            if (!voll) hochladen(e.dataTransfer.files);
          }}
        >
          <h2 className="abschnitt-titel dat-titel">{aktuellerOrdner.name}</h2>

          {uploads.length > 0 && (
            <ul className="dat-uploads" aria-live="polite">
              {uploads.map((u) => (
                <li key={u.schluessel} className={u.fertig ? "fertig" : u.fehler ? "fehler" : ""}>
                  <UploadMarke anteil={u.anteil} fertig={Boolean(u.fertig)} fehler={Boolean(u.fehler)} icon={icon(u.name)} />
                  <span className="dat-upload-name">{u.name}</span>
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
                        aria-label="Hinweis schließen"
                        onClick={() => setUploads((l) => l.filter((x) => x.schluessel !== u.schluessel))}
                      >
                        <Icon name="schliessen" groesse={16} />
                      </button>
                    </>
                  ) : u.vonLink ? (
                    <span className="dat-upload-info">Wird aus dem Link geladen …</span>
                  ) : (
                    <span className="dat-upload-info zahl">{u.fertig ? "Hochgeladen" : `${Math.round(u.anteil * 100)} %`}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {imOrdner.length === 0 ? (
            <Zustand
              art="leer"
              region
              ebene={3}
              icon="dateiablage"
              titel={dateien.length === 0 ? "Noch keine Dateien." : `Noch keine Dateien in ${aktuellerOrdner.name}.`}
              aktion={
                <button type="button" className="knopf neben klein" onClick={() => eingabe.current?.click()} disabled={voll}>
                  <Icon name="hochladen" groesse={16} />
                  Dateien hochladen
                </button>
              }
            >
              {dateien.length === 0
                ? "Lade Skripte, Folien oder Aufnahmen hoch, zieh sie hierher oder füg einen Link zur Datei mit Strg+V ein."
                : "Zieh Dateien hierher oder lade sie hoch. Sie landen automatisch in diesem Ordner."}
            </Zustand>
          ) : (
            <div className="dat-tabelle-wrap">
              <table className="dat-tabelle">
                <thead>
                  <tr>
                    <th className="dat-spalte-typ" aria-label="Typ" />
                    <th aria-sort={ariaSort("name")}>
                      <button type="button" onClick={() => sortierenNach("name")}>
                        Name{pfeil("name")}
                      </button>
                    </th>
                    <th className="dat-spalte-groesse" aria-sort={ariaSort("groesse")}>
                      <button type="button" onClick={() => sortierenNach("groesse")}>
                        Größe{pfeil("groesse")}
                      </button>
                    </th>
                    <th className="dat-spalte-datum" aria-sort={ariaSort("datum")}>
                      <button type="button" onClick={() => sortierenNach("datum")}>
                        Hochgeladen am{pfeil("datum")}
                      </button>
                    </th>
                    <th aria-label="Aktionen" />
                  </tr>
                </thead>
                <tbody>
                  {imOrdner.map((d) => (
                    <tr
                      key={d.id}
                      data-datei={d.id}
                      draggable={umbenennenId !== d.id}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_TYP, d.id);
                        e.dataTransfer.effectAllowed = "move";
                        ziehbildSetzen(e, d.name);
                      }}
                    >
                      <td className="dat-spalte-typ" aria-hidden>
                        <span className="dat-typ">
                          <Icon name={icon(d.name)} groesse={14} />
                        </span>
                      </td>
                      <td className="dat-spalte-name">
                        {umbenennenId === d.id ? (
                          <UmbenennenFeld
                            datei={d}
                            onFertig={(neu) => {
                              setUmbenennenId(null);
                              if (neu) setDateien((liste) => liste.map((x) => (x.id === neu.id ? neu : x)));
                            }}
                          />
                        ) : (
                          <button type="button" className="dat-name-knopf" onClick={() => void oeffnen(d)}>
                            {d.name}
                          </button>
                        )}
                      </td>
                      <td className="dat-spalte-groesse mono">{groesseText(Number(d.groesse))}</td>
                      <td className="dat-spalte-datum">
                        {new Date(d.erstellt_am).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </td>
                      <td className="dat-spalte-aktion">
                        <DreiPunkteMenue
                          punkte={[
                            { label: "Öffnen", onClick: () => void oeffnen(d) },
                            { label: "Umbenennen", onClick: () => setUmbenennenId(d.id) },
                            { label: "Verschieben nach …", onClick: () => setVerschiebenId(d.id) },
                            { label: "Herunterladen", onClick: () => void herunterladen(d) },
                            { label: "Löschen", onClick: () => void loeschen(d), gefahr: true },
                          ]}
                        />
                        {verschiebenId === d.id && (
                          <div className="drei-punkte-menue dat-verschieben" role="menu" aria-label="Verschieben nach">
                            <span className="dat-verschieben-titel">Verschieben nach</span>
                            {ordner
                              .filter((o) => o.id !== (d.fach_id ?? null))
                              .map((o) => (
                                <button key={o.id ?? "allgemein"} type="button" role="menuitem" onClick={() => void verschieben(d, o.id)}>
                                  <OrdnerZeichen ordner={o} /> {o.name}
                                </button>
                              ))}
                            <button type="button" role="menuitem" onClick={() => setVerschiebenId(null)}>
                              Abbrechen
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {ziehenUeber && <div className="dat-ablegen-hinweis">Hier ablegen</div>}
        </section>
      </div>

      {vorschau && <VorschauFenster vorschau={vorschau} onSchliessen={() => setVorschau(null)} />}
    </>
  );
}

/** Inline umbenennen; die Endung (.pdf …) bleibt erhalten. Auch im PDF Reader genutzt. */
export function UmbenennenFeld({ datei, onFertig }: { datei: Pick<Datei, "id" | "name">; onFertig: (neu: Datei | null) => void }) {
  const [wert, setWert] = useState(nameOhneEndung(datei.name));
  const [fehler, setFehler] = useState<string | null>(null);
  const fertig = useRef(false);
  const e = endung(datei.name);

  async function speichern() {
    if (fertig.current) return;
    if (!wert.trim()) {
      setFehler("Name darf nicht leer sein.");
      return;
    }
    if (wert.trim() === nameOhneEndung(datei.name)) {
      fertig.current = true;
      onFertig(null);
      return;
    }
    fertig.current = true;
    try {
      const neu = await dateiUmbenennen(datei.id, wert);
      track("datei_umbenannt");
      onFertig(neu);
    } catch (err) {
      fertig.current = false;
      setFehler(err instanceof Error ? err.message : "Umbenennen hat nicht geklappt.");
    }
  }

  return (
    <span className="dat-umbenennen">
      <input
        className="field"
        value={wert}
        autoFocus
        aria-label="Neuer Name"
        onChange={(ev) => {
          setWert(ev.target.value);
          setFehler(null);
        }}
        onFocus={(ev) => ev.target.select()}
        onKeyDown={(ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            void speichern();
          } else if (ev.key === "Escape") {
            fertig.current = true;
            onFertig(null);
          }
        }}
      />
      {e && <span className="muted">.{e}</span>}
      {fehler && <span className="dat-upload-fehler">{fehler}</span>}
    </span>
  );
}

function VorschauFenster({ vorschau, onSchliessen }: { vorschau: Vorschau; onSchliessen: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dat-vorschau"
      onCancel={(e) => {
        e.preventDefault();
        onSchliessen();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSchliessen();
      }}
    >
      <div className="dat-vorschau-kopf">
        <h2 className="dat-vorschau-titel">{vorschau.name}</h2>
        <button type="button" className="knopf leise klein nur-symbol" aria-label="Schließen" onClick={onSchliessen}>
          <Icon name="schliessen" groesse={16} />
        </button>
      </div>
      {vorschau.art === "bild" ? (
        // eslint-disable-next-line @next/next/no-img-element -- signierte Storage-URL, keine Optimierung nötig
        <img src={vorschau.url} alt={vorschau.name} />
      ) : (
        <>
          <audio src={vorschau.url} controls autoFocus />
          <Link href={`/transkription?datei=${vorschau.id}`} className="knopf neben dat-transkribieren">
            <Icon name="mikrofon" groesse={16} />
            Transkribieren
          </Link>
        </>
      )}
    </dialog>
  );
}
