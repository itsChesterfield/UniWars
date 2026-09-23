"use client";

import { useState, useTransition } from "react";
import { benutzerSuchen, deadlineEinladen, deadlineMitgliederLaden } from "@/app/einladung/actions";
import { track } from "@/lib/analytics";

type Mitglied = {
  user_id: string;
  username: string | null;
  status: "OFFEN" | "ANGENOMMEN" | "ABGELEHNT";
  ist_ersteller: boolean;
};

const STATUS_LABEL: Record<Mitglied["status"], string> = {
  OFFEN: "eingeladen",
  ANGENOMMEN: "dabei",
  ABGELEHNT: "abgelehnt",
};

export function DeadlineTeilen({ deadlineId }: { deadlineId: string }) {
  const [open, setOpen] = useState(false);
  const [suchtext, setSuchtext] = useState("");
  const [treffer, setTreffer] = useState<{ user_id: string; username: string }[]>([]);
  const [mitglieder, setMitglieder] = useState<Mitglied[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [erfolg, setErfolg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function ladeMitglieder() {
    startTransition(async () => {
      try {
        const data = await deadlineMitgliederLaden(deadlineId);
        setMitglieder(data as Mitglied[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  function toggleOpen() {
    const naechster = !open;
    setOpen(naechster);
    if (naechster && mitglieder === null) ladeMitglieder();
  }

  function handleSuchtextChange(value: string) {
    setSuchtext(value);
    setError(null);
    setErfolg(null);
    if (value.trim().length < 2) {
      setTreffer([]);
      return;
    }
    startTransition(async () => {
      try {
        const data = await benutzerSuchen(value);
        setTreffer(data);
      } catch {
        setTreffer([]);
      }
    });
  }

  function einladen(username: string) {
    setError(null);
    setErfolg(null);
    startTransition(async () => {
      try {
        await deadlineEinladen(deadlineId, username);
        track("mitglied_eingeladen", { ziel_typ: "deadline", ort: "liste" });
        setErfolg(`${username} wurde eingeladen.`);
        setSuchtext("");
        setTreffer([]);
        ladeMitglieder();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  return (
    <div className="deadline-teilen">
      <button type="button" onClick={toggleOpen} className="deadline-teilen-btn">
        Teilen
      </button>

      {open && (
        <div className="deadline-teilen-panel">
          {mitglieder && mitglieder.length > 0 && (
            <ul className="deadline-teilen-mitglieder">
              {mitglieder.map((m) => (
                <li key={m.user_id}>
                  <span className="tag">{m.username ?? "?"}</span>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {m.ist_ersteller ? "Ersteller" : STATUS_LABEL[m.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <input
            type="text"
            placeholder="Nutzername suchen…"
            value={suchtext}
            onChange={(e) => handleSuchtextChange(e.target.value)}
            className="deadline-teilen-input"
          />

          {treffer.length > 0 && (
            <ul className="deadline-teilen-treffer">
              {treffer.map((t) => (
                <li key={t.user_id}>
                  <span>{t.username}</span>
                  <button type="button" disabled={isPending} onClick={() => einladen(t.username)}>
                    Einladen
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="auth-error" style={{ fontSize: 12 }}>{error}</p>}
          {erfolg && <p className="muted" style={{ fontSize: 12 }}>{erfolg}</p>}
        </div>
      )}
    </div>
  );
}
