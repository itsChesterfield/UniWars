"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Nutzer = { user_id: string; username: string };

function Dialog({ titel, onSchliessen, children }: { titel: string; onSchliessen: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="card chat-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onSchliessen();
      }}
    >
      <div className="rowb">
        <h3 className="ct">{titel}</h3>
        <button type="button" className="icon-knopf" aria-label="Schließen" onClick={onSchliessen}>
          ✕
        </button>
      </div>
      {children}
    </dialog>
  );
}

/** CHAT-01: Personen über Nutzernamen (Anfang) oder exakte E-Mail finden. */
function useNutzerSuche(suche: string) {
  const [treffer, setTreffer] = useState<Nutzer[]>([]);
  const [sucht, setSucht] = useState(false);
  useEffect(() => {
    const q = suche.trim();
    if (q.length < 2) return;
    let abgebrochen = false;
    const t = window.setTimeout(async () => {
      setSucht(true);
      const supabase = createClient();
      const { data } = q.includes("@")
        ? await supabase.rpc("benutzer_per_email", { p_email: q })
        : await supabase.rpc("benutzer_suchen", { suchtext: q.replace(/^@/, "") });
      if (abgebrochen) return;
      setTreffer((data ?? []) as Nutzer[]);
      setSucht(false);
    }, 250);
    return () => {
      abgebrochen = true;
      window.clearTimeout(t);
    };
  }, [suche]);
  return { treffer: suche.trim().length >= 2 ? treffer : [], sucht };
}

export function NeuerChatDialog({ onWahl, onSchliessen }: { onWahl: (n: Nutzer) => Promise<void>; onSchliessen: () => void }) {
  const [suche, setSuche] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const { treffer, sucht } = useNutzerSuche(suche);
  return (
    <Dialog titel="Neuer Chat" onSchliessen={onSchliessen}>
      <input
        className="field"
        autoFocus
        placeholder="Nutzername oder E-Mail-Adresse"
        value={suche}
        onChange={(e) => setSuche(e.target.value)}
        aria-label="Person suchen"
      />
      <p className="muted chat-dialog-hinweis">Du kannst nur Personen anschreiben, die ein UniWars-Konto haben. E-Mail-Adressen müssen vollständig sein.</p>
      {fehler && <p className="auth-error">{fehler}</p>}
      <ul className="chat-treffer">
        {treffer.map((n) => (
          <li key={n.user_id}>
            <button
              type="button"
              onClick={async () => {
                setFehler(null);
                try {
                  await onWahl(n);
                } catch (err) {
                  setFehler(err instanceof Error && err.message.includes("BLOCKIERT") ? "Mit dieser Person kannst du nicht chatten." : "Chat konnte nicht gestartet werden.");
                }
              }}
            >
              <span className="chat-avatar" aria-hidden>
                {n.username.slice(0, 1).toUpperCase()}
              </span>
              @{n.username}
            </button>
          </li>
        ))}
        {suche.trim().length >= 2 && !sucht && treffer.length === 0 && <li className="empty-state">Niemand gefunden.</li>}
      </ul>
    </Dialog>
  );
}

