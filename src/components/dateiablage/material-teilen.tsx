"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { materialFreigaben, materialFreigabeSetzen, materialGruppen, materialGruppenmitglieder, materialPaketElement, materialPaketEntfernen,
  materialPaketErstellen, materialPaketLaden, materialPaketPflegeSetzen, materialPaketeLaden } from "@/app/(hubs)/dateiablage/freigabe-actions";
import type { MaterialRef } from "@/lib/dateiablage/material";
import { MaterialAuswahl, suchMaterial } from "./material-auswahl";
import { MaterialDialog } from "./material-dialog";

type Gruppe = Awaited<ReturnType<typeof materialGruppen>>[number];
type Mitglied = Awaited<ReturnType<typeof materialGruppenmitglieder>>[number];

export function MaterialTeilen({ refs, titel, paket, schliessen }: { refs: MaterialRef[]; titel: string; paket?: boolean; schliessen: () => void }) {
  const [gruppen, setGruppen] = useState<Gruppe[]>([]);
  const [mitglieder, setMitglieder] = useState<Mitglied[]>([]);
  const [rechte, setRechte] = useState<Awaited<ReturnType<typeof materialFreigaben>>>([]);
  const [gruppe, setGruppe] = useState("");
  const [name, setName] = useState("");
  const [fehler, setFehler] = useState("");
  const [wartet, starten] = useTransition();
  const original = refs[0];
  const art = original?.art;
  const id = original?.id;
  useEffect(() => {
    let aktiv = true;
    void Promise.all([materialGruppen(), !paket && art && id ? materialFreigaben({ art, id }) : Promise.resolve([])])
      .then(([g, r]) => { if (aktiv) { setGruppen(g); setRechte(r); } })
      .catch(() => { if (aktiv) setFehler("Lerngruppen konnten nicht geladen werden."); });
    return () => { aktiv = false; };
  }, [art, id, paket]);
  function gruppeWaehlen(gruppeId: string) {
    setGruppe(gruppeId);
    setMitglieder([]);
    if (gruppeId && !paket) starten(async () => {
      try { setMitglieder(await materialGruppenmitglieder(gruppeId)); }
      catch { setFehler("Mitglieder konnten nicht geladen werden."); }
    });
  }
  return (
    <MaterialDialog titel={paket ? "Materialpaket teilen" : `${titel} teilen`} schliessen={schliessen}>
      {fehler && <p role="alert">{fehler}</p>}
      <label className="dat-workflow-feld">Lerngruppe
        <select className="field" value={gruppe} disabled={wartet} onChange={(e) => gruppeWaehlen(e.target.value)}>
          <option value="">Lerngruppe auswählen</option>
          {gruppen.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </label>
      {paket ? (
        <form className="dat-workflow-feld" onSubmit={(e) => {
          e.preventDefault();
          starten(async () => {
            try { await materialPaketErstellen(gruppe, name, refs); schliessen(); }
            catch { setFehler("Das Paket konnte nicht geteilt werden."); }
          });
        }}>
          <label className="dat-workflow-feld">Paketname<input className="field" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} /></label>
          <button className="knopf haupt" disabled={wartet || !gruppe || !name.trim()}>Paket teilen</button>
        </form>
      ) : <ul className="dat-workflow-liste">{mitglieder.map((m) => {
        const recht = rechte.find((r) => r.chat_id === gruppe && r.empfaenger_id === m.user_id);
        return <li key={m.user_id}>
          <label>{m.username} <select className="field" value={recht ? recht.bearbeiten ? "bearbeiten" : "lesen" : ""} disabled={wartet} onChange={(e) => {
            const wert = e.target.value;
            starten(async () => {
              try {
                await materialFreigabeSetzen(original, gruppe, m.user_id, wert === "bearbeiten" || wert === "lesen" ? wert : null);
                setRechte(await materialFreigaben(original)); setFehler("");
              } catch { setFehler("Die Freigabe konnte nicht gespeichert werden."); }
            });
          }}>
            <option value="">Privat</option><option value="lesen">Ansehen</option><option value="bearbeiten">Bearbeiten</option>
          </select></label>
        </li>;
      })}</ul>}
    </MaterialDialog>
  );
}

