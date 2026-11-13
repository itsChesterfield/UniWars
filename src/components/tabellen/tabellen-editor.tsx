"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { tabelleFachSetzen, tabelleLoeschen, tabelleSpeichern } from "@/app/(hubs)/tabellen/actions";
import { DreiPunkteMenue } from "@/components/hubs/drei-punkte-menue";
import { OHNE_TITEL_TABELLE } from "@/components/tabellen/tabellen-liste";
import { SPEICHER_TEXT, useAutoSpeichern } from "@/lib/hubs/auto-speichern";
import { KiFormelDialog } from "@/components/tabellen/ki-formel-dialog";
import {
  FEHLER,
  MAX_SPALTEN,
  MAX_ZEILEN,
  adresse,
  alsCsv,
  anzeigen,
  auswerten,
  einfuegen,
  istFehler,
  loeschen,
  spaltenName,
  type TabellenDaten,
  type Zahlenformat,
  type Zelle,
  zerlegen,
} from "@/lib/tabellen/formeln";
import { dateiname, dateiSpeichern } from "@/lib/textverarbeitung/docx-export";
import type { FachOption } from "@/lib/fach-option";
import { fehlerMelden, track } from "@/lib/analytics";

type Pos = { s: number; z: number };
type Bearbeitung = { s: number; z: number; wert: string; quelle: "zelle" | "leiste" };
type Kontext = { art: "zeile" | "spalte"; index: number; x: number; y: number };

const FARBEN = [
  { name: "Gelb", wert: "#FFF2B3" },
  { name: "Grün", wert: "#D7F0D2" },
  { name: "Blau", wert: "#D6E4F7" },
  { name: "Rot", wert: "#F8D7D3" },
  { name: "Lila", wert: "#E6DAF2" },
  { name: "Grau", wert: "#E8E4DA" },
];

function bereich(a: Pos, b: Pos) {
  return { s1: Math.min(a.s, b.s), s2: Math.max(a.s, b.s), z1: Math.min(a.z, b.z), z2: Math.max(a.z, b.z) };
}

