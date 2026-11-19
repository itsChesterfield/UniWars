"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { materialAmZielLaden, materialVerknuepfen, materialVerknuepfungLoesen, materialVerwendungenLaden } from "@/app/(hubs)/dateiablage/workflow-actions";
import type { MaterialRef, MaterialZiel } from "@/lib/dateiablage/material";
import { MaterialAuswahl, suchMaterial, suchZiel } from "./material-auswahl";
import { MaterialDialog } from "./material-dialog";

export function MaterialAmZiel({ ziel }: { ziel: MaterialZiel }) {
  const [offen, setOffen] = useState(false);
  const [daten, setDaten] = useState<Awaited<ReturnType<typeof materialAmZielLaden>>>([]);
  const [fehler, setFehler] = useState("");
  const [wartet, starten] = useTransition();
  const { art, id } = ziel;
  const datum = ziel.art === "vorlesung" ? ziel.datum : null;
  useEffect(() => {
    let aktiv = true;
    const z = art === "vorlesung" ? { art, id, datum: datum! } : { art, id };
    void materialAmZielLaden(z).then((liste) => { if (aktiv) setDaten(liste); }).catch(() => {
      if (aktiv) setFehler("Die Unterlagen konnten nicht geladen werden.");
    });
    return () => { aktiv = false; };
  }, [art, id, datum]);
  function aktualisieren(aktion: () => Promise<void>) {
    starten(async () => {
      setFehler("");
      try {
        await aktion();
        setDaten(await materialAmZielLaden(ziel));
      } catch {
        setFehler("Die Verknüpfung konnte nicht gespeichert werden.");
      }
    });
  }
  return (
    <section className="detail-abschnitt" aria-label="Unterlagen">
      <div className="detail-abschnitt-kopf">
        <h3 className="aufgaben-untertitel">Unterlagen</h3>
        <button className="knopf leise klein" type="button" onClick={() => setOffen(true)}>Unterlage hinzufügen</button>
      </div>
      {fehler && <p role="alert">{fehler}</p>}
      <ul className="dat-workflow-liste">{daten.map((d) => (
        <li key={d.id ?? d.zielId}>
          <Link href={d.href}>{d.titel}{d.seite ? ` · Seite ${d.seite}` : ""}</Link>
          {d.id && <button type="button" className="knopf leise klein" disabled={wartet} onClick={() => aktualisieren(() => materialVerknuepfungLoesen(d.id!))}>Verknüpfung lösen</button>}
        </li>
      ))}</ul>
      {offen && <MaterialDialog titel="Unterlage hinzufügen" schliessen={() => setOffen(false)}>
        {fehler && <p role="alert">{fehler}</p>}
        <MaterialAuswahl modus="unterlagen" gesperrt={wartet} waehlen={(t) => {
          const material = suchMaterial(t);
          if (material) aktualisieren(() => materialVerknuepfen(material.ref, ziel, material.seite));
        }} />
      </MaterialDialog>}
    </section>
  );
}

export function MaterialRueckverweise({ material, titel, schliessen }: { material: MaterialRef; titel: string; schliessen: () => void }) {
  const [daten, setDaten] = useState<Awaited<ReturnType<typeof materialVerwendungenLaden>> | null>(null);
  const [wartet, starten] = useTransition();
  const [fehler, setFehler] = useState("");
  const { art, id } = material;
  useEffect(() => {
    let aktiv = true;
    void materialVerwendungenLaden({ art, id }).then((d) => { if (aktiv) setDaten(d); }).catch(() => {
      if (aktiv) setFehler("Die Verknüpfungen konnten nicht geladen werden.");
    });
    return () => { aktiv = false; };
  }, [art, id]);
  return (
    <MaterialDialog titel={titel} schliessen={schliessen}>
      <ul className="dat-workflow-liste">{daten?.verknuepfungen.map((v) => (
        <li key={v.id}><Link href={v.href} onNavigate={schliessen}>{v.titel}{v.datum ? ` · ${v.datum}` : ""}</Link></li>
      ))}</ul>
      {fehler && <p role="alert">{fehler}</p>}
      <MaterialAuswahl modus="aufgaben" gesperrt={wartet} waehlen={(t) => {
        const ziel = suchZiel(t);
        if (!ziel) return;
        starten(async () => {
          try { await materialVerknuepfen(material, ziel); setDaten(await materialVerwendungenLaden(material)); setFehler(""); }
          catch { setFehler("Die Verknüpfung konnte nicht gespeichert werden."); }
        });
      }} />
    </MaterialDialog>
  );
}
