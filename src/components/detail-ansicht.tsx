"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  detailLaden,
  type DetailDaten,
  type DetailZielTyp,
} from "@/app/aufgaben-detail/actions";
import { toggleTodoErledigt } from "@/app/todo/actions";
import { toggleDeadlineErledigt } from "@/app/deadline/actions";
import { AnhangListe } from "@/components/anhang-liste";
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

  function handleUnteraufgabeToggle(id: string, erledigt: boolean) {
    if (!daten) return;
    setDaten({
      ...daten,
      unteraufgaben: daten.unteraufgaben.map((u) => (u.id === id ? { ...u, erledigt } : u)),
    });
    const toggeln = daten.typ === "todo" ? toggleTodoErledigt : toggleDeadlineErledigt;
    toggeln(id, erledigt).then(() => router.refresh());
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
            <span className="aufgaben-untertitel">Mitglieder</span>
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
          </div>

          <hr className="sep" />

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="aufgaben-untertitel">Unteraufgaben ({daten.unteraufgaben.length})</span>
            {daten.unteraufgaben.length === 0 ? (
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
                    {u.faelligAm && (
                      <span className="muted" style={{ fontSize: 11 }}>{formatKurz(u.faelligAm)}</span>
                    )}
                  </div>
                ))}
              </div>
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
