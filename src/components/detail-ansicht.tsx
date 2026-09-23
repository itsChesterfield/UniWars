"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
      className="card"
      style={{ maxWidth: 680, width: "100%" }}
      onCancel={(e) => {
        e.preventDefault();
        schliessen();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) schliessen();
      }}
    >
      {error && <p className="auth-error">{error}</p>}

      {!daten && !error && <p className="muted">Lädt…</p>}

      {daten && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="rowb" style={{ alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
              <span className="tag tag-accent" style={{ alignSelf: "flex-start" }}>
                {TYP_LABEL[daten.typ]}
              </span>
              <h2 style={{ fontSize: 24 }}>{daten.titel}</h2>
              <div className="row muted" style={{ gap: 8, fontSize: 13 }}>
                {daten.fach && (
                  <>
                    <span className="dot" style={{ background: daten.fach.farbe ?? "#94a3b8" }} />
                    {daten.fach.name}
                    <span className="faint">·</span>
                  </>
                )}
                {daten.faelligAm ? formatKurz(daten.faelligAm) : "Kein Termin"}
              </div>
            </div>
            {daten.countdownTage !== null && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <span className="entry-countdown-wert" style={{ fontSize: 34 }}>
                  {daten.countdownTage}
                </span>
                <span className="entry-countdown-einheit">
                  {daten.countdownTage === 1 ? "Tag" : "Tage"}
                </span>
              </div>
            )}
          </div>

          <hr className="sep" />

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="rowb">
              <span className="aufgaben-untertitel" style={{ margin: 0 }}>Mitglieder</span>
              <button
                type="button"
                className="unteraufgabe-add"
                onClick={() => setMitgliedFormOffen((v) => !v)}
              >
                + Mitglied
              </button>
            </div>

            {daten.mitglieder.length === 0 ? (
              <p className="faint" style={{ fontSize: 12 }}>Keine Mitglieder.</p>
            ) : (
              <div className="row" style={{ gap: 22, flexWrap: "wrap" }}>
                {daten.mitglieder.map((m, index) => (
                  <div className="row" style={{ gap: 8 }} key={m.user_id}>
                    <span
                      className="avatar"
                      style={{
                        width: 30,
                        height: 30,
                        fontSize: 12,
                        borderRadius: 9,
                        background: farbeFuerMitglied(index),
                        color: "#fff",
                      }}
                    >
                      {m.initiale}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{m.username ?? "?"}</span>
                      <span className="faint" style={{ fontSize: 11 }}>
                        {m.rolle === "ERSTELLER" ? "Ersteller" : m.rolle === "DABEI" ? "Dabei" : "Eingeladen"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {mitgliedFormOffen && (
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={mitgliedSuche}
                  onChange={(e) => handleMitgliedSucheChange(e.target.value)}
                  placeholder="Nutzername suchen…"
                  autoFocus
                />
                {mitgliedVorschlaege.length > 0 && (
                  <ul className="deadline-teilen-treffer" style={{ marginTop: 6 }}>
                    {mitgliedVorschlaege.map((n) => (
                      <li key={n.user_id}>
                        <span>{n.username}</span>
                        <button type="button" disabled={mitgliedPending} onClick={() => mitgliedEinladen(n.username)}>
                          Einladen
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {mitgliedError && (
                  <p className="auth-error" style={{ fontSize: 12, marginTop: 4 }}>{mitgliedError}</p>
                )}
              </div>
            )}
          </div>

          <hr className="sep" />

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="rowb">
              <span className="aufgaben-untertitel" style={{ margin: 0 }}>
                Unteraufgaben ({daten.unteraufgaben.length})
              </span>
              <button
                type="button"
                className="unteraufgabe-add"
                onClick={() => setUnterFormOffen((v) => !v)}
              >
                + Unteraufgabe
              </button>
            </div>

            {daten.unteraufgaben.length === 0 && !unterFormOffen ? (
              <p className="faint" style={{ fontSize: 12 }}>Keine Unteraufgaben.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {daten.unteraufgaben.map((u) => (
                  <div key={u.id} className="unteraufgabe-row">
                    <input
                      type="checkbox"
                      checked={u.erledigt}
                      onChange={(e) => handleUnteraufgabeToggle(u.id, e.target.checked)}
                      aria-label={`${u.titel} erledigt`}
                    />
                    <div
                      className="unteraufgabe-info"
                      style={u.erledigt ? { textDecoration: "line-through", color: "var(--faint)" } : undefined}
                    >
                      <span>{u.titel}</span>
                    </div>
                    {u.zugewiesenAn && (
                      <span className="muted" style={{ fontSize: 11 }}>
                        {daten.mitglieder.find((m) => m.user_id === u.zugewiesenAn)?.username ?? "?"}
                      </span>
                    )}
                    {u.faelligAm && (
                      <span className="muted" style={{ fontSize: 11 }}>{formatKurz(u.faelligAm)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {unterFormOffen && (
              <UnteraufgabenEditor
                mitglieder={daten.mitglieder}
                terminPflicht={daten.typ !== "todo"}
                onSpeichern={unteraufgabenSpeichern}
                onAbbrechen={() => setUnterFormOffen(false)}
              />
            )}
          </div>

          <hr className="sep" />

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="aufgaben-untertitel">Anhänge</span>
            <AnhangListe zielTyp={daten.typ} zielId={zielId} initial={daten.anhaenge} />
          </div>

          <div className="crud-form-actions">
            <button type="button" onClick={schliessen}>
              Schließen
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
