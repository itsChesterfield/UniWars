"use client";

import { useEffect, useState, useTransition } from "react";
import { materialPapierkorb, materialThemaSpeichern, materialThemaZuordnen, materialThemenSortieren, materialThemenVorschlagAnwenden, materialThemenVorschlagen,
  materialTitelSetzen, materialTitelVorschlagen, materialVerwendungenLaden, type ThemaVorschlag } from "@/app/(hubs)/dateiablage/workflow-actions";
import type { MaterialRef } from "@/lib/dateiablage/material";
import { MaterialDialog } from "./material-dialog";

export function TitelDialog({ material, titel, schliessen, ki }: { material: MaterialRef; titel: string; schliessen: () => void; ki: boolean }) {
  const [name, setName] = useState(titel);
  const [fehler, setFehler] = useState("");
  const [wartet, starten] = useTransition();
  return <MaterialDialog titel="Anzeigetitel bearbeiten" schliessen={schliessen}>
    <form className="dat-workflow-feld" onSubmit={(e) => {
      e.preventDefault();
      starten(async () => {
        try { await materialTitelSetzen(material, name); schliessen(); }
        catch { setFehler("Der Titel konnte nicht gespeichert werden."); }
      });
    }}>
      <label className="dat-workflow-feld">Titel<input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required autoFocus /></label>
      {fehler && <p role="alert">{fehler}</p>}
      <div className="dat-auswahl-form">
        {ki && <button type="button" className="knopf neben" disabled={wartet} onClick={() => starten(async () => {
          try {
            const antwort = await materialTitelVorschlagen(material);
            if (antwort.ok) { setName(antwort.daten); setFehler(""); }
            else setFehler(antwort.fehler);
          } catch { setFehler("Der Titelvorschlag konnte nicht geladen werden."); }
        })}>Titel vorschlagen</button>}
        <button className="knopf haupt" disabled={wartet || !name.trim()}>Speichern</button>
      </div>
    </form>
  </MaterialDialog>;
}

