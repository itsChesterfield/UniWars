"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { createFach } from "@/app/fach/actions";
import { naechsteFarbe } from "@/components/fach-manager";
import { createDeadline } from "@/app/deadline/actions";
import { createTodo } from "@/app/todo/actions";
import { createNote } from "@/app/note/actions";
import { createPruefung } from "@/app/pruefung/actions";
import { benutzerSuchen, deadlineEinladen } from "@/app/einladung/actions";
import { createAnhang, type AnhangZielTyp } from "@/app/anhang/actions";
import { UnteraufgabenDialog, type UnteraufgabenParentTyp } from "@/components/unteraufgaben-dialog";
import { erkenneTyp, erkenneDatum, type ErkannterTyp } from "@/lib/typ-erkennung";
import type { FachOption } from "@/lib/fach-option";
import type { Tables } from "@/lib/supabase/types";

type TodoOption = Pick<Tables<"todo">, "id" | "titel" | "erledigt" | "parent_id">;
type PruefungOption = Pick<Tables<"pruefung">, "id" | "titel">;

/**
 * "Fach" und "Note" sind kein Teil der 5 Typ-Chips aus dem Design (die
 * bilden nur deadline_typ + Prüfung ab), brauchen aber weiterhin einen
 * Eingang in Schnell erfassen, da es dafür sonst keine andere Stelle im UI
 * gibt. Deshalb als zwei zusätzliche Chips am Ende der Leiste angehängt.
 */
type QuickAddModus = ErkannterTyp | "FACH" | "NOTE";

const CHIP_LABEL: Record<QuickAddModus, string> = {
  PRUEFUNG: "Prüfung",
  ABGABE: "Abgabe",
  TERMIN: "Termin",
  // FRIST ist Teil von deadline_typ (Altbestand), aber kein eigener Chip im
  // neuen Design – taucht hier nur auf, damit der Record vollständig ist.
  FRIST: "Frist",
  GRUPPENARBEIT: "Gruppenarbeit",
  SONSTIGE: "Sonstige",
  FACH: "Fach",
  NOTE: "Note",
};

const ALLE_MODI: QuickAddModus[] = [
  "PRUEFUNG",
  "ABGABE",
  "TERMIN",
  "GRUPPENARBEIT",
  "SONSTIGE",
  "FACH",
  "NOTE",
];

// Erkennt sowohl vollständige URLs (https://…) als auch bloße Domains ohne
// Protokoll (figma.com/x, docs.google.com), wie sie beim Tippen/Einfügen
// häufig vorkommen.
const URL_REGEX = /(https?:\/\/[^\s]+)|([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)+\.[a-z]{2,}(?:\/[^\s]*)?)/i;