/** CHAT-02: Gruppe mit Name + Mitgliedern oder aus einer Gruppenarbeit. */
export function NeueGruppeDialog({
  gruppenarbeiten,
  onAnlegen,
  onAusGruppenarbeit,
  onSchliessen,
}: {
  gruppenarbeiten: { id: string; titel: string }[];
  onAnlegen: (name: string, ids: string[]) => Promise<void>;
  onAusGruppenarbeit: (deadlineId: string) => Promise<void>;
  onSchliessen: () => void;
}) {
  const [name, setName] = useState("");
  const [suche, setSuche] = useState("");
  const [mitglieder, setMitglieder] = useState<Nutzer[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const { treffer } = useNutzerSuche(suche);
  const voll = mitglieder.length >= 19;

  async function anlegen() {
    setFehler(null);
    if (!name.trim()) return setFehler("Bitte gib der Gruppe einen Namen.");
    if (mitglieder.length === 0) return setFehler("Füge mindestens eine Person hinzu.");
    try {
      await onAnlegen(name.trim(), mitglieder.map((m) => m.user_id));
    } catch {
      setFehler("Gruppe konnte nicht angelegt werden.");
    }
  }

  return (
    <Dialog titel="Neue Gruppe" onSchliessen={onSchliessen}>
      {gruppenarbeiten.length > 0 && (
        <label className="chat-feld">
          <span>Aus einer Gruppenarbeit (alle Mitglieder automatisch)</span>
          <select
            className="field"
            defaultValue=""
            onChange={async (e) => {
              if (!e.target.value) return;
              setFehler(null);
              try {
                await onAusGruppenarbeit(e.target.value);
              } catch {
                setFehler("Gruppenchat konnte nicht angelegt werden.");
              }
            }}
          >
            <option value="">Gruppenarbeit wählen …</option>
            {gruppenarbeiten.map((g) => (
              <option key={g.id} value={g.id}>
                {g.titel}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="chat-feld">
        <span>Name der Gruppe</span>
        <input className="field" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus placeholder="z. B. Lerngruppe Mathe" />
      </label>
      <label className="chat-feld">
        <span>Mitglieder ({mitglieder.length + 1}/20 mit dir)</span>
        <input
          className="field"
          value={suche}
          disabled={voll}
          placeholder={voll ? "Maximal 20 Mitglieder" : "Nutzername oder E-Mail"}
          onChange={(e) => setSuche(e.target.value)}
        />
      </label>
      {mitglieder.length > 0 && (
        <div className="chat-chips">
          {mitglieder.map((m) => (
            <span key={m.user_id} className="tag tag-accent">
              @{m.username}
              <button type="button" aria-label={`${m.username} entfernen`} onClick={() => setMitglieder((l) => l.filter((x) => x.user_id !== m.user_id))}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <ul className="chat-treffer">
        {treffer
          .filter((t) => !mitglieder.some((m) => m.user_id === t.user_id))
          .map((n) => (
            <li key={n.user_id}>
              <button
                type="button"
                disabled={voll}
                onClick={() => {
                  setMitglieder((l) => [...l, n]);
                  setSuche("");
                }}
              >
                <span className="chat-avatar" aria-hidden>
                  {n.username.slice(0, 1).toUpperCase()}
                </span>
                @{n.username} <span className="muted">hinzufügen</span>
              </button>
            </li>
          ))}
      </ul>
      {fehler && <p className="auth-error">{fehler}</p>}
      <div className="hub-formular-knoepfe">
        <button type="button" className="btng" onClick={onSchliessen}>
          Abbrechen
        </button>
        <button type="button" className="btnp" onClick={() => void anlegen()}>
          Gruppe anlegen
        </button>
      </div>
    </Dialog>
  );
}

export type AnhangWahl = { typ: "datei" | "deadline" | "todo"; id: string; titel: string };

/** CHAT-04: Datei aus der Ablage oder eine Deadline / ein To-do anhängen. */
export function AnhangDialog({ onWahl, onSchliessen }: { onWahl: (a: AnhangWahl) => void; onSchliessen: () => void }) {
  const [art, setArt] = useState<AnhangWahl["typ"]>("datei");
  const [eintraege, setEintraege] = useState<{ id: string; titel: string; info?: string }[] | null>(null);
  const [suche, setSuche] = useState("");

  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      const supabase = createClient();
      let liste: { id: string; titel: string; info?: string }[] = [];
      if (art === "datei") {
        const { data } = await supabase.from("datei").select("id, name").order("erstellt_am", { ascending: false }).limit(200);
        liste = (data ?? []).map((d) => ({ id: d.id, titel: d.name }));
      } else if (art === "deadline") {
        const { data } = await supabase.from("deadline").select("id, titel, faellig_am").eq("erledigt", false).order("faellig_am").limit(200);
        liste = (data ?? []).map((d) => ({ id: d.id, titel: d.titel, info: new Date(d.faellig_am).toLocaleDateString("de-DE") }));
      } else {
        const { data } = await supabase.from("todo").select("id, titel").eq("erledigt", false).is("parent_id", null).order("erstellt_am").limit(200);
        liste = (data ?? []).map((d) => ({ id: d.id, titel: d.titel }));
      }
      if (!abgebrochen) setEintraege(liste);
    })();
    return () => {
      abgebrochen = true;
    };
  }, [art]);

  const q = suche.trim().toLowerCase();
  const sichtbar = (eintraege ?? []).filter((e) => !q || e.titel.toLowerCase().includes(q));

  return (
    <Dialog titel="Anhängen" onSchliessen={onSchliessen}>
      <div className="segwrap" role="tablist">
        {(
          [
            ["datei", "📎 Datei"],
            ["deadline", "⏰ Deadline"],
            ["todo", "☑ To-do"],
          ] as const
        ).map(([wert, label]) => (
          <button
            key={wert}
            type="button"
            role="tab"
            aria-selected={art === wert}
            className={`seg ${art === wert ? "on" : ""}`}
            onClick={() => {
              setArt(wert);
              setEintraege(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <input className="field" placeholder="Suchen …" value={suche} onChange={(e) => setSuche(e.target.value)} />
      <ul className="chat-treffer chat-anhang-liste">
        {eintraege === null && <li className="empty-state">Lädt …</li>}
        {eintraege !== null && sichtbar.length === 0 && <li className="empty-state">Nichts gefunden.</li>}
        {sichtbar.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => onWahl({ typ: art, id: e.id, titel: e.titel })}>
              {e.titel}
              {e.info && <span className="muted">{e.info}</span>}
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
