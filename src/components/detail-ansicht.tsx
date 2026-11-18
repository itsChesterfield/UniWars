"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  detailLaden,
  type DetailDaten,
  type DetailZielTyp,
} from "@/app/aufgaben-detail/actions";
import { toggleTodoErledigt, createUnterpunkte } from "@/app/todo/actions";
import { toggleDeadlineErledigt, createDeadline } from "@/app/deadline/actions";
import { benutzerSuchen, deadlineEinladen } from "@/app/einladung/actions";
import { AnhangListe } from "@/components/anhang-liste";
import { UnteraufgabenEditor, type UnteraufgabeEingabe } from "@/components/unteraufgaben-editor";
import { farbeFuerMitglied } from "@/lib/mitglied-farbe";
import { track } from "@/lib/analytics";
import { Icon } from "@/components/nav-icon";
import { Skelett } from "@/components/skelett";
import { FokusZeit } from "@/components/work-station/fokus-zeit";

const TYP_LABEL: Record<DetailZielTyp, string> = {
  todo: "To-Do",
  deadline: "Deadline",
  pruefung: "Prüfung",
};

function formatKurz(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

export function DetailAnsicht({
  zielTyp,
  zielId,
  onClose,
}: {
  zielTyp: DetailZielTyp;
  zielId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [daten, setDaten] = useState<DetailDaten | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mitgliedFormOffen, setMitgliedFormOffen] = useState(false);
  const [mitgliedSuche, setMitgliedSuche] = useState("");
  const [mitgliedVorschlaege, setMitgliedVorschlaege] = useState<{ user_id: string; username: string }[]>([]);
  const [mitgliedError, setMitgliedError] = useState<string | null>(null);
  const [mitgliedPending, startMitgliedTransition] = useTransition();

  const [unterFormOffen, setUnterFormOffen] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
    track("aufgabe_detail_geoeffnet", { typ: zielTyp });
    detailLaden(zielTyp, zielId)
      .then(setDaten)
      .catch((err) => setError(err instanceof Error ? err.message : "Unbekannter Fehler"));
  }, [zielTyp, zielId]);

  function schliessen() {
    dialogRef.current?.close();
    onClose();
  }

  async function neuLaden() {
    const frisch = await detailLaden(zielTyp, zielId);
    setDaten(frisch);
  }

  function handleUnteraufgabeToggle(id: string, erledigt: boolean) {
    if (!daten) return;
    setDaten({
      ...daten,
      unteraufgaben: daten.unteraufgaben.map((u) => (u.id === id ? { ...u, erledigt } : u)),
    });
    const toggeln = daten.typ === "todo" ? toggleTodoErledigt : toggleDeadlineErledigt;
    if (erledigt) track("unteraufgabe_erledigt", { eltern_typ: daten.typ, ort: "detail" });
    toggeln(id, erledigt).then(() => router.refresh());
  }

  function handleMitgliedSucheChange(value: string) {
    setMitgliedSuche(value);
    setMitgliedError(null);
    if (value.trim().length < 2) {
      setMitgliedVorschlaege([]);
      return;
    }
    startMitgliedTransition(async () => {
      try {
        setMitgliedVorschlaege(await benutzerSuchen(value));
      } catch {
        setMitgliedVorschlaege([]);
      }
    });
  }

  function mitgliedEinladen(username: string) {
    setMitgliedError(null);
    startMitgliedTransition(async () => {
      try {
        await deadlineEinladen(zielId, username, zielTyp);
        track("mitglied_eingeladen", { ziel_typ: zielTyp, ort: "detail" });
        setMitgliedSuche("");
        setMitgliedVorschlaege([]);
        setMitgliedFormOffen(false);
        await neuLaden();
      } catch (err) {
        setMitgliedError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  async function unteraufgabenSpeichern(eintraege: UnteraufgabeEingabe[]) {
    if (!daten) return;
    if (daten.typ === "todo") {
      await createUnterpunkte(
        zielId,
        daten.fachId,
        eintraege.map((e) => ({
          titel: e.titel,
          faelligAm: e.faelligAm ? new Date(e.faelligAm).toISOString() : undefined,
          zugewiesenAn: e.zugewiesenAn || undefined,
        })),
      );
    } else {
      for (const e of eintraege) {
        await createDeadline({
          titel: e.titel,
          fach_id: daten.fachId,
          faellig_am: new Date(e.faelligAm).toISOString(),
          typ: "ABGABE",
          kategorie: "NORMAL",
          pruefungId: daten.typ === "pruefung" ? zielId : undefined,
          parentDeadlineId: daten.typ === "deadline" ? zielId : undefined,
          zugewiesenAn: e.zugewiesenAn || undefined,
        });
      }
    }
    setUnterFormOffen(false);
    await neuLaden();
    router.refresh();
  }

  return (
    <dialog
      ref={dialogRef}
      className="detail-dialog"
      aria-labelledby={daten ? "detail-titel" : undefined}
      aria-label={daten ? undefined : "Details"}
      onCancel={(e) => {
        e.preventDefault();
        schliessen();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) schliessen();
      }}
    >
      {error && <p className="auth-error">{error}</p>}

      {!daten && !error && <Skelett form="text" />}

      {daten && (
        <div className="detail">
          <header className="detail-kopf">
            <div className="detail-titelblock">
              <span className="detail-typ">{TYP_LABEL[daten.typ]}</span>
              <h2 id="detail-titel">{daten.titel}</h2>
              <p className="detail-meta">
                {daten.fach && (
                  <>
                    <span className="dot" style={{ background: daten.fach.farbe ?? "var(--text-3)" }} aria-hidden />
                    {daten.fach.name},{" "}
                  </>
                )}
                {daten.faelligAm ? formatKurz(daten.faelligAm) : "Kein Termin"}
              </p>
            </div>
            {daten.countdownTage !== null && (
              <div className="detail-countdown">
                <span className="zahl">{daten.countdownTage}</span>
                <span>{daten.countdownTage === 1 ? "Tag" : "Tage"}</span>
              </div>
            )}
          </header>

          <section className="detail-abschnitt" aria-labelledby="detail-mitglieder">
            <div className="detail-abschnitt-kopf">
              <h3 id="detail-mitglieder" className="aufgaben-untertitel">Mitglieder</h3>
              <button
                type="button"
                className="link"
                aria-expanded={mitgliedFormOffen}
                onClick={() => setMitgliedFormOffen((v) => !v)}
              >
                <Icon name="plus" groesse={16} />
                Mitglied
              </button>
            </div>

            {daten.mitglieder.length === 0 ? (
              <p className="detail-leer">Noch niemand dabei. Lade jemanden über „Mitglied“ ein.</p>
            ) : (
              <ul className="detail-mitglieder">
                {daten.mitglieder.map((m, index) => (
                  <li key={m.user_id}>
                    <span
                      className="detail-avatar"
                      style={{ "--mitglied": farbeFuerMitglied(index) } as CSSProperties}
                      aria-hidden
                    >
                      {m.initiale}
                    </span>
                    <span className="detail-person">
                      <span className="name">{m.username ?? "?"}</span>
                      <span className="rolle">
                        {m.rolle === "ERSTELLER" ? "Ersteller" : m.rolle === "DABEI" ? "Dabei" : "Eingeladen"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {mitgliedFormOffen && (
              <div className="detail-einladen">
                <input
                  type="text"
                  value={mitgliedSuche}
                  onChange={(e) => handleMitgliedSucheChange(e.target.value)}
                  placeholder="Nutzername suchen…"
                  aria-label="Nutzername suchen"
                  autoFocus
                />
                {mitgliedVorschlaege.length > 0 && (
                  <ul className="deadline-teilen-treffer">
                    {mitgliedVorschlaege.map((n) => (
                      <li key={n.user_id}>
                        <span>{n.username}</span>
                        <button
                          type="button"
                          className="knopf neben klein"
                          disabled={mitgliedPending}
                          aria-busy={mitgliedPending}
                          onClick={() => mitgliedEinladen(n.username)}
                        >
                          Einladen
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {mitgliedError && <p className="auth-error unteraufgabe-fehler">{mitgliedError}</p>}
              </div>
            )}
          </section>

          <FokusZeit typ={daten.typ} id={zielId} />

          <section className="detail-abschnitt" aria-labelledby="detail-unteraufgaben">
            <div className="detail-abschnitt-kopf">
              <h3 id="detail-unteraufgaben" className="aufgaben-untertitel">
                Unteraufgaben ({daten.unteraufgaben.length})
              </h3>
              <button
                type="button"
                className="link"
                aria-expanded={unterFormOffen}
                onClick={() => setUnterFormOffen((v) => !v)}
              >
                <Icon name="plus" groesse={16} />
                Unteraufgabe
              </button>
            </div>

            {daten.unteraufgaben.length === 0 && !unterFormOffen ? (
              <p className="detail-leer">Keine Unteraufgaben. Teile die Arbeit in Schritte mit eigenem Termin.</p>
            ) : (
              <div className="unteraufgaben">
                {daten.unteraufgaben.map((u) => (
                  <div key={u.id} className={`unteraufgabe-row ${u.erledigt ? "entry-erledigt" : ""}`}>
                    <input
                      type="checkbox"
                      checked={u.erledigt}
                      onChange={(e) => handleUnteraufgabeToggle(u.id, e.target.checked)}
                      aria-label={`${u.titel} erledigt`}
                    />
                    <div className="unteraufgabe-info">
                      <span>{u.titel}</span>
                    </div>
                    {u.zugewiesenAn && (
                      <span className="unteraufgabe-meta">
                        {daten.mitglieder.find((m) => m.user_id === u.zugewiesenAn)?.username ?? "?"}
                      </span>
                    )}
                    {u.faelligAm && <span className="unteraufgabe-meta">{formatKurz(u.faelligAm)}</span>}
                  </div>
                ))}
              </div>
            )}

            {unterFormOffen && (
              <UnteraufgabenEditor
                elternTyp={daten.typ}
                ort="detail"
                mitglieder={daten.mitglieder}
                terminPflicht={daten.typ !== "todo"}
                onSpeichern={unteraufgabenSpeichern}
                onAbbrechen={() => setUnterFormOffen(false)}
              />
            )}
          </section>

          <section className="detail-abschnitt" aria-labelledby="detail-anhaenge">
            <h3 id="detail-anhaenge" className="aufgaben-untertitel">Anhänge</h3>
            <AnhangListe zielTyp={daten.typ} zielId={zielId} initial={daten.anhaenge} />
          </section>

          <div className="detail-fuss">
            <button type="button" className="knopf leise" onClick={schliessen}>
              Schließen
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