type Thema = { id: string; name: string };
type Eintrag = MaterialRef & { titel: string };
export function ThemenDialog({ fachId, themen, auswahl, offen, titelFuer, ki, schliessen }: {
  fachId: string; themen: Thema[]; auswahl: Eintrag[]; offen: Eintrag[]; titelFuer: (ref: MaterialRef) => string | undefined; ki: boolean; schliessen: () => void;
}) {
  const [name, setName] = useState("");
  const [thema, setThema] = useState("");
  const [ziel, setZiel] = useState("");
  const [vorschlaege, setVorschlaege] = useState<ThemaVorschlag[] | null>(null);
  const [fehler, setFehler] = useState("");
  const [wartet, starten] = useTransition();
  function ausfuehren(aktion: () => Promise<void>) {
    starten(async () => {
      try { await aktion(); setFehler(""); }
      catch { setFehler("Die Themen konnten nicht aktualisiert werden."); }
    });
  }
  const themaPosition = themen.findIndex((t) => t.id === thema);
  function themaVerschieben(richtung: -1 | 1) {
    const zielPosition = themaPosition + richtung;
    if (themaPosition < 0 || zielPosition < 0 || zielPosition >= themen.length) return;
    const reihenfolge = themen.map((t) => t.id);
    reihenfolge.splice(themaPosition, 1);
    reihenfolge.splice(zielPosition, 0, thema);
    ausfuehren(() => materialThemenSortieren(fachId, reihenfolge));
  }
  return <MaterialDialog titel="Themen ordnen" schliessen={schliessen}>
    {fehler && <p role="alert">{fehler}</p>}
    <form className="dat-workflow-feld" onSubmit={(e) => {
      e.preventDefault();
      ausfuehren(async () => { await materialThemaSpeichern(fachId, name, thema || undefined); setName(""); setThema(""); });
    }}>
      <label className="dat-workflow-feld">Thema
        <select className="field" value={thema} onChange={(e) => {
          setThema(e.target.value);
          setName(themen.find((t) => t.id === e.target.value)?.name ?? "");
        }}>
          <option value="">Neues Thema</option>
          {themen.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <label className="dat-workflow-feld">Name<input className="field" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} /></label>
      <div className="dat-auswahl-form">
        <button className="knopf neben" disabled={wartet || !name.trim()}>{thema ? "Umbenennen" : "Thema anlegen"}</button>
        {themaPosition >= 0 && themen.length > 1 && <>
          <button type="button" className="knopf neben" disabled={wartet || themaPosition === 0} onClick={() => themaVerschieben(-1)}>Nach oben</button>
          <button type="button" className="knopf neben" disabled={wartet || themaPosition === themen.length - 1} onClick={() => themaVerschieben(1)}>Nach unten</button>
        </>}
      </div>
    </form>
    {auswahl.length > 0 && <form className="dat-workflow-feld" onSubmit={(e) => {
      e.preventDefault();
      ausfuehren(async () => { await materialThemaZuordnen(auswahl, fachId, ziel || null); schliessen(); });
    }}>
      <label className="dat-workflow-feld">Thema für ausgewählte Unterlagen
        <select className="field" value={ziel} onChange={(e) => setZiel(e.target.value)}>
          <option value="">Ohne Thema</option>
          {themen.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <button className="knopf neben" disabled={wartet}>Auswahl zuordnen</button>
    </form>}
    {ki && offen.length >= 2 && <button type="button" className="knopf neben" disabled={wartet} onClick={() => {
      starten(async () => {
        try {
          const antwort = await materialThemenVorschlagen(fachId, offen.slice(0, 40));
          if (antwort.ok) { setVorschlaege(antwort.daten); setFehler(""); }
          else setFehler(antwort.fehler);
        } catch { setFehler("Themenvorschläge konnten nicht geladen werden."); }
      });
    }}>Themen vorschlagen</button>}
    {vorschlaege?.length === 0 && <p>Keine eindeutigen Themen gefunden.</p>}
    {vorschlaege && <ul className="dat-workflow-liste">{vorschlaege.map((v, i) => (
      <li key={i} className="dat-workflow-feld">
        <label className="dat-workflow-feld">Themenname<input className="field" value={v.name} maxLength={100} onChange={(e) => setVorschlaege(vorschlaege.map((a, n) => n === i ? { ...a, name: e.target.value } : a))} /></label>
        <span>{v.material.map(titelFuer).filter(Boolean).join(", ")}</span>
        <button className="knopf neben klein" type="button" disabled={wartet || !v.name.trim()} onClick={() => ausfuehren(async () => {
          await materialThemenVorschlagAnwenden(fachId, v);
          setVorschlaege((vorher) => vorher?.filter((_, n) => n !== i) ?? null);
        })}>Übernehmen</button>
      </li>
    ))}</ul>}
  </MaterialDialog>;
}

export function PapierkorbDialog({ material, titel, faecher, schliessen, abgelegt }: {
  material: MaterialRef; titel: string; faecher: string[]; schliessen: () => void; abgelegt: () => void;
}) {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof materialVerwendungenLaden>>>();
  const [fehler, setFehler] = useState("");
  const [wartet, starten] = useTransition();
  const { art, id } = material;
  useEffect(() => {
    let aktiv = true;
    void materialVerwendungenLaden({ art, id }).then((d) => { if (aktiv) setInfo(d); }).catch(() => {
      if (aktiv) setFehler("Die Verwendung konnte nicht geladen werden.");
    });
    return () => { aktiv = false; };
  }, [art, id]);
  return <MaterialDialog titel="In den Papierkorb verschieben" schliessen={schliessen}>
    <p>{titel}</p>
    {!!faecher.length && <p>Fächer: {faecher.join(", ")}</p>}
    {info ? <ul>
      {info.verknuepfungen.map((v) => <li key={v.id}>{v.titel}</li>)}
      {info.pakete.map((paket) => <li key={paket.id}>Materialpaket „{paket.titel}“</li>)}
      {info.freigaben > 0 && <li>{info.freigaben} Freigaben</li>}
    </ul> : !fehler && <p role="status">Verwendung wird geladen</p>}
    {fehler && <p role="alert">{fehler}</p>}
    <button type="button" className="knopf neben dat-aktion-einzeilig" disabled={wartet || !info} onClick={() => starten(async () => {
      try { await materialPapierkorb(material, true); abgelegt(); }
      catch { setFehler("Die Unterlage konnte nicht in den Papierkorb verschoben werden."); }
    })}>In den Papierkorb verschieben</button>
  </MaterialDialog>;
}
