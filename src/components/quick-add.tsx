"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient as browserClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";
import { createFach } from "@/app/fach/actions";
import { naechsteFarbe } from "@/lib/fach-farben";
import { createDeadline } from "@/app/deadline/actions";
import { createTodo, createUnterpunkte } from "@/app/todo/actions";
import { createNote } from "@/app/note/actions";
import { createPruefung } from "@/app/pruefung/actions";
import { benutzerSuchen, deadlineEinladen } from "@/app/einladung/actions";
import { createAnhang, type AnhangZielTyp } from "@/app/anhang/actions";
import { konfliktePruefen, type Konflikt } from "@/app/kalender/actions";
import { DAUER_OPTIONEN, STANDARD_DAUER } from "@/lib/kalender/dauer";
import { erkenneTyp, erkenneDatum, type ErkannterTyp } from "@/lib/typ-erkennung";
import { erfassenErkennen } from "@/app/(hubs)/erfassen-actions";
import { ART_NAMEN, type ErfassenArt, type ErfassenErkannt } from "@/lib/ki/erfassen";
import type { FachOption } from "@/lib/fach-option";
import type { Tables } from "@/lib/supabase/types";
import { Icon } from "@/components/nav-icon";

type TodoOption = Pick<Tables<"todo">, "id" | "titel" | "erledigt" | "parent_id">;
type PruefungOption = Pick<Tables<"pruefung">, "id" | "titel">;

/**
 * "Fach" und "Note" sind kein Teil der 5 Typ-Chips aus dem Design (die
 * bilden nur deadline_typ + Prüfung ab), brauchen aber weiterhin einen
 * Eingang in Schnell erfassen, da es dafür sonst keine andere Stelle im UI
 * gibt. Deshalb als zwei zusätzliche Chips am Ende der Leiste angehängt.
 */
export type QuickAddModus = ErkannterTyp | "FACH" | "NOTE";

/** Ereignis: Schnell erfassen öffnen (z. B. aus der Befehlspalette), detail: { modus?, titel? } */
export const SCHNELL_ERFASSEN = "uniwars-schnell-erfassen";

const CHIP_LABEL: Record<QuickAddModus, string> = {
  PRUEFUNG: "Prüfung",
  ABGABE: "Abgabe",
  TERMIN: "Termin",
  FRIST: "Frist",
  GRUPPENARBEIT: "Gruppenarbeit",
  SONSTIGE: "To-do",
  FACH: "Fach",
  NOTE: "Note",
};

const ALLE_MODI: QuickAddModus[] = [
  "PRUEFUNG",
  "ABGABE",
  "FRIST",
  "TERMIN",
  "GRUPPENARBEIT",
  "SONSTIGE",
  "FACH",
  "NOTE",
];

const KI_ZU_MODUS: Record<ErfassenArt, QuickAddModus> = {
  PRUEFUNG: "PRUEFUNG",
  GRUPPENARBEIT: "GRUPPENARBEIT",
  ABGABE: "ABGABE",
  FRIST: "FRIST",
  TERMIN: "TERMIN",
  TODO: "SONSTIGE",
};

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

