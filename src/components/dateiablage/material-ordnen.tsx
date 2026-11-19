"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { materialAutomatischEinsortieren, materialPapierkorb, materialThemaSpeichern, materialThemaZuordnen, materialThemenSortieren, materialThemenVorschlagAnwenden, materialThemenVorschlagen,
  materialTitelSetzen, materialTitelVorschlagen, materialVerwendungenLaden, type ThemaVorschlag } from "@/app/(hubs)/dateiablage/workflow-actions";
import type { MaterialRef } from "@/lib/dateiablage/material";
import { MaterialDialog } from "./material-dialog";
import { Icon } from "@/components/nav-icon";

export function TitelDialog({ material, titel, schliessen, ki, direkt }: {
  material: MaterialRef; titel: string; schliessen: () => void; ki: boolean; direkt: boolean;
}) {
  const [name, setName] = useState(titel);
  const [fehler, setFehler] = useState("");
  const [wartet, starten] = useTransition();
  const [wirdVorgeschlagen, setWirdVorgeschlagen] = useState(direkt);
  const anfrage = useRef<ReturnType<typeof materialTitelVorschlagen> | null>(null);
  const { art, id } = material;
  useEffect(() => {
    if (!direkt) return;
    let aktiv = true;
    anfrage.current ??= materialTitelVorschlagen({ art, id });
    void anfrage.current.then((antwort) => {
      if (!aktiv) return;
      if (antwort.ok) setName(antwort.daten);
      else setFehler(antwort.fehler);
    }).catch(() => {
      if (aktiv) setFehler("Der Titelvorschlag konnte nicht geladen werden.");
    }).finally(() => {
      if (aktiv) setWirdVorgeschlagen(false);
    });
    return () => { aktiv = false; };
  }, [art, id, direkt]);
  return <MaterialDialog titel="Anzeigetitel bearbeiten" schliessen={schliessen}>
    <form className="dat-workflow-feld" onSubmit={(e) => {
      e.preventDefault();
      starten(async () => {
        try { await materialTitelSetzen(material, name); schliessen(); }
        catch { setFehler("Der Titel konnte nicht gespeichert werden."); }
      });
    }}>
      <label className="dat-workflow-feld">Titel<input className="field" value={name} disabled={wirdVorgeschlagen} onChange={(e) => setName(e.target.value)} maxLength={200} required autoFocus /></label>
      {fehler && <p role="alert">{fehler}</p>}
      {wirdVorgeschlagen && <p role="status">Studio liest die Unterlage und schlägt einen Titel vor …</p>}
      <div className="dat-auswahl-form">
        {ki && <button type="button" className="knopf neben" disabled={wartet || wirdVorgeschlagen} onClick={() => starten(async () => {
          try {
            const antwort = await materialTitelVorschlagen(material);
            if (antwort.ok) { setName(antwort.daten); setFehler(""); }
            else setFehler(antwort.fehler);
          } catch { setFehler("Der Titelvorschlag konnte nicht geladen werden."); }
        })}>Titel vorschlagen</button>}
        <button className="knopf haupt" disabled={wartet || wirdVorgeschlagen || !name.trim()}>Speichern</button>
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
  const [hinweis, setHinweis] = useState("");
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
      ausfuehren(async () => {
        const id = await materialThemaSpeichern(fachId, name, thema || undefined);
        setName("");
        setThema("");
        if (!thema && auswahl.length) {
          setZiel(id);
          await materialThemaZuordnen(auswahl, fachId, id);
          schliessen();
        }
      });
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
        <button className="knopf neben" disabled={wartet || !name.trim()}>{thema ? "Umbenennen" : auswahl.length ? "Thema anlegen und Auswahl hinzufügen" : "Thema anlegen"}</button>
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
    {hinweis && <p role="status">{hinweis}</p>}
    {ki && offen.length > 0 && <div className="dat-auswahl-form">
      <button type="button" className="knopf haupt" disabled={wartet} onClick={() => starten(async () => {
        setFehler("");
        setHinweis("");
        setVorschlaege(null);
        try {
          const antwort = await materialAutomatischEinsortieren(fachId, offen.slice(0, 40));
          if (antwort.ok) setHinweis(antwort.daten ? "Studio hat die passenden Unterlagen einsortiert." : "Studio hat keine eindeutigen Themen gefunden.");
          else setFehler(antwort.fehler);
        } catch { setFehler("Studio konnte die Unterlagen nicht einsortieren."); }
      })}><Icon name="studio" groesse={16} /> Mit Studio einsortieren</button>
      <button type="button" className="knopf neben" disabled={wartet} onClick={() => {
        starten(async () => {
          try {
            const antwort = await materialThemenVorschlagen(fachId, offen.slice(0, 40));
            if (antwort.ok) { setVorschlaege(antwort.daten); setFehler(""); }
            else setFehler(antwort.fehler);
          } catch { setFehler("Themenvorschläge konnten nicht geladen werden."); }
        });
      }}>Themen vorschlagen</button>
    </div>}
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

export function UnterlageEinsortieren({ material, faecher, themen, startFach, schliessen }: {
  material: Eintrag;
  faecher: { id: string; name: string }[];
  themen: (Thema & { fach_id: string })[];
  startFach: string | null;
  schliessen: () => void;
}) {
  const [fach, setFach] = useState(startFach ?? "");
  const [thema, setThema] = useState("");
  const [name, setName] = useState("");
  const [fehler, setFehler] = useState("");
  const [wartet, starten] = useTransition();

  function einsortieren() {
    starten(async () => {
      setFehler("");
      try {
        let ziel = thema;
        if (ziel === "neu") {
          ziel = await materialThemaSpeichern(fach, name);
          setThema(ziel);
        }
        await materialThemaZuordnen([material], fach, ziel);
        schliessen();
      } catch {
        setFehler("Die Unterlage konnte nicht einsortiert werden. Bitte versuch es erneut.");
      }
    });
  }

  return <MaterialDialog titel="In Themenstapel legen" schliessen={schliessen}>
    <p>{material.titel}</p>
    <form className="dat-workflow-feld" onSubmit={(e) => { e.preventDefault(); einsortieren(); }}>
      <label className="dat-workflow-feld">Fach
        <select className="field" value={fach} disabled={wartet} onChange={(e) => { setFach(e.target.value); setThema(""); }} required>
          <option value="">Fach wählen</option>
          {faecher.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </label>
      <label className="dat-workflow-feld">Themenstapel
        <select className="field" value={thema} disabled={!fach || wartet} onChange={(e) => setThema(e.target.value)} required>
          <option value="">Thema wählen</option>
          {themen.filter((t) => t.fach_id === fach).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          {thema && thema !== "neu" && !themen.some((t) => t.id === thema) && <option value={thema}>{name}</option>}
          <option value="neu">Neues Thema anlegen</option>
        </select>
      </label>
      {thema === "neu" && <label className="dat-workflow-feld">Themenname
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} disabled={wartet} maxLength={100} required />
      </label>}
      {fehler && <p role="alert">{fehler}</p>}
      <button type="submit" className="knopf haupt" disabled={!fach || !thema || wartet || (thema === "neu" && !name.trim())}>
        {thema === "neu" ? "Thema anlegen und Unterlage hinzufügen" : "Unterlage hinzufügen"}
      </button>
    </form>
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
