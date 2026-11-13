"use client";

import { useState, useTransition } from "react";
import { createAnhang, dateiAnhaengen, dateienZumAnhaengen, deleteAnhang, type AnhangZielTyp } from "@/app/anhang/actions";
import type { Tables } from "@/lib/supabase/types";
import { track } from "@/lib/analytics";

type Anhang = Tables<"anhang">;

export function AnhangListe({
  zielTyp,
  zielId,
  initial,
}: {
  zielTyp: AnhangZielTyp;
  zielId: string;
  initial: Anhang[];
}) {
  const [anhaenge, setAnhaenge] = useState(initial);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dateien, setDateien] = useState<{ id: string; name: string }[] | null>(null);

  function dateiAuswahlOeffnen() {
    setError(null);
    dateienZumAnhaengen()
      .then(setDateien)
      .catch(() => setDateien([]));
  }

  function dateiWaehlen(dateiId: string) {
    if (!dateiId) return;
    setDateien(null);
    startTransition(async () => {
      try {
        const created = await dateiAnhaengen(zielTyp, zielId, dateiId);
        setAnhaenge((prev) => [...prev, created]);
        track("anhang_hinzugefuegt", { ziel_typ: zielTyp, ort: "detail", art: "datei" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const created = await createAnhang(zielTyp, zielId, url);
        setAnhaenge((prev) => [...prev, created]);
        track("anhang_hinzugefuegt", { ziel_typ: zielTyp, ort: "detail" });
        setUrl("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  function handleDelete(id: string) {
    setAnhaenge((prev) => prev.filter((a) => a.id !== id));
    startTransition(() => deleteAnhang(id));
    track("anhang_geloescht", { ziel_typ: zielTyp });
  }

  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {anhaenge.map((a) => (
        <a
          key={a.id}
          href={a.url}
          target={a.datei_id ? undefined : "_blank"}
          rel={a.datei_id ? undefined : "noopener noreferrer"}
          className="tag"
          onClick={() => track("anhang_geoeffnet", { ziel_typ: zielTyp })}
        >
          {a.datei_id ? "📎 " : ""}
          {a.titel}
          <button
            type="button"
            aria-label={`Anhang ${a.titel} entfernen`}
            onClick={(e) => {
              e.preventDefault();
              handleDelete(a.id);
            }}
            style={{ marginLeft: 6, border: "none", background: "none", color: "inherit", cursor: "pointer" }}
          >
            ✕
          </button>
        </a>
      ))}

      <form onSubmit={handleSubmit} className="row" style={{ gap: 6 }}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link hinzufügen…"
          style={{ fontSize: 12 }}
        />
        <button type="submit" className="unteraufgabe-add" disabled={isPending || url.trim() === ""}>
          + Link
        </button>
      </form>

      {dateien === null ? (
        <button type="button" className="unteraufgabe-add" onClick={dateiAuswahlOeffnen} disabled={isPending}>
          📎 Datei aus Ablage
        </button>
      ) : dateien.length === 0 ? (
        <span className="muted" style={{ fontSize: 12 }}>
          Noch keine Dateien in der <a href="/dateiablage">Dateiablage</a>.{" "}
          <button type="button" className="unteraufgabe-add" onClick={() => setDateien(null)}>
            OK
          </button>
        </span>
      ) : (
        <select
          className="field"
          style={{ width: "auto", fontSize: 12, padding: "5px 8px" }}
          autoFocus
          defaultValue=""
          aria-label="Datei aus der Dateiablage anhängen"
          onChange={(e) => dateiWaehlen(e.target.value)}
          onBlur={() => setDateien(null)}
        >
          <option value="" disabled>
            Datei wählen …
          </option>
          {dateien.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      )}

      {error && <p className="auth-error" style={{ fontSize: 12, width: "100%" }}>{error}</p>}
    </div>
  );
}