export function MaterialPakete({ chatId }: { chatId?: string }) {
  const [pakete, setPakete] = useState<Awaited<ReturnType<typeof materialPaketeLaden>>>([]);
  const [id, setId] = useState("");
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof materialPaketLaden>>>();
  const [mitglieder, setMitglieder] = useState<Mitglied[]>([]);
  const [fehler, setFehler] = useState("");
  const [wartet, starten] = useTransition();
  useEffect(() => {
    let aktiv = true;
    void materialPaketeLaden(chatId).then((p) => { if (aktiv) setPakete(p); }).catch(() => {
      if (aktiv && !chatId) setFehler("Materialpakete konnten nicht geladen werden.");
    });
    return () => { aktiv = false; };
  }, [chatId]);
  function oeffnen(paketId: string) {
    setId(paketId);
    setDetail(undefined);
    setFehler("");
    starten(async () => {
      try {
        const d = await materialPaketLaden(paketId);
        setDetail(d);
        if (d.eigen) setMitglieder(await materialGruppenmitglieder(d.chatId));
      } catch { setFehler("Das Paket konnte nicht geöffnet werden."); }
    });
  }
  function aktualisieren(aktion: () => Promise<void>) {
    starten(async () => {
      try { await aktion(); setDetail(await materialPaketLaden(id)); setFehler(""); }
      catch { setFehler("Das Paket konnte nicht geändert werden."); }
    });
  }
  if (!pakete.length && chatId) return null;
  return (
    <section className="dat-workflow-pakete" aria-label="Materialpakete">
      <h3>Materialpakete</h3>
      {fehler && <p role="alert">{fehler}</p>}
      {!pakete.length && <p>Hier erscheinen die mit dir geteilten Pakete.</p>}
      <ul className="dat-workflow-liste">{pakete.map((p) => <li key={p.id}><button type="button" className="knopf leise" onClick={() => oeffnen(p.id)}>{p.titel}</button></li>)}</ul>
      {id && <MaterialDialog titel={detail?.titel ?? "Materialpaket"} schliessen={() => setId("")}>
        {fehler && <p role="alert">{fehler}</p>}
        {detail ? <>
          <ul className="dat-workflow-liste">{detail.material.map((m) => <li key={`${m.art}:${m.id}`}>
            <Link href={m.href} onNavigate={() => setId("")}>{m.titel}</Link>
            {detail.darfPflegen && <button type="button" className="knopf leise klein" disabled={wartet}
              onClick={() => aktualisieren(() => materialPaketElement(id, [m], false))}>Aus Paket entfernen</button>}
          </li>)}</ul>
          {detail.darfPflegen && <MaterialAuswahl modus="unterlagen" gesperrt={wartet} waehlen={(t) => {
            const m = suchMaterial(t);
            if (m) aktualisieren(() => materialPaketElement(id, [m.ref], true));
          }} />}
          {detail.eigen && <>
            <fieldset>
              <legend>Paketpflege</legend>
              {mitglieder.map((m) => <label className="dat-workflow-mitglied" key={m.user_id}>
                <input type="checkbox" checked={detail.pfleger.includes(m.user_id)} disabled={wartet} onChange={(e) => {
                  const wert = e.target.checked;
                  aktualisieren(() => materialPaketPflegeSetzen(id, m.user_id, wert));
                }} /> {m.username}
              </label>)}
            </fieldset>
            <button type="button" className="knopf leise klein" disabled={wartet} onClick={() => starten(async () => {
              try { await materialPaketEntfernen(id); setPakete(await materialPaketeLaden(chatId)); setId(""); setFehler(""); }
              catch { setFehler("Das Paket konnte nicht aufgehoben werden."); }
            })}>Paketfreigabe aufheben</button>
          </>}
        </> : !fehler && <p role="status">Paket wird geladen</p>}
      </MaterialDialog>}
    </section>
  );
}
