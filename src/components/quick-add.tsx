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
import type { FachOption } from "@/lib/fach-option";

type QuickAddTyp = "todo" | "deadline" | "fach" | "note" | "pruefung";

const TYP_LABEL: Record<QuickAddTyp, string> = {
  todo: "To-Do",
  deadline: "Deadline",
  fach: "Fach",
  note: "Note",
  pruefung: "Prüfung",
};

export function QuickAdd({ faecher }: { faecher: FachOption[] }) {
  const [open, setOpen] = useState(false);
  const [typ, setTyp] = useState<QuickAddTyp>("todo");
  const [titel, setTitel] = useState("");
  const [fachId, setFachId] = useState<string>(faecher[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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
          case "deadline":
            await createDeadline({
              titel,
              fach_id: fachId || null,
              faellig_am: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              typ: "SONSTIGE",
              kategorie: "NORMAL",
            });
            break;
          case "todo":
            await createTodo({ titel, fach_id: fachId || null, prioritaet: "MITTEL" });
            break;
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
              datum: new Date().toISOString(),
              raum: null,
              status: "ANSTEHEND",
            });
            break;
        }

        posthog.capture("quick_add_benutzt", { typ });
        setTitel("");
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  const brauchtFach = typ === "note" || typ === "pruefung";

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

            <select value={typ} onChange={(e) => setTyp(e.target.value as QuickAddTyp)}>
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

            <input
              ref={inputRef}
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="Titel…"
              required
            />

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
