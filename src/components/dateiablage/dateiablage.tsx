"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { HubKopf, LeererZustand } from "@/components/hubs/hub-bausteine";
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

type Upload = { schluessel: string; name: string; anteil: number; fehler: string | null; vonLink?: boolean };
type Sortierung = { spalte: "name" | "datum" | "groesse"; absteigend: boolean };
type Vorschau = { art: "bild" | "audio"; url: string; name: string; id: string };

const ART_ICON: Record<DateiArt, string> = { pdf: "📕", bild: "🖼️", office: "📄", text: "📝", audio: "🎵" };
const OFFICE_ICON: Record<string, string> = { docx: "📘", pptx: "📙", xlsx: "📗" };

function icon(name: string) {
  const typ = dateiTyp(name);
  if (!typ) return "📄";
  return typ.art === "office" ? (OFFICE_ICON[endung(name)] ?? "📄") : ART_ICON[typ.art];
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
      setDateien((liste) => [neu, ...liste]);
      setUploads((liste) => liste.filter((u) => u.schluessel !== schluessel));
      track("datei_hochgeladen", { art: dateiTyp(datei.name)?.art ?? "unbekannt", kb: Math.round(datei.size / 1024), mit_fach: Boolean(fachId) });
    } catch (err) {
      if (ticketPfad) void uploadVerwerfen(ticketPfad).catch(() => undefined);
      setzen({ fehler: err instanceof Error ? err.message : "Upload fehlgeschlagen." });
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
      neue.push({ schluessel, name: datei.name, anteil: 0, fehler: null });
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
    try {
      const neu = await dateiVerschieben(d.id, fachId);
      setDateien((liste) => liste.map((x) => (x.id === d.id ? neu : x)));
      track("datei_verschoben");
    } catch (err) {
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
        className="btng"
        onClick={() => setLinkOffen((o) => !o)}
        disabled={voll}
        aria-expanded={linkOffen}
        title="Datei über einen Link importieren (oder Link mit Strg+V einfügen)"
      >
        🔗 Aus Link
      </button>
      <button type="button" className="btnp" onClick={() => eingabe.current?.click()} disabled={voll} title={voll ? "Speicher voll" : undefined}>
        ⤒ Hochladen
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
      <HubKopf titel="Dateiablage" untertitel="Alle Uni-Dateien an einem Ort, nach Fach geordnet." aktionen={hochladenKnopf} />
      {linkOffen && (
        <form
          className="card dat-link-form"
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
          <button type="submit" className="btnp" disabled={!linkNormalisieren(linkWert)}>
            Importieren
          </button>
          <button type="button" className="btng" onClick={() => setLinkOffen(false)}>
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
        <p className="auth-error" role="alert">
          {meldung}{" "}
          <button type="button" className="icon-knopf" aria-label="Meldung schließen" onClick={() => setMeldung(null)}>
            ✕
          </button>
        </p>
      )}

      <div className="dat-layout">
        <aside className="card dat-ordner" aria-label="Ordner">
          <ul>
            {ordner.map((o) => (
              <li key={o.id ?? "allgemein"}>
                <button
                  type="button"
                  className={`dat-ordner-knopf ${o.id === aktuellerOrdner.id ? "aktiv" : ""} ${ordnerZiel === o.id ? "ziel" : ""}`}
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
                  <span aria-hidden style={{ color: o.farbe ?? undefined }}>
                    {o.id ? "📁" : "🗂️"}
                  </span>
                  <span className="dat-ordner-name">{o.name}</span>
                  <span className="faint">({anzahl(o.id)})</span>
                </button>
              </li>
            ))}
          </ul>

          {/* DAT-09 */}
          <div className="dat-speicher">
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${Math.min(100, (belegt / limit) * 100)}%`, background: voll ? "var(--danger)" : undefined }}
              />
            </div>
            <span className={voll ? "dat-speicher-voll" : "muted"}>
              {groesseText(belegt)} von {groesseText(limit)} belegt
            </span>
            {voll && <span className="dat-speicher-voll">Speicher voll – lösche Dateien, um neue hochzuladen.</span>}
          </div>
        </aside>

        <section
          className={`card dat-inhalt ${ziehenUeber ? "dat-ablegen" : ""}`}
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
          <h2 className="ct dat-titel">{aktuellerOrdner.name}</h2>

          {uploads.length > 0 && (
            <ul className="dat-uploads" aria-live="polite">
              {uploads.map((u) => (
                <li key={u.schluessel} className={u.fehler ? "fehler" : ""}>
                  <span className="dat-upload-name">{u.name}</span>
                  {u.fehler ? (
                    <>
                      <span className="dat-upload-fehler">{u.fehler}</span>
                      <button
                        type="button"
                        className="icon-knopf"
                        aria-label="Hinweis schließen"
                        onClick={() => setUploads((l) => l.filter((x) => x.schluessel !== u.schluessel))}
                      >
                        ✕
                      </button>
                    </>
                  ) : u.vonLink ? (
                    <span className="faint">🔗 Wird aus dem Link geladen …</span>
                  ) : (
                    <>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${Math.round(u.anteil * 100)}%` }} />
                      </div>
                      <span className="mono faint">{Math.round(u.anteil * 100)} %</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {imOrdner.length === 0 ? (
            <LeererZustand
              icon="📂"
              text={
                dateien.length === 0
                  ? "Noch keine Dateien. Lade Skripte, Folien oder Aufnahmen hoch, zieh sie hierher – oder füg einen Link zur Datei mit Strg+V ein."
                  : "Dieser Ordner ist leer. Zieh Dateien hierher oder lade sie hoch."
              }
              aktion={
                <button type="button" className="btnp hub-leer-knopf" onClick={() => eingabe.current?.click()} disabled={voll}>
                  ⤒ Dateien hochladen
                </button>
              }
            />
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
                      draggable={umbenennenId !== d.id}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_TYP, d.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                    >
                      <td className="dat-spalte-typ" aria-hidden>
                        {icon(d.name)}
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
                            <span className="faint dat-verschieben-titel">Verschieben nach</span>
                            {ordner
                              .filter((o) => o.id !== (d.fach_id ?? null))
                              .map((o) => (
                                <button key={o.id ?? "allgemein"} type="button" role="menuitem" onClick={() => void verschieben(d, o.id)}>
                                  {o.id ? "📁" : "🗂️"} {o.name}
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

function UmbenennenFeld({ datei, onFertig }: { datei: Datei; onFertig: (neu: Datei | null) => void }) {
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
      className="card dat-vorschau"
      onCancel={(e) => {
        e.preventDefault();
        onSchliessen();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSchliessen();
      }}
    >
      <div className="rowb">
        <h3 className="dat-vorschau-titel">{vorschau.name}</h3>
        <button type="button" className="icon-knopf" aria-label="Schließen" onClick={onSchliessen}>
          ✕
        </button>
      </div>
      {vorschau.art === "bild" ? (
        // eslint-disable-next-line @next/next/no-img-element -- signierte Storage-URL, keine Optimierung nötig
        <img src={vorschau.url} alt={vorschau.name} />
      ) : (
        <>
          <audio src={vorschau.url} controls autoFocus />
          <Link href={`/transkription?datei=${vorschau.id}`} className="btng dat-transkribieren">
            🎙️ Transkribieren
          </Link>
        </>
      )}
    </dialog>
  );
}
