"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { alleUnterhaltungenLoeschen, unterhaltungenLaden, unterhaltungLoeschen, type UnterhaltungEintrag } from "@/app/(hubs)/assistent/actions";
import { AssistentChat } from "@/components/assistent/assistent-chat";
import { HubKopf } from "@/components/hubs/hub-bausteine";
import { track } from "@/lib/analytics";

function wann(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** KI-12: Seite /assistent mit dem Verlauf aller Unterhaltungen links. */
export function AssistentSeite({ unterhaltungen, startId }: { unterhaltungen: UnterhaltungEintrag[]; startId: string | null }) {
  const router = useRouter();
  const [liste, setListe] = useState(unterhaltungen);
  const [aktiv, setAktiv] = useState<string | null>(startId && unterhaltungen.some((u) => u.id === startId) ? startId : null);
  const [runde, setRunde] = useState(0);
  const [listeOffen, setListeOffen] = useState(false);

  function waehlen(id: string | null) {
    setAktiv(id);
    setRunde((r) => r + 1);
    setListeOffen(false);
    router.replace(id ? `/assistent?u=${id}` : "/assistent", { scroll: false });
  }

  async function loeschen(u: UnterhaltungEintrag) {
    if (!window.confirm(`„${u.titel}“ löschen?`)) return;
    const a = await unterhaltungLoeschen(u.id).catch(() => null);
    if (!a?.ok) return window.alert("Löschen hat nicht geklappt.");
    track("ki_unterhaltung_geloescht");
    setListe((l) => l.filter((x) => x.id !== u.id));
    if (aktiv === u.id) waehlen(null);
  }

  async function alleLoeschen() {
    if (!window.confirm("Wirklich ALLE Unterhaltungen mit dem Assistenten löschen? Das lässt sich nicht rückgängig machen.")) return;
    const a = await alleUnterhaltungenLoeschen().catch(() => null);
    if (!a?.ok) return window.alert("Löschen hat nicht geklappt.");
    track("ki_unterhaltungen_alle_geloescht", { anzahl: a.daten.anzahl });
    setListe([]);
    waehlen(null);
  }

  return (
    <div className="ki-seite">
      <HubKopf
        titel="Assistent"
        untertitel="Dein Lernbegleiter – kennt deinen Stundenplan, Deadlines, Karteikarten und Notizen."
        aktionen={
          <>
            <button type="button" className="btng ki-seite-verlauf-knopf" onClick={() => setListeOffen((o) => !o)} aria-expanded={listeOffen}>
              ☰ Verlauf
            </button>
            <button type="button" className="btnp" onClick={() => waehlen(null)}>
              + Neue Unterhaltung
            </button>
          </>
        }
      />
      <div className="ki-seite-raster">
        <nav className={`ki-seite-liste card ${listeOffen ? "offen" : ""}`} aria-label="Unterhaltungen">
          {liste.length === 0 ? (
            <p className="empty-state">Noch keine Unterhaltungen.</p>
          ) : (
            <ul>
              {liste.map((u) => (
                <li key={u.id} className={aktiv === u.id ? "aktiv" : ""}>
                  <button type="button" className="ki-seite-eintrag" onClick={() => waehlen(u.id)}>
                    <span>{u.titel}</span>
                    <span className="faint">{wann(u.geaendert_am)}</span>
                  </button>
                  <button type="button" className="icon-knopf" aria-label={`„${u.titel}“ löschen`} onClick={() => void loeschen(u)}>
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          )}
          {liste.length > 0 && (
            <button type="button" className="link-knopf ki-seite-alle" onClick={() => void alleLoeschen()}>
              Alle Unterhaltungen löschen
            </button>
          )}
        </nav>
        <section className="card ki-seite-chat">
          <AssistentChat
            key={`${aktiv ?? "neu"}-${runde}`}
            unterhaltungId={aktiv}
            kontext={{ hub: "assistent" }}
            onUnterhaltung={(id) => {
              // Adresse anpassen, ohne den Chat neu aufzubauen; Liste mit Titel neu laden
              if (aktiv !== id) window.history.replaceState(null, "", `/assistent?u=${id}`);
              void unterhaltungenLaden()
                .catch(() => null)
                .then((a) => {
                  if (a?.ok) setListe(a.daten);
                });
            }}
          />
        </section>
      </div>
    </div>
  );
}