export function TabellenEditor({
  id,
  startTitel,
  startFachId,
  startDaten,
  faecher,
  istNeu,
  kiVerfuegbar = false,
}: {
  id: string;
  startTitel: string;
  startFachId: string | null;
  startDaten: TabellenDaten;
  faecher: FachOption[];
  istNeu: boolean;
  /** KI-10 Formel-Helfer */
  kiVerfuegbar?: boolean;
}) {
  const router = useRouter();
  const [titel, setTitel] = useState(startTitel);
  const [fachId, setFachId] = useState(startFachId);
  const [daten, setDaten] = useState(startDaten);
  const [anker, setAnker] = useState<Pos>({ s: 0, z: 0 });
  const [ende, setEnde] = useState<Pos>({ s: 0, z: 0 });
  const [bearbeitung, setBearbeitung] = useState<Bearbeitung | null>(null);
  const [kontext, setKontext] = useState<Kontext | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const rasterRef = useRef<HTMLDivElement>(null);
  const { status, aendern, jetztSpeichern } = useAutoSpeichern<{ titel: string; daten: TabellenDaten }>((a) => tabelleSpeichern(id, a));
  const [kiFormel, setKiFormel] = useState<string | null>(null);

  const werte = useMemo(() => auswerten(daten), [daten]);
  const sel = bereich(anker, ende);
  const ankerRef = adresse(anker.s, anker.z);
  const ankerZelle = daten.zellen[ankerRef];

  const datenAendern = useCallback(
    (neu: TabellenDaten) => {
      setDaten(neu);
      aendern({ daten: neu });
    },
    [aendern],
  );

  function zellenSetzen(fn: (zelle: Zelle, ref: string) => Zelle | null, nurAnker = false) {
    const zellen = { ...daten.zellen };
    const b = nurAnker ? { s1: anker.s, s2: anker.s, z1: anker.z, z2: anker.z } : sel;
    for (let z = b.z1; z <= b.z2; z++) {
      for (let s = b.s1; s <= b.s2; s++) {
        const ref = adresse(s, z);
        const neu = fn(zellen[ref] ?? {}, ref);
        if (!neu || (!neu.w && !neu.f && !neu.bg && (!neu.fmt || neu.fmt === "std"))) delete zellen[ref];
        else zellen[ref] = neu;
      }
    }
    datenAendern({ ...daten, zellen });
  }

  function auswaehlen(pos: Pos, erweitern = false) {
    const p = { s: Math.min(Math.max(0, pos.s), daten.spalten - 1), z: Math.min(Math.max(0, pos.z), daten.zeilen - 1) };
    if (!erweitern) setAnker(p);
    setEnde(p);
    requestAnimationFrame(() => {
      rasterRef.current?.querySelector(`[data-ref="${adresse(p.s, p.z)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  // --- TAB-02: Bearbeiten -------------------------------------------------------
  function bearbeitenStarten(start?: string, quelle: "zelle" | "leiste" = "zelle") {
    setBearbeitung({ s: anker.s, z: anker.z, wert: start ?? ankerZelle?.w ?? "", quelle });
  }

  function uebernehmen(weiter?: "unten" | "rechts" | "links" | "oben") {
    if (!bearbeitung) return;
    const ref = adresse(bearbeitung.s, bearbeitung.z);
    const alt = daten.zellen[ref]?.w ?? "";
    if (bearbeitung.wert !== alt) {
      const zellen = { ...daten.zellen };
      const neu: Zelle = { ...(zellen[ref] ?? {}), w: bearbeitung.wert || undefined };
      if (!neu.w && !neu.f && !neu.bg && (!neu.fmt || neu.fmt === "std")) delete zellen[ref];
      else zellen[ref] = neu;
      datenAendern({ ...daten, zellen });
      if (bearbeitung.wert.startsWith("=")) track("tabelle_formel", { gueltig: true });
    }
    setBearbeitung(null);
    const p = { s: bearbeitung.s, z: bearbeitung.z };
    if (weiter === "unten") auswaehlen({ ...p, z: p.z + 1 });
    else if (weiter === "rechts") auswaehlen({ ...p, s: p.s + 1 });
    else if (weiter === "links") auswaehlen({ ...p, s: p.s - 1 });
    else if (weiter === "oben") auswaehlen({ ...p, z: p.z - 1 });
    rasterRef.current?.focus({ preventScroll: true });
  }

  function abbrechen() {
    setBearbeitung(null);
    rasterRef.current?.focus({ preventScroll: true });
  }

  function rasterTaste(e: React.KeyboardEvent) {
    if (bearbeitung) return;
    const erweitern = e.shiftKey;
    const pos = ende;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        auswaehlen({ ...pos, z: pos.z + 1 }, erweitern);
        return;
      case "ArrowUp":
        e.preventDefault();
        auswaehlen({ ...pos, z: pos.z - 1 }, erweitern);
        return;
      case "ArrowRight":
        e.preventDefault();
        auswaehlen({ ...pos, s: pos.s + 1 }, erweitern);
        return;
      case "ArrowLeft":
        e.preventDefault();
        auswaehlen({ ...pos, s: pos.s - 1 }, erweitern);
        return;
      case "Tab":
        e.preventDefault();
        auswaehlen({ s: anker.s + (e.shiftKey ? -1 : 1), z: anker.z });
        return;
      case "Enter":
      case "F2":
        e.preventDefault();
        bearbeitenStarten();
        return;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        zellenSetzen((z) => ({ ...z, w: undefined }));
        return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      fettUmschalten();
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      bearbeitenStarten(e.key);
    }
  }

  function eingabeTaste(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      uebernehmen(e.shiftKey ? "oben" : "unten");
    } else if (e.key === "Tab") {
      e.preventDefault();
      uebernehmen(e.shiftKey ? "links" : "rechts");
    } else if (e.key === "Escape") {
      e.preventDefault();
      abbrechen();
    }
  }

  // --- TAB-05: Formatierung -----------------------------------------------------
  function fettUmschalten() {
    const neu = !ankerZelle?.f;
    zellenSetzen((z) => ({ ...z, f: neu || undefined }));
  }

  function hintergrund(farbe: string | null) {
    zellenSetzen((z) => ({ ...z, bg: farbe ?? undefined }));
  }

  function zahlenformat(fmt: Zahlenformat) {
    zellenSetzen((z) => ({ ...z, fmt: fmt === "std" ? undefined : fmt }));
  }

  // --- TAB-03: Zeilen/Spalten ---------------------------------------------------
  function strukturAendern(aktion: "davor" | "danach" | "loeschen", art: "zeile" | "spalte", index: number) {
    setKontext(null);
    const neu =
      aktion === "loeschen" ? loeschen(daten, art, index) : einfuegen(daten, art, aktion === "davor" ? index : index + 1);
    if (!neu) {
      setHinweis(
        aktion === "loeschen"
          ? "Die letzte Zeile/Spalte kann nicht gelöscht werden."
          : art === "zeile"
            ? `Maximal ${MAX_ZEILEN} Zeilen.`
            : `Maximal ${MAX_SPALTEN} Spalten (A–Z).`,
      );
      return;
    }
    datenAendern(neu);
    auswaehlen({ s: Math.min(anker.s, neu.spalten - 1), z: Math.min(anker.z, neu.zeilen - 1) });
    track("tabelle_struktur", { aktion, art });
  }

  // --- TAB-06: Export -------------------------------------------------------------
  async function exportieren(art: "csv" | "xlsx") {
    track("tabelle_exportiert", { format: art });
    const name = titel || OHNE_TITEL_TABELLE;
    try {
      if (art === "csv") {
        dateiSpeichern(new Blob([alsCsv(daten)], { type: "text/csv;charset=utf-8" }), dateiname(name, "csv"));
      } else {
        const { alsXlsx } = await import("@/lib/tabellen/xlsx");
        const bytes = alsXlsx(name, daten);
        dateiSpeichern(
          new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
          dateiname(name, "xlsx"),
        );
      }
    } catch (err) {
      setHinweis("Export hat nicht geklappt.");
      fehlerMelden(err, { ort: "tabelle_export" });
    }
  }

  async function entfernen() {
    if (!window.confirm(`„${titel || OHNE_TITEL_TABELLE}“ wirklich löschen?`)) return;
    try {
      await tabelleLoeschen(id);
      track("tabelle_geloescht");
      router.push("/tabellen");
    } catch (err) {
      fehlerMelden(err, { ort: "tabelle_loeschen" });
      window.alert("Löschen hat nicht geklappt.");
    }
  }

  useEffect(() => {
    if (!kontext) return;
    const zu = () => setKontext(null);
    window.addEventListener("click", zu);
    window.addEventListener("scroll", zu, true);
    return () => {
      window.removeEventListener("click", zu);
      window.removeEventListener("scroll", zu, true);
    };
  }, [kontext]);

  useEffect(() => {
    if (!hinweis) return;
    const t = window.setTimeout(() => setHinweis(null), 3500);
    return () => window.clearTimeout(t);
  }, [hinweis]);

  const ankerWert = werte.get(ankerRef);
  const leistenWert = bearbeitung ? bearbeitung.wert : (ankerZelle?.w ?? "");
  const auswahlText = sel.s1 === sel.s2 && sel.z1 === sel.z2 ? ankerRef : `${adresse(sel.s1, sel.z1)}:${adresse(sel.s2, sel.z2)}`;

  const spalten = Array.from({ length: daten.spalten }, (_, i) => i);
  const zeilen = Array.from({ length: daten.zeilen }, (_, i) => i);

  return (
    <div className="tab-seite">
      <div className="txt-kopf">
        <Link href="/tabellen" className="hub-zurueck-link">
          ← Alle Tabellen
        </Link>
        <div className="txt-kopf-zeile">
          <input
            className="notiz-titel txt-titel"
            value={titel}
            placeholder={OHNE_TITEL_TABELLE}
            aria-label="Titel"
            maxLength={300}
            autoFocus={istNeu}
            onChange={(e) => {
              setTitel(e.target.value);
              aendern({ titel: e.target.value });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") rasterRef.current?.focus();
            }}
          />
          <div className="txt-kopf-aktionen">
            <span className={`speicher-status ${status}`} aria-live="polite">
              {SPEICHER_TEXT[status]}
            </span>
            <select
              className="field txt-fach"
              aria-label="Fach"
              value={fachId ?? ""}
              onChange={(e) => {
                setFachId(e.target.value || null);
                tabelleFachSetzen(id, e.target.value || null).catch((err) => fehlerMelden(err, { ort: "tabelle_fach" }));
              }}
            >
              <option value="">Ohne Fach</option>
              {faecher.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <DreiPunkteMenue
              label="Exportieren und mehr"
              punkte={[
                { label: "Als CSV exportieren", onClick: () => void exportieren("csv") },
                { label: "Als Excel (.xlsx) exportieren", onClick: () => void exportieren("xlsx") },
                { label: "Löschen", onClick: () => void entfernen(), gefahr: true },
              ]}
            />
          </div>
        </div>
      </div>

      {/* TAB-05 */}
      <div className="txt-werkzeuge tab-werkzeuge" role="toolbar" aria-label="Formatierung">
        <button
          type="button"
          className={`md-knopf md-fett ${ankerZelle?.f ? "an" : ""}`}
          aria-pressed={Boolean(ankerZelle?.f)}
          title="Fett (Strg+B)"
          aria-label="Fett"
          onClick={fettUmschalten}
        >
          B
        </button>
        <span className="txt-trenner" />
        <span className="tab-farben" role="group" aria-label="Hintergrundfarbe">
          <button type="button" className="tab-farbe tab-farbe-keine" title="Kein Hintergrund" aria-label="Kein Hintergrund" onClick={() => hintergrund(null)}>
            ⌀
          </button>
          {FARBEN.map((f) => (
            <button
              key={f.wert}
              type="button"
              className={`tab-farbe ${ankerZelle?.bg === f.wert ? "an" : ""}`}
              style={{ background: f.wert }}
              title={f.name}
              aria-label={`Hintergrund ${f.name}`}
              onClick={() => hintergrund(f.wert)}
            />
          ))}
        </span>
        <span className="txt-trenner" />
        <select
          className="field txt-block"
          aria-label="Zahlenformat"
          value={ankerZelle?.fmt ?? "std"}
          onChange={(e) => zahlenformat(e.target.value as Zahlenformat)}
        >
          <option value="std">Standard</option>
          <option value="2">2 Nachkommastellen</option>
          <option value="%">Prozent</option>
        </select>
        <span className="txt-trenner" />
        <button type="button" className="md-knopf" title="Zeile unter der Auswahl einfügen" onClick={() => strukturAendern("danach", "zeile", anker.z)}>
          + Zeile
        </button>
        <button type="button" className="md-knopf" title="Spalte rechts der Auswahl einfügen" onClick={() => strukturAendern("danach", "spalte", anker.s)}>
          + Spalte
        </button>
        {hinweis && <span className="tab-hinweis">{hinweis}</span>}
      </div>

      {kiFormel && (
        <KiFormelDialog
          tabelleId={id}
          zielZelle={kiFormel}
          vorher={jetztSpeichern}
          onSchliessen={() => setKiFormel(null)}
          onEinfuegen={(formel) => {
            const ziel = zerlegen(kiFormel);
            setKiFormel(null);
            if (!ziel) return;
            const zellen = { ...daten.zellen, [kiFormel]: { ...(daten.zellen[kiFormel] ?? {}), w: formel } };
            datenAendern({ ...daten, zellen });
            track("tabelle_formel", { gueltig: true, ki: true });
            rasterRef.current?.focus({ preventScroll: true });
          }}
        />
      )}

      {/* TAB-04: Formelzeile */}
      <div className="tab-formelzeile">
        <span className="tab-adresse mono" aria-label="Ausgewählte Zelle">
          {auswahlText}
        </span>
        <span className="tab-fx" aria-hidden>
          fx
        </span>
        {kiVerfuegbar && (
          <button
            type="button"
            className="icon-knopf ki-formel-knopf"
            aria-label={`Formel-Helfer für Zelle ${ankerRef}`}
            title="✨ Formel-Helfer: beschreib, was du berechnen willst"
            onClick={() => {
              setBearbeitung(null);
              setKiFormel(ankerRef);
            }}
          >
            ✨
          </button>
        )}
        <input
          className="field mono"
          aria-label="Inhalt bzw. Formel der Zelle"
          value={leistenWert}
          placeholder="Wert oder Formel, z. B. =SUMME(A1:A10)"
          onFocus={() => {
            if (!bearbeitung) bearbeitenStarten(undefined, "leiste");
          }}
          onChange={(e) =>
            setBearbeitung((b) => (b ? { ...b, wert: e.target.value } : { s: anker.s, z: anker.z, wert: e.target.value, quelle: "leiste" }))
          }
          onKeyDown={eingabeTaste}
          onBlur={() => {
            if (bearbeitung?.quelle === "leiste") uebernehmen();
          }}
        />
        {ankerZelle?.w?.startsWith("=") && !bearbeitung && (
          <span className={`tab-ergebnis mono ${ankerWert !== undefined && istFehler(ankerWert) ? "fehler" : ""}`}>
            = {anzeigen(ankerWert, ankerZelle.fmt)}
          </span>
        )}
      </div>

      <div className="tab-raster card" ref={rasterRef} tabIndex={0} onKeyDown={rasterTaste} aria-label="Tabelle" role="grid">
        <table>
          <thead>
            <tr>
              <th className="tab-ecke" />
              {spalten.map((s) => (
                <th
                  key={s}
                  className={`tab-kopf ${s >= sel.s1 && s <= sel.s2 ? "markiert" : ""}`}
                  onClick={() => {
                    setAnker({ s, z: 0 });
                    setEnde({ s, z: daten.zeilen - 1 });
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setKontext({ art: "spalte", index: s, x: e.clientX, y: e.clientY });
                  }}
                  title="Rechtsklick: Spalte einfügen oder löschen"
                >
                  {spaltenName(s)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z) => (
              <tr key={z}>
                <th
                  className={`tab-zeilenkopf ${z >= sel.z1 && z <= sel.z2 ? "markiert" : ""}`}
                  onClick={() => {
                    setAnker({ s: 0, z });
                    setEnde({ s: daten.spalten - 1, z });
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setKontext({ art: "zeile", index: z, x: e.clientX, y: e.clientY });
                  }}
                  title="Rechtsklick: Zeile einfügen oder löschen"
                >
                  {z + 1}
                </th>
                {spalten.map((s) => {
                  const ref = adresse(s, z);
                  const zelle = daten.zellen[ref];
                  const w = werte.get(ref);
                  const imBereich = s >= sel.s1 && s <= sel.s2 && z >= sel.z1 && z <= sel.z2;
                  const istAnker = s === anker.s && z === anker.z;
                  const bearbeitet = bearbeitung?.quelle === "zelle" && bearbeitung.s === s && bearbeitung.z === z;
                  const text = anzeigen(w, zelle?.fmt);
                  return (
                    <td
                      key={s}
                      data-ref={ref}
                      role="gridcell"
                      aria-selected={imBereich}
                      className={[
                        typeof w === "number" ? "zahl" : "",
                        text === FEHLER ? "fehler" : "",
                        zelle?.f ? "fett" : "",
                        imBereich ? "bereich" : "",
                        istAnker ? "anker" : "",
                      ].join(" ")}
                      style={zelle?.bg ? { background: zelle.bg } : undefined}
                      onMouseDown={(e) => {
                        if (bearbeitet) return;
                        if (bearbeitung) uebernehmen();
                        e.preventDefault();
                        rasterRef.current?.focus({ preventScroll: true });
                        auswaehlen({ s, z }, e.shiftKey);
                      }}
                      onMouseEnter={(e) => {
                        if (e.buttons === 1 && !bearbeitung) setEnde({ s, z });
                      }}
                      onDoubleClick={() => bearbeitenStarten()}
                    >
                      {bearbeitet ? (
                        <input
                          className="tab-eingabe"
                          autoFocus
                          value={bearbeitung.wert}
                          aria-label={`Zelle ${ref}`}
                          onChange={(e) => setBearbeitung({ ...bearbeitung, wert: e.target.value })}
                          onKeyDown={eingabeTaste}
                          onBlur={() => uebernehmen()}
                        />
                      ) : (
                        text
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="faint tab-tipp">
        Tipp: Enter springt nach unten, Tab nach rechts. Formeln beginnen mit „=“, z. B. =SUMME(A1:A10), =MITTELWERT(B2:B5), =A1*2.
        Rechtsklick auf Zeilen- oder Spaltenkopf zum Einfügen/Löschen.
      </p>

      {kontext && (
        <div className="drei-punkte-menue tab-kontext" style={{ left: kontext.x, top: kontext.y }} role="menu" onClick={(e) => e.stopPropagation()}>
          <span className="faint dat-verschieben-titel">
            {kontext.art === "zeile" ? `Zeile ${kontext.index + 1}` : `Spalte ${spaltenName(kontext.index)}`}
          </span>
          <button type="button" role="menuitem" onClick={() => strukturAendern("davor", kontext.art, kontext.index)}>
            {kontext.art === "zeile" ? "Zeile davor einfügen" : "Spalte davor einfügen"}
          </button>
          <button type="button" role="menuitem" onClick={() => strukturAendern("danach", kontext.art, kontext.index)}>
            {kontext.art === "zeile" ? "Zeile danach einfügen" : "Spalte danach einfügen"}
          </button>
          <button type="button" role="menuitem" className="gefahr" onClick={() => strukturAendern("loeschen", kontext.art, kontext.index)}>
            {kontext.art === "zeile" ? "Zeile löschen" : "Spalte löschen"}
          </button>
        </div>
      )}
    </div>
  );
}