function normalisiereUrl(roh: string): string {
  return /^https?:\/\//i.test(roh) ? roh : `https://${roh}`;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
  const [modus, setModus] = useState<QuickAddModus>("ABGABE");
  const [typManuellGesetzt, setTypManuellGesetzt] = useState(false);
  const [notenWert, setNotenWert] = useState("");
  const [notenGewicht, setNotenGewicht] = useState("1");
  const [titel, setTitel] = useState("");
  const [fachId, setFachId] = useState<string>(faecher[0]?.id ?? "");
  const [datumZeit, setDatumZeit] = useState("");
  const [datumManuellGesetzt, setDatumManuellGesetzt] = useState(false);
  const [unterAuswahl, setUnterAuswahl] = useState("");
  const [teilenMit, setTeilenMit] = useState("");
  const [nutzerVorschlaege, setNutzerVorschlaege] = useState<{ user_id: string; username: string }[]>([]);
  const [teilenMitSuchLaeuft, setTeilenMitSuchLaeuft] = useState(false);
  const [anhaenge, setAnhaenge] = useState<{ url: string; titel: string }[]>([]);
  const [linkEingabe, setLinkEingabe] = useState("");
  const [unterDialogFuer, setUnterDialogFuer] = useState<{
    parentTyp: UnteraufgabenParentTyp;
    parentId: string;
    parentTitel: string;
    fachId: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const router = useRouter();

  function handleClose() {
    setOpen(false);
    setTypManuellGesetzt(false);
    setDatumManuellGesetzt(false);
  }

  function handleTeilenMitChange(value: string) {
    setTeilenMit(value);
    if (value.trim().length < 2) {
      setNutzerVorschlaege([]);
      setTeilenMitSuchLaeuft(false);
      return;
    }
    setTeilenMitSuchLaeuft(true);
    startTransition(async () => {
      try {
        setNutzerVorschlaege(await benutzerSuchen(value));
      } catch {
        setNutzerVorschlaege([]);
      } finally {
        setTeilenMitSuchLaeuft(false);
      }
    });
  }

  function waehleModus(naechster: QuickAddModus) {
    setModus(naechster);
    setTypManuellGesetzt(true);
    setUnterAuswahl("");
    if (naechster !== "GRUPPENARBEIT") {
      setTeilenMit("");
      setNutzerVorschlaege([]);
      setTeilenMitSuchLaeuft(false);
    }
  }

  function handleChipKeydown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const naechsterIndex = (index + delta + ALLE_MODI.length) % ALLE_MODI.length;
    waehleModus(ALLE_MODI[naechsterIndex]);
    chipRefs.current[naechsterIndex]?.focus();
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
        track("schnell_erfassen_geoeffnet", { quelle: "taste_q" });
      } else if (open && e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Debounced: Typ- und Datumserkennung aus dem Titel, plus URL -> Anhang.
  useEffect(() => {
    const timer = setTimeout(() => {
      const treffer = titel.match(URL_REGEX);
      if (treffer) {
        const roh = treffer[0];
        const url = normalisiereUrl(roh);
        const bereinigt = titel.replace(roh, "").replace(/\s{2,}/g, " ").trim();
        if (bereinigt !== titel) setTitel(bereinigt);
        setAnhaenge((prev) => (prev.some((a) => a.url === url) ? prev : [...prev, { url, titel: hostname(url) }]));
      }

      if (!typManuellGesetzt && titel.trim() !== "") {
        const erkannt = erkenneTyp(titel);
        if (erkannt.sicher) setModus(erkannt.typ);
      }

      if (!datumManuellGesetzt) {
        const datum = erkenneDatum(titel);
        if (datum) setDatumZeit(toDatetimeLocal(datum));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [titel, typManuellGesetzt, datumManuellGesetzt]);

  function entferneAnhang(url: string) {
    setAnhaenge((prev) => prev.filter((a) => a.url !== url));
  }

  function linkHinzufuegen() {
    const roh = linkEingabe.trim();
    if (!roh) return;
    const url = normalisiereUrl(roh);
    setAnhaenge((prev) => (prev.some((a) => a.url === url) ? prev : [...prev, { url, titel: hostname(url) }]));
    setLinkEingabe("");
  }

  async function speichereAnhaenge(zielTyp: AnhangZielTyp, zielId: string) {
    for (const a of anhaenge) {
      await createAnhang(zielTyp, zielId, a.url);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (modus === "GRUPPENARBEIT" && teilenMit.trim() && !teilenMitGueltig) {
      setError("Diesen Nutzernamen gibt es nicht. Bitte aus den Vorschlägen auswählen.");
      return;
    }

    startTransition(async () => {
      try {
        if (modus === "FACH") {
          await createFach({
            name: titel,
            semester: null,
            farbe: naechsteFarbe(faecher),
            ects: null,
            anwesenheitspflicht: false,
            max_fehltage: null,
          });
        } else if (modus === "NOTE") {
          if (!fachId) throw new Error("Bitte ein Fach wählen.");
          const wert = Number(notenWert.replace(",", "."));
          const gewicht = Number(notenGewicht.replace(",", "."));
          if (!Number.isFinite(wert) || wert < 1 || wert > 5) {
            throw new Error("Bitte eine Note zwischen 1,0 und 5,0 angeben.");
          }
          if (!Number.isFinite(gewicht) || gewicht <= 0) {
            throw new Error("Bitte ein Gewicht größer als 0 angeben.");
          }
          await createNote({
            titel,
            fach_id: fachId,
            wert,
            gewicht,
            datum: new Date().toISOString().slice(0, 10),
          });
        } else if (modus === "PRUEFUNG") {
          if (!fachId) throw new Error("Bitte ein Fach wählen.");
          if (!datumZeit) throw new Error("Bitte einen Termin angeben.");
          const erstellt = await createPruefung({
            titel,
            fach_id: fachId,
            datum: new Date(datumZeit).toISOString(),
            raum: null,
            status: "ANSTEHEND",
          });
          await speichereAnhaenge("pruefung", erstellt.id);
          setUnterDialogFuer({ parentTyp: "pruefung", parentId: erstellt.id, parentTitel: titel, fachId });
        } else if (!datumZeit) {
          // Kein Termin gesetzt -> eigenständiges To-Do statt Deadline.
          const erstellt = await createTodo({
            titel,
            fach_id: fachId || null,
            prioritaet: "MITTEL",
          });
          if (modus === "GRUPPENARBEIT" && teilenMit.trim()) {
            await deadlineEinladen(erstellt.id, teilenMit.trim(), "todo");
            track("mitglied_eingeladen", { ziel_typ: "todo", ort: "schnell_erfassen" });
          }
          await speichereAnhaenge("todo", erstellt.id);
          setUnterDialogFuer({ parentTyp: "todo", parentId: erstellt.id, parentTitel: titel, fachId: fachId || null });
        } else {
          const [unterTyp, unterId] = unterAuswahl ? unterAuswahl.split(":") : [null, null];
          const erstellt = await createDeadline({
            titel,
            fach_id: fachId || null,
            faellig_am: new Date(datumZeit).toISOString(),
            typ: modus,
            kategorie: "NORMAL",
            todoId: unterTyp === "todo" ? unterId : undefined,
            pruefungId: unterTyp === "pruefung" ? unterId : undefined,
          });
          if (erstellt[0]) {
            if (modus === "GRUPPENARBEIT" && teilenMit.trim()) {
              await deadlineEinladen(erstellt[0].id, teilenMit.trim());
              track("mitglied_eingeladen", { ziel_typ: "deadline", ort: "schnell_erfassen" });
            }
            await speichereAnhaenge("deadline", erstellt[0].id);
            setUnterDialogFuer({
              parentTyp: "deadline",
              parentId: erstellt[0].id,
              parentTitel: titel,
              fachId: fachId || null,
            });
          }
        }

        track("quick_add_benutzt", {
          typ: modus,
          typ_automatisch_erkannt: !typManuellGesetzt,
          mit_termin: Boolean(datumZeit),
          als_todo_gespeichert: istUnterstuetzterDeadlineTyp && !datumZeit,
          geteilt: modus === "GRUPPENARBEIT" && teilenMit.trim() !== "",
          anzahl_anhaenge: anhaenge.length,
          als_unteraufgabe_von: unterAuswahl ? unterAuswahl.split(":")[0] : null,
        });
        setNotenWert("");
        setNotenGewicht("1");
        setTitel("");
        setFachId(faecher[0]?.id ?? "");
        setDatumZeit("");
        setUnterAuswahl("");
        setTeilenMit("");
        setNutzerVorschlaege([]);
        setAnhaenge([]);
        handleClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  const istEntitaetOhneFach = modus === "FACH";
  const brauchtFach = modus === "NOTE" || modus === "PRUEFUNG";
  const zeigeDatumZeit = modus !== "FACH" && modus !== "NOTE";
  const istUnterstuetzterDeadlineTyp =
    modus === "ABGABE" || modus === "TERMIN" || modus === "GRUPPENARBEIT" || modus === "SONSTIGE";
  const wirdAlsTodoGespeichert = istUnterstuetzterDeadlineTyp && !datumZeit;
  const teilenMitGueltig = nutzerVorschlaege.some(
    (n) => n.username.toLowerCase() === teilenMit.trim().toLowerCase(),
  );
  const teilenMitUnbekannt =
    modus === "GRUPPENARBEIT" &&
    teilenMit.trim().length >= 2 &&
    !teilenMitSuchLaeuft &&
    !teilenMitGueltig;

  return (
    <>
      <button
        type="button"
        className="btnp"
        onClick={() => {
          setOpen(true);
          track("schnell_erfassen_geoeffnet", { quelle: "button" });
        }}
        title="Schnell erfassen (Taste Q)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Schnell erfassen
      </button>

      {open && (
        <div className="quick-add-overlay" onClick={handleClose}>
          <form
            className="quick-add-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
          >
            <h3>Neu anlegen</h3>
            {error && <p className="auth-error">{error}</p>}

            <input
              ref={inputRef}
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="Titel…"
              required
            />

            {anhaenge.length > 0 && (
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {anhaenge.map((a) => (
                  <span key={a.url} className="tag">
                    {a.titel}
                    <button
                      type="button"
                      aria-label={`Anhang ${a.titel} entfernen`}
                      onClick={() => entferneAnhang(a.url)}
                      style={{ marginLeft: 6, border: "none", background: "none", color: "inherit", cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="row" style={{ gap: 6 }}>
              <input
                type="text"
                value={linkEingabe}
                onChange={(e) => setLinkEingabe(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    linkHinzufuegen();
                  }
                }}
                placeholder="Link hinzufügen (optional)"
                style={{ flex: 1 }}
              />
              <button type="button" className="unteraufgabe-add" onClick={linkHinzufuegen}>
                + Link
              </button>
            </div>

            {modus === "NOTE" && (
              <div className="row" style={{ gap: 6 }}>
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  max="5"
                  step="0.1"
                  value={notenWert}
                  onChange={(e) => setNotenWert(e.target.value)}
                  placeholder="Note (1,0–5,0)"
                  aria-label="Note"
                  required
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  step="0.1"
                  value={notenGewicht}
                  onChange={(e) => setNotenGewicht(e.target.value)}
                  placeholder="Gewicht"
                  aria-label="Gewicht"
                  style={{ width: 110 }}
                />
              </div>
            )}

            {zeigeDatumZeit && (
              <input
                type="datetime-local"
                value={datumZeit}
                onChange={(e) => {
                  setDatumZeit(e.target.value);
                  setDatumManuellGesetzt(true);
                }}
                aria-label={modus === "PRUEFUNG" ? "Termin am" : "Fällig am (leer lassen = To-Do ohne Termin)"}
                required={modus === "PRUEFUNG"}
              />
            )}

            {!istEntitaetOhneFach && faecher.length > 0 && (
              <select value={fachId} onChange={(e) => setFachId(e.target.value)}>
                {!brauchtFach && <option value="">Kein Fach</option>}
                {faecher.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}

            <div role="radiogroup" aria-label="Typ" className="row" style={{ gap: 8, overflowX: "auto", paddingBottom: 2 }}>
              {ALLE_MODI.map((key, index) => (
                <button
                  key={key}
                  ref={(el) => {
                    chipRefs.current[index] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={modus === key}
                  tabIndex={modus === key ? 0 : -1}
                  className={`chip ${modus === key ? "on" : ""}`}
                  onClick={() => waehleModus(key)}
                  onKeyDown={(e) => handleChipKeydown(e, index)}
                >
                  {CHIP_LABEL[key]}
                </button>
              ))}
            </div>

            {wirdAlsTodoGespeichert && (
              <p className="muted" style={{ fontSize: 12 }}>
                Ohne Termin wird daraus ein To-Do.
              </p>
            )}

            {modus === "GRUPPENARBEIT" && (
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={teilenMit}
                  onChange={(e) => handleTeilenMitChange(e.target.value)}
                  placeholder="Wer nimmt teil? Nutzername eingeben…"
                  list="quick-add-nutzer-vorschlaege"
                />
                <datalist id="quick-add-nutzer-vorschlaege">
                  {nutzerVorschlaege.map((n) => (
                    <option key={n.user_id} value={n.username} />
                  ))}
                </datalist>
                {teilenMitUnbekannt && (
                  <p className="auth-error" style={{ fontSize: 12, marginTop: 4 }}>
                    Diesen Nutzernamen gibt es nicht.
                  </p>
                )}
                {teilenMitGueltig && (
                  <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    ✓ {teilenMit.trim()} gefunden
                  </p>
                )}
              </div>
            )}

            {istUnterstuetzterDeadlineTyp && datumZeit && (todos.length > 0 || pruefungen.length > 0) && (
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

            <div className="crud-form-actions">
              <button type="submit" className="btnp" disabled={isPending}>
                {isPending ? "Speichern…" : "Hinzufügen (Enter)"}
              </button>
              <button type="button" onClick={handleClose} disabled={isPending}>
                Abbrechen (Esc)
              </button>
            </div>
          </form>
        </div>
      )}

      {unterDialogFuer && (
        <UnteraufgabenDialog
          parentTyp={unterDialogFuer.parentTyp}
          parentId={unterDialogFuer.parentId}
          parentTitel={unterDialogFuer.parentTitel}
          fachId={unterDialogFuer.fachId}
          onClose={() => setUnterDialogFuer(null)}
        />
      )}
    </>
  );
}
