"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { createFach } from "@/app/fach/actions";
import { naechsteFarbe } from "@/components/fach-manager";
import { createDeadline } from "@/app/deadline/actions";
import { createTodo } from "@/app/todo/actions";
import { createNote } from "@/app/note/actions";
import { createPruefung } from "@/app/pruefung/actions";
import { benutzerSuchen, deadlineEinladen } from "@/app/einladung/actions";
import type { FachOption } from "@/lib/fach-option";
import type { Tables } from "@/lib/supabase/types";

type TodoOption = Pick<Tables<"todo">, "id" | "titel" | "erledigt" | "parent_id">;
type PruefungOption = Pick<Tables<"pruefung">, "id" | "titel">;

type QuickAddTyp = "todo" | "deadline" | "fach" | "note" | "pruefung";

const TYP_LABEL: Record<QuickAddTyp, string> = {
  todo: "To-Do",
  deadline: "Deadline",
  fach: "Fach",
  note: "Note",
  pruefung: "Prüfung",
};

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function morgenAbend(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(23, 59, 0, 0);
  return toDatetimeLocal(d);
}

export function QuickAdd({
  faecher,
  todos = [],
  pruefungen = [],
}: {
  faecher: FachOption[];
  todos?: TodoOption[];
  pruefungen?: PruefungOption[];
}) {
  const [open, setOpen] = useState(false);
  const [typ, setTyp] = useState<QuickAddTyp>("todo");
  const [titel, setTitel] = useState("");
  const [fachId, setFachId] = useState<string>(faecher[0]?.id ?? "");
  const [datumZeit, setDatumZeit] = useState(morgenAbend());
  const [unterAuswahl, setUnterAuswahl] = useState("");
  const [teilenMit, setTeilenMit] = useState("");
  const [nutzerVorschlaege, setNutzerVorschlaege] = useState<{ user_id: string; username: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleTeilenMitChange(value: string) {
    setTeilenMit(value);
    if (value.trim().length < 2) {
      setNutzerVorschlaege([]);
      return;
    }
    startTransition(async () => {
      try {
        setNutzerVorschlaege(await benutzerSuchen(value));
      } catch {
        setNutzerVorschlaege([]);
      }
    });
  }

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      const ziel = e.target as HTMLElement | null;
      const editierbar =
        !!ziel &&
        (ziel.tagName === "INPUT" || ziel.tagName === "TEXTAREA" || ziel.isContentEditable);

      if (!open && !editierbar && e.key.toLowerCase() === "q") {
        e.preventDefault();
        setOpen(true);
      } else if (open && e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        switch (typ) {
          case "fach":
            await createFach({
              name: titel,
              semester: null,
              farbe: naechsteFarbe(faecher),
              ects: null,
              anwesenheitspflicht: false,
              max_fehltage: null,
            });
            break;
          case "deadline": {
            const [unterTyp, unterId] = unterAuswahl ? unterAuswahl.split(":") : [null, null];
            const erstellt = await createDeadline({
              titel,
              fach_id: fachId || null,
              faellig_am: new Date(datumZeit).toISOString(),
              typ: "SONSTIGE",
              kategorie: "NORMAL",
              todoId: unterTyp === "todo" ? unterId : undefined,
              pruefungId: unterTyp === "pruefung" ? unterId : undefined,
            });
            if (teilenMit.trim() && erstellt[0]) {
              await deadlineEinladen(erstellt[0].id, teilenMit.trim());
            }
            break;
          }
          case "todo": {
            const [, todoUnterId] = unterAuswahl ? unterAuswahl.split(":") : [null, null];
            await createTodo({
              titel,
              fach_id: fachId || null,
              prioritaet: "MITTEL",
              parentId: todoUnterId,
            });
            break;
          }
          case "note":
            if (!fachId) throw new Error("Bitte ein Fach wählen.");
            await createNote({
              titel,
              fach_id: fachId,
              wert: 1,
              gewicht: 1,
              datum: new Date().toISOString().slice(0, 10),
            });
            break;
          case "pruefung":
            if (!fachId) throw new Error("Bitte ein Fach wählen.");
            await createPruefung({
              titel,
              fach_id: fachId,
              datum: new Date(datumZeit).toISOString(),
              raum: null,
              status: "ANSTEHEND",
            });
            break;
        }

        posthog.capture("quick_add_benutzt", { typ });
        setTitel("");
        setDatumZeit(morgenAbend());
        setUnterAuswahl("");
        setTeilenMit("");
        setNutzerVorschlaege([]);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  const brauchtFach = typ === "note" || typ === "pruefung";
  const brauchtDatumZeit = typ === "deadline" || typ === "pruefung";

  return (
    <>
      <button
        type="button"
        className="btnp"
        onClick={() => setOpen(true)}
        title="Schnell erfassen (Taste Q)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Schnell erfassen
      </button>

      {open && (
        <div className="quick-add-overlay" onClick={() => setOpen(false)}>
          <form
            className="quick-add-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
          >
            <h3>Neu anlegen</h3>
            {error && <p className="auth-error">{error}</p>}

            <select
              value={typ}
              onChange={(e) => {
                setTyp(e.target.value as QuickAddTyp);
                setUnterAuswahl("");
              }}
            >
              {Object.entries(TYP_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            {typ !== "fach" && faecher.length > 0 && (
              <select value={fachId} onChange={(e) => setFachId(e.target.value)}>
                {!brauchtFach && <option value="">Kein Fach</option>}
                {faecher.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}

            {brauchtDatumZeit && (
              <input
                type="datetime-local"
                value={datumZeit}
                onChange={(e) => setDatumZeit(e.target.value)}
                aria-label={typ === "deadline" ? "Fällig am" : "Termin am"}
                required
              />
            )}

            <input
              ref={inputRef}
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="Titel…"
              required
            />

            {typ === "todo" && todos.filter((t) => !t.erledigt && !t.parent_id).length > 0 && (
              <select value={unterAuswahl} onChange={(e) => setUnterAuswahl(e.target.value)}>
                <option value="">Eigenständiges To-Do</option>
                <optgroup label="Als Unterpunkt von To-Do">
                  {todos
                    .filter((t) => !t.erledigt && !t.parent_id)
                    .map((t) => (
                      <option key={t.id} value={`todo:${t.id}`}>
                        {t.titel}
                      </option>
                    ))}
                </optgroup>
              </select>
            )}

            {typ === "deadline" && (todos.length > 0 || pruefungen.length > 0) && (
              <select value={unterAuswahl} onChange={(e) => setUnterAuswahl(e.target.value)}>
                <option value="">Eigenständige Deadline</option>
                {todos.filter((t) => !t.erledigt).length > 0 && (
                  <optgroup label="Als Unteraufgabe von To-Do">
                    {todos
                      .filter((t) => !t.erledigt)
                      .map((t) => (
                        <option key={t.id} value={`todo:${t.id}`}>
                          {t.titel}
                        </option>
                      ))}
                  </optgroup>
                )}
                {pruefungen.length > 0 && (
                  <optgroup label="Als Unteraufgabe von Prüfung">
                    {pruefungen.map((p) => (
                      <option key={p.id} value={`pruefung:${p.id}`}>
                        {p.titel}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}

            {typ === "deadline" && (
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={teilenMit}
                  onChange={(e) => handleTeilenMitChange(e.target.value)}
                  placeholder="Mit Nutzername teilen (optional)"
                  list="quick-add-nutzer-vorschlaege"
                />
                <datalist id="quick-add-nutzer-vorschlaege">
                  {nutzerVorschlaege.map((n) => (
                    <option key={n.user_id} value={n.username} />
                  ))}
                </datalist>
              </div>
            )}

            <div className="crud-form-actions">
              <button type="submit" className="btnp" disabled={isPending}>
                {isPending ? "Speichern…" : "Hinzufügen (Enter)"}
              </button>
              <button type="button" onClick={() => setOpen(false)} disabled={isPending}>
                Abbrechen (Esc)
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