function zeitspanne(start: string, ende: string): string {
  const format = (wert: string) =>
    /^\d{2}:\d{2}$/.test(wert)
      ? wert
      : new Date(wert).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return `${format(start)}–${format(ende)}`;
}

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function QuickAdd({
  faecher,
  todos = [],
  pruefungen = [],
  ohneKnopf = false,
}: {
  faecher: FachOption[];
  todos?: TodoOption[];
  pruefungen?: PruefungOption[];
  /** Ohne eigenen Knopf: geöffnet über „Schnell erfassen“-Knöpfe und die Befehlspalette (Strg+O) */
  ohneKnopf?: boolean;
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
  const [dauer, setDauer] = useState("");
  const [konflikte, setKonflikte] = useState<{ fuer: string; liste: Konflikt[] }>({ fuer: "", liste: [] });
  const [unterAuswahl, setUnterAuswahl] = useState("");
  const [teilenMit, setTeilenMit] = useState("");
  const [nutzerVorschlaege, setNutzerVorschlaege] = useState<{ user_id: string; username: string }[]>([]);
  const [teilenMitSuchLaeuft, setTeilenMitSuchLaeuft] = useState(false);
  const [anhaenge, setAnhaenge] = useState<{ url: string; titel: string }[]>([]);
  const [linkEingabe, setLinkEingabe] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fachManuell, setFachManuell] = useState(false);
  /** Unteraufgaben direkt im Formular (aufklappbar) */
  const [unterOffen, setUnterOffen] = useState(false);
  const [unter, setUnter] = useState<{ id: number; titel: string; wann: string; wer: string }[]>([]);
  /** Gruppenarbeit: eingeladene Personen (Einladung wird beim Anlegen verschickt) */
  const [mitglieder, setMitglieder] = useState<{ user_id: string; username: string }[]>([]);
  const [ichId, setIchId] = useState<string | null>(null);
  const [raum, setRaum] = useState("");
  /** KI-Erkennung zum aktuellen Text (gilt nur, solange der Text gleich bleibt) */
  const [ki, setKi] = useState<{ fuer: string; erkannt: ErfassenErkannt } | null>(null);
  const [kiLaeuft, setKiLaeuft] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const router = useRouter();

  function handleClose() {
    setOpen(false);
    setTypManuellGesetzt(false);
    setDatumManuellGesetzt(false);
    setFachManuell(false);
    setKi(null);
    setRaum("");
    setUnterOffen(false);
    setUnter([]);
    setMitglieder([]);
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
    if (!open || ichId) return;
    void browserClient()
      .auth.getUser()
      .then(({ data }) => setIchId(data.user?.id ?? null))
      .catch(() => undefined);
  }, [open, ichId]);

  function mitgliedHinzufuegen() {
    const treffer = nutzerVorschlaege.find((n) => n.username.toLowerCase() === teilenMit.trim().toLowerCase());
    if (!treffer) return;
    setMitglieder((l) => (l.some((m) => m.user_id === treffer.user_id) ? l : [...l, treffer]));
    setTeilenMit("");
    setNutzerVorschlaege([]);
  }

  // Geöffnet wird über Knopf oder Befehlspalette (Strg+O); Esc schließt
  useEffect(() => {
    if (!open) return;
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
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

  // Strg+O (Befehlspalette) öffnet Schnell erfassen mit Typ und Titel
  useEffect(() => {
    function oeffnen(e: Event) {
      const d = (e as CustomEvent<{ modus?: QuickAddModus; titel?: string; quelle?: string }>).detail ?? {};
      // Vorauswahl ist nur ein Vorschlag: Die Erkennung darf sie noch ändern
      if (d.modus && ALLE_MODI.includes(d.modus)) setModus(d.modus);
      if (typeof d.titel === "string") setTitel(d.titel);
      setOpen(true);
      track("schnell_erfassen_geoeffnet", { quelle: d.quelle ?? "befehlspalette" });
    }
    window.addEventListener(SCHNELL_ERFASSEN, oeffnen);
    return () => window.removeEventListener(SCHNELL_ERFASSEN, oeffnen);
  }, []);

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

  // KI erkennt, was es ist (Prüfung, Gruppenarbeit …), dazu Fach, Zeitpunkt, Raum – nach kurzer Tipp-Pause
  useEffect(() => {
    const satz = titel.trim();
    if (!open || satz.length < 6 || modus === "FACH" || modus === "NOTE") return;
    let aktuell = true;
    const timer = setTimeout(() => {
      setKiLaeuft(true);
      erfassenErkennen(satz)
        .then((erkannt) => {
          if (!aktuell || !erkannt) return;
          setKi({ fuer: titel, erkannt });
          if (!typManuellGesetzt) setModus(KI_ZU_MODUS[erkannt.art]);
          if (!fachManuell && erkannt.fach) {
            const f = faecher.find((x) => x.name === erkannt.fach);
            if (f) setFachId(f.id);
          }
          if (!datumManuellGesetzt && erkannt.wann) {
            setDatumZeit(erkannt.wann.includes("T") ? erkannt.wann : `${erkannt.wann}T${erkannt.art === "PRUEFUNG" ? "09:00" : "23:59"}`);
          }
          if (erkannt.raum) setRaum(erkannt.raum);
        })
        .catch(() => undefined)
        .finally(() => aktuell && setKiLaeuft(false));
    }, 800);
    return () => {
      aktuell = false;
      clearTimeout(timer);
    };
    // Nur auf neuen Text reagieren; die übrigen Werte werden beim Eintreffen gelesen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titel, open]);

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

  /** Unteraufgaben aus dem Formular anlegen (ohne Datum: Termin der Hauptaufgabe) */
  async function unteraufgabenAnlegen(parentTyp: "todo" | "deadline" | "pruefung", parentId: string, fach: string | null) {
    const liste = unter.filter((u) => u.titel.trim());
    if (!liste.length) return;
    if (parentTyp === "todo") {
      await createUnterpunkte(
        parentId,
        fach,
        liste.map((u) => ({ titel: u.titel.trim(), faelligAm: u.wann ? new Date(u.wann).toISOString() : undefined, zugewiesenAn: u.wer || undefined })),
      );
    } else {
      for (const u of liste) {
        await createDeadline({
          titel: u.titel.trim(),
          fach_id: fach,
          faellig_am: new Date(u.wann || datumZeit).toISOString(),
          typ: "ABGABE",
          kategorie: "NORMAL",
          pruefungId: parentTyp === "pruefung" ? parentId : undefined,
          parentDeadlineId: parentTyp === "deadline" ? parentId : undefined,
          zugewiesenAn: u.wer || undefined,
        });
      }
    }
    track("unteraufgaben_angelegt", { eltern_typ: parentTyp, anzahl: liste.length, ort: "schnell_erfassen" });
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

    const offenerName = nutzerVorschlaege.find((n) => n.username.toLowerCase() === teilenMit.trim().toLowerCase());
    const einladen = modus === "GRUPPENARBEIT" ? [...mitglieder, ...(offenerName && !mitglieder.some((m) => m.user_id === offenerName.user_id) ? [offenerName] : [])] : [];

    // Titel ohne Datum/Uhrzeit/Raum, wenn die KI ihn zum aktuellen Text bereinigt hat
    const name = modus !== "FACH" && modus !== "NOTE" && ki?.fuer === titel && ki.erkannt.titel ? ki.erkannt.titel : titel;

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
            titel: name,
            fach_id: fachId,
            datum: new Date(datumZeit).toISOString(),
            raum: raum.trim() || null,
            status: "ANSTEHEND",
            dauer_minuten: dauer ? Number(dauer) : null,
          });
          await speichereAnhaenge("pruefung", erstellt.id);
          await unteraufgabenAnlegen("pruefung", erstellt.id, fachId);
        } else if (!datumZeit) {
          // Kein Termin gesetzt -> eigenständiges To-Do statt Deadline.
          const erstellt = await createTodo({
            titel: name,
            fach_id: fachId || null,
            prioritaet: "MITTEL",
          });
          for (const m of einladen) {
            await deadlineEinladen(erstellt.id, m.username, "todo");
            track("mitglied_eingeladen", { ziel_typ: "todo", ort: "schnell_erfassen" });
          }
          await speichereAnhaenge("todo", erstellt.id);
          await unteraufgabenAnlegen("todo", erstellt.id, fachId || null);
        } else {
          const [unterTyp, unterId] = unterAuswahl ? unterAuswahl.split(":") : [null, null];
          const erstellt = await createDeadline({
            titel: name,
            fach_id: fachId || null,
            faellig_am: new Date(datumZeit).toISOString(),
            typ: modus,
            kategorie: "NORMAL",
            todoId: unterTyp === "todo" ? unterId : undefined,
            pruefungId: unterTyp === "pruefung" ? unterId : undefined,
            dauerMinuten: hatDauer && dauer ? Number(dauer) : null,
          });
          if (erstellt[0]) {
            for (const m of einladen) {
              await deadlineEinladen(erstellt[0].id, m.username);
              track("mitglied_eingeladen", { ziel_typ: "deadline", ort: "schnell_erfassen" });
            }
            await speichereAnhaenge("deadline", erstellt[0].id);
            await unteraufgabenAnlegen("deadline", erstellt[0].id, fachId || null);
          }
        }

        track("quick_add_benutzt", {
          typ: modus,
          typ_automatisch_erkannt: !typManuellGesetzt,
          mit_termin: Boolean(datumZeit),
          als_todo_gespeichert: istUnterstuetzterDeadlineTyp && !datumZeit,
          geteilt: einladen.length > 0,
          anzahl_anhaenge: anhaenge.length,
          als_unteraufgabe_von: unterAuswahl ? unterAuswahl.split(":")[0] : null,
        });
        setNotenWert("");
        setNotenGewicht("1");
        setTitel("");
        setFachId(faecher[0]?.id ?? "");
        setDatumZeit("");
        setDauer("");
        setUnterAuswahl("");
        setTeilenMit("");
        setMitglieder([]);
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
    modus === "ABGABE" || modus === "FRIST" || modus === "TERMIN" || modus === "GRUPPENARBEIT" || modus === "SONSTIGE";
  const hatDauer = modus === "PRUEFUNG" || modus === "TERMIN" || modus === "GRUPPENARBEIT";
  const standardDauer =
    modus === "PRUEFUNG" || modus === "TERMIN" || modus === "GRUPPENARBEIT" || modus === "ABGABE" || modus === "SONSTIGE" || modus === "FRIST"
      ? STANDARD_DAUER[modus]
      : 15;
  const effektiveDauer = hatDauer && dauer ? Number(dauer) : standardDauer;
  const konfliktSchluessel = open && zeigeDatumZeit && datumZeit ? `${datumZeit}|${effektiveDauer}` : "";
  const sichtbareKonflikte = konflikte.fuer === konfliktSchluessel ? konflikte.liste : [];

  useEffect(() => {
    if (!konfliktSchluessel) return;
    const timer = setTimeout(() => {
      const start = new Date(datumZeit);
      const ende = new Date(start.getTime() + effektiveDauer * 60_000);
      konfliktePruefen(start.toISOString(), ende.toISOString())
        .then((liste) => setKonflikte({ fuer: konfliktSchluessel, liste }))
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(timer);
  }, [konfliktSchluessel, datumZeit, effektiveDauer]);
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
      {!ohneKnopf && (
        <button
          type="button"
          className="btnp"
          onClick={() => {
            setOpen(true);
            track("schnell_erfassen_geoeffnet", { quelle: "button" });
          }}
          title="Schnell erfassen"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Schnell erfassen
        </button>
      )}

      {open && (
        <div className="erfassen-hinter" onClick={handleClose}>
          <form
            className="erfassen"
            role="dialog"
            aria-modal="true"
            aria-labelledby="erfassen-titel"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
          >
            <h2 id="erfassen-titel" className="vh">
              Schnell erfassen
            </h2>

            <div className="erfassen-eingabe">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              <input
                ref={inputRef}
                value={titel}
                onChange={(e) => setTitel(e.target.value)}
                placeholder={modus === "FACH" ? "Name des Fachs" : modus === "NOTE" ? "Wofür ist die Note?" : "Was steht an? z. B. „Klausur Statistik 12.2. 10 Uhr H1“"}
                aria-label="Was steht an?"
                required
              />
            </div>

            {modus !== "FACH" && modus !== "NOTE" && (kiLaeuft || ki?.fuer === titel) && (
              <p className="erfassen-erkannt" role="status">
                {kiLaeuft ? (
                  <span className="faint">Erkenne …</span>
                ) : ki?.fuer === titel ? (
                  <>
                    <span className="erfassen-ki" aria-hidden>
                      <Icon name="studio" groesse={14} />
                    </span>
                    Erkannt: <b>{ART_NAMEN[ki.erkannt.art]}</b>
                    {modus !== KI_ZU_MODUS[ki.erkannt.art] && (
                      <button
                        type="button"
                        className="erfassen-uebernehmen"
                        onClick={() => {
                          setModus(KI_ZU_MODUS[ki.erkannt.art]);
                          setTypManuellGesetzt(false);
                        }}
                      >
                        übernehmen
                      </button>
                    )}
                    {ki.erkannt.fach && <>, {ki.erkannt.fach}</>}
                    {ki.erkannt.wann && <>, {new Date(ki.erkannt.wann.includes("T") ? ki.erkannt.wann : `${ki.erkannt.wann}T12:00`).toLocaleString("de-DE", ki.erkannt.wann.includes("T") ? { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { weekday: "short", day: "numeric", month: "short" })}</>}
                    {ki.erkannt.raum && <>, {ki.erkannt.raum}</>}
                    {ki.erkannt.titel && ki.erkannt.titel !== titel.trim() && <span className="faint">, wird gespeichert als „{ki.erkannt.titel}“</span>}
                  </>
                ) : null}
              </p>
            )}

            {error && <p className="auth-error">{error}</p>}

            <div role="radiogroup" aria-label="Art" className="erfassen-arten">
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
                  className={modus === key ? "an" : undefined}
                  onClick={() => waehleModus(key)}
                  onKeyDown={(e) => handleChipKeydown(e, index)}
                >
                  {CHIP_LABEL[key]}
                </button>
              ))}
            </div>

            <div className="erfassen-felder">
              {modus === "NOTE" && (
                <>
                  <label>
                    <span>Note</span>
                    <input
                      className="field"
                      type="number"
                      inputMode="decimal"
                      min="1"
                      max="5"
                      step="0.1"
                      value={notenWert}
                      onChange={(e) => setNotenWert(e.target.value)}
                      placeholder="1,0–5,0"
                      required
                    />
                  </label>
                  <label>
                    <span>Gewicht</span>
                    <input
                      className="field"
                      type="number"
                      inputMode="decimal"
                      min="0.1"
                      step="0.1"
                      value={notenGewicht}
                      onChange={(e) => setNotenGewicht(e.target.value)}
                    />
                  </label>
                </>
              )}

              {zeigeDatumZeit && (
                <label>
                  <span>{modus === "PRUEFUNG" ? "Termin" : modus === "TERMIN" ? "Wann" : "Fällig"}</span>
                  <input
                    className="field"
                    type="datetime-local"
                    value={datumZeit}
                    onChange={(e) => {
                      setDatumZeit(e.target.value);
                      setDatumManuellGesetzt(true);
                    }}
                    required={modus !== "SONSTIGE"}
                  />
                </label>
              )}

              {hatDauer && datumZeit && (
                <label>
                  <span>Dauer</span>
                  <select className="field" value={dauer} onChange={(e) => setDauer(e.target.value)}>
                    <option value="">{standardDauer} Min. (Standard)</option>
                    {DAUER_OPTIONEN.filter((m) => m !== standardDauer).map((m) => (
                      <option key={m} value={m}>
                        {m >= 60 && m % 60 === 0 ? `${m / 60} Std.` : `${m} Min.`}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {!istEntitaetOhneFach && faecher.length > 0 && (
                <label>
                  <span>Fach</span>
                  <select
                    className="field"
                    value={fachId}
                    onChange={(e) => {
                      setFachId(e.target.value);
                      setFachManuell(true);
                    }}
                  >
                    {!brauchtFach && <option value="">Kein Fach</option>}
                    {faecher.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {modus === "PRUEFUNG" && (
                <label>
                  <span>Raum</span>
                  <input className="field" value={raum} onChange={(e) => setRaum(e.target.value)} placeholder="optional" maxLength={60} />
                </label>
              )}

              {modus === "GRUPPENARBEIT" && (
                <label className="erfassen-breit">
                  <span>Mit wem?</span>
                  {mitglieder.length > 0 && (
                    <span className="erfassen-anhaenge">
                      {mitglieder.map((m) => (
                        <span key={m.user_id} className="erfassen-anhang">
                          @{m.username}
                          <button type="button" aria-label={`${m.username} entfernen`} onClick={() => setMitglieder((l) => l.filter((x) => x.user_id !== m.user_id))}>
                            <Icon name="schliessen" groesse={16} />
                          </button>
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="erfassen-link">
                    <input
                      className="field"
                      type="text"
                      value={teilenMit}
                      onChange={(e) => handleTeilenMitChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          mitgliedHinzufuegen();
                        }
                      }}
                      placeholder={mitglieder.length ? "Weitere Person …" : "Nutzername eingeben …"}
                      list="quick-add-nutzer-vorschlaege"
                    />
                    <button type="button" className="knopf neben klein" disabled={!teilenMitGueltig} onClick={mitgliedHinzufuegen}>
                      Einladen
                    </button>
                  </span>
                  <datalist id="quick-add-nutzer-vorschlaege">
                    {nutzerVorschlaege.map((n) => (
                      <option key={n.user_id} value={n.username} />
                    ))}
                  </datalist>
                  {teilenMitUnbekannt && <small className="auth-error">Diesen Nutzernamen gibt es nicht.</small>}
                  {teilenMitGueltig && <small className="faint">{teilenMit.trim()} gefunden. Mit Enter hinzufügen.</small>}
                </label>
              )}

              {istUnterstuetzterDeadlineTyp && datumZeit && (todos.length > 0 || pruefungen.length > 0) && (
                <label className="erfassen-breit">
                  <span>Gehört zu</span>
                  <select className="field" value={unterAuswahl} onChange={(e) => setUnterAuswahl(e.target.value)}>
                    <option value="">Nichts, eigenständig</option>
                    {todos.filter((t) => !t.erledigt).length > 0 && (
                      <optgroup label="To-do">
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
                      <optgroup label="Prüfung">
                        {pruefungen.map((p) => (
                          <option key={p.id} value={`pruefung:${p.id}`}>
                            {p.titel}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </label>
              )}

              {modus !== "FACH" && modus !== "NOTE" && (
                <label className="erfassen-breit">
                  <span>Link</span>
                  <span className="erfassen-link">
                    <input
                      className="field"
                      type="text"
                      value={linkEingabe}
                      onChange={(e) => setLinkEingabe(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          linkHinzufuegen();
                        }
                      }}
                      placeholder="optional, z. B. Moodle-Aufgabe"
                    />
                    <button type="button" className="knopf neben klein" onClick={linkHinzufuegen}>
                      Hinzufügen
                    </button>
                  </span>
                  {anhaenge.length > 0 && (
                    <span className="erfassen-anhaenge">
                      {anhaenge.map((a) => (
                        <span key={a.url} className="erfassen-anhang">
                          {a.titel}
                          <button type="button" aria-label={`Anhang ${a.titel} entfernen`} onClick={() => entferneAnhang(a.url)}>
                            <Icon name="schliessen" groesse={16} />
                          </button>
                        </span>
                      ))}
                    </span>
                  )}
                </label>
              )}
            </div>

            {modus !== "FACH" && modus !== "NOTE" && (
              <div className="erfassen-unter">
                {!unterOffen ? (
                  <button
                    type="button"
                    className="erfassen-unter-knopf"
                    onClick={() => {
                      setUnterOffen(true);
                      setUnter((u) => (u.length ? u : [{ id: Date.now(), titel: "", wann: "", wer: "" }]));
                    }}
                  >
                    + Unteraufgaben
                  </button>
                ) : (
                  <>
                    <span className="erfassen-unter-titel">Unteraufgaben</span>
                    {unter.map((u, i) => (
                      <div key={u.id} className={`erfassen-unter-zeile${modus === "GRUPPENARBEIT" ? " mit-wer" : ""}`}>
                        <input
                          className="field"
                          autoFocus={i === unter.length - 1 && !u.titel}
                          value={u.titel}
                          placeholder={`Schritt ${i + 1}, z. B. „Literatur suchen“`}
                          onChange={(e) => setUnter((l) => l.map((x) => (x.id === u.id ? { ...x, titel: e.target.value } : x)))}
                          onKeyDown={(e) => {
                            // Enter in einer Unteraufgabe: nächste Zeile statt Absenden
                            if (e.key === "Enter") {
                              e.preventDefault();
                              setUnter((l) => [...l, { id: Date.now(), titel: "", wann: "", wer: "" }]);
                            }
                          }}
                          aria-label={`Unteraufgabe ${i + 1}`}
                        />
                        {modus === "GRUPPENARBEIT" && (
                          <select
                            className="field"
                            value={u.wer}
                            onChange={(e) => setUnter((l) => l.map((x) => (x.id === u.id ? { ...x, wer: e.target.value } : x)))}
                            aria-label={`Zuständig für Unteraufgabe ${i + 1}`}
                          >
                            <option value="">Niemand</option>
                            {ichId && <option value={ichId}>Ich</option>}
                            {mitglieder.map((m) => (
                              <option key={m.user_id} value={m.user_id}>
                                @{m.username}
                              </option>
                            ))}
                          </select>
                        )}
                        <input
                          className="field"
                          type="datetime-local"
                          value={u.wann}
                          onChange={(e) => setUnter((l) => l.map((x) => (x.id === u.id ? { ...x, wann: e.target.value } : x)))}
                          aria-label={`Termin für Unteraufgabe ${i + 1} (optional)`}
                          title="Optional, ohne Datum gilt der Termin der Hauptaufgabe"
                        />
                        <button type="button" className="erfassen-unter-weg" aria-label={`Unteraufgabe ${i + 1} entfernen`} onClick={() => setUnter((l) => l.filter((x) => x.id !== u.id))}>
                          <Icon name="schliessen" groesse={16} />
                        </button>
                      </div>
                    ))}
                    <button type="button" className="erfassen-unter-knopf" onClick={() => setUnter((l) => [...l, { id: Date.now(), titel: "", wann: "", wer: "" }])}>
                      + Weitere Unteraufgabe
                    </button>
                  </>
                )}
              </div>
            )}

            {sichtbareKonflikte.length > 0 && (
              <div className="konflikt-hinweis" role="status">
                <strong>Überschneidung:</strong>
                <ul>
                  {sichtbareKonflikte.map((k, i) => (
                    <li key={i}>
                      {k.quelle === "google"
                        ? `In deinem Google Kalender ist schon etwas geplant (${zeitspanne(k.start, k.ende)})`
                        : `${k.titel} (${zeitspanne(k.start, k.ende)})`}
                    </li>
                  ))}
                </ul>
                <span className="faint">Speichern ist trotzdem möglich.</span>
              </div>
            )}

            <div className="erfassen-fuss">
              <span className="faint">
                {modus === "PRUEFUNG"
                  ? "Legt auch eine offene Note an."
                  : modus === "SONSTIGE"
                    ? "Datum optional."
                    : ""}
              </span>
              <button type="button" className="knopf neben" onClick={handleClose} disabled={isPending}>
                Abbrechen <kbd>Esc</kbd>
              </button>
              <button type="submit" className="knopf haupt" disabled={isPending}>
                {isPending ? "Speichert …" : "Anlegen"} <kbd>↵</kbd>
              </button>
            </div>
          </form>
        </div>
      )}

    </>
  );
}

/**
 * Knopf „Schnell erfassen“ im Bereichskopf: öffnet das Formular aus dem gemeinsamen Rahmen (genau ein QuickAdd für die ganze App).
 * Am Handy steht dafür der Plus-Knopf in der Tab-Leiste, deshalb ist dieser Knopf dort ausgeblendet.
 */
export function SchnellErfassenKnopf() {
  return (
    <button
      type="button"
      className="knopf haupt schnell-erfassen-knopf"
      onClick={() => {
        window.dispatchEvent(new CustomEvent(SCHNELL_ERFASSEN, { detail: { quelle: "button" } }));
      }}
    >
      <Icon name="plus" groesse={16} />
      Schnell erfassen <kbd>Q</kbd>
    </button>
  );
}
