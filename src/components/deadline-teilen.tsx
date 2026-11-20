"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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

/**
 * Mitglieder einer Deadline einladen. Ohne `onSchliessen` mit eigenem Knopf „Teilen“ (Feld legt sich darüber).
 * Mit `onSchliessen` kommt es aus einem Menü: ohne Knopf, gleich offen, in der Zeile, mit „Fertig“.
 */
export function DeadlineTeilen({ deadlineId, onSchliessen }: { deadlineId: string; onSchliessen?: () => void }) {
  const ausMenue = onSchliessen !== undefined;
  const [eigenOffen, setOpen] = useState(false);
  const open = ausMenue || eigenOffen;
  const feld = useRef<HTMLInputElement>(null);
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

  // Aus dem Menü geöffnet: Mitglieder laden und gleich ins Suchfeld
  useEffect(() => {
    if (!ausMenue) return;
    feld.current?.focus();
    let vorbei = false;
    deadlineMitgliederLaden(deadlineId)
      .then((data) => {
        if (!vorbei) setMitglieder(data as Mitglied[]);
      })
      .catch((err: unknown) => {
        if (!vorbei) setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      });
    return () => {
      vorbei = true;
    };
  }, [ausMenue, deadlineId]);

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
    <div className={`deadline-teilen${ausMenue ? " in-zeile" : ""}`}>
      {!ausMenue && (
        <button type="button" onClick={toggleOpen} className="knopf leise klein" aria-expanded={open}>
          Teilen
        </button>
      )}

      {open && (
        <div
          className="deadline-teilen-panel"
          role={ausMenue ? "group" : undefined}
          aria-label={ausMenue ? "Teilen" : undefined}
          onKeyDown={(e) => {
            if (ausMenue && e.key === "Escape") onSchliessen?.();
          }}
        >
          {mitglieder && mitglieder.length > 0 && (
            <ul className="deadline-teilen-mitglieder">
              {mitglieder.map((m) => (
                <li key={m.user_id}>
                  <span className="tag">{m.username ?? "?"}</span>
                  <span className="unteraufgabe-meta">{m.ist_ersteller ? "Ersteller" : STATUS_LABEL[m.status]}</span>
                </li>
              ))}
            </ul>
          )}

          <input
            ref={feld}
            type="text"
            placeholder="Nutzername suchen…"
            aria-label="Nutzername suchen"
            value={suchtext}
            onChange={(e) => handleSuchtextChange(e.target.value)}
            className="deadline-teilen-input"
          />

          {treffer.length > 0 && (
            <ul className="deadline-teilen-treffer">
              {treffer.map((t) => (
                <li key={t.user_id}>
                  <span>{t.username}</span>
                  <button type="button" className="knopf neben klein" disabled={isPending} aria-busy={isPending} onClick={() => einladen(t.username)}>
                    Einladen
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="auth-error unteraufgabe-fehler">{error}</p>}
          {erfolg && (
            <p className="unteraufgabe-meta" role="status">
              {erfolg}
            </p>
          )}
          {ausMenue && (
            <button type="button" className="knopf leise klein deadline-teilen-fertig" onClick={onSchliessen}>
              Fertig
            </button>
          )}
        </div>
      )}
    </div>
  );
}
