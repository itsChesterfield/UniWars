"use client";

import { useState, useTransition } from "react";
import { createAnhang, dateiAnhaengen, dateienZumAnhaengen, deleteAnhang, type AnhangZielTyp } from "@/app/anhang/actions";
import type { Tables } from "@/lib/supabase/types";
import { track } from "@/lib/analytics";
import Link from "next/link";
import { Icon } from "@/components/nav-icon";

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

  // Design B3: Anhänge als getönte Pillen; Link und Entfernen sind getrennte Ziele (keine Schaltfläche im Link)
  return (
    <div className="anhang-liste">
      {anhaenge.map((a) => (
        <span key={a.id} className="anhang">
          <Icon name={a.datei_id ? "anhang" : "link"} groesse={14} />
          <a
            href={a.url}
            target={a.datei_id ? undefined : "_blank"}
            rel={a.datei_id ? undefined : "noopener noreferrer"}
            onClick={() => track("anhang_geoeffnet", { ziel_typ: zielTyp })}
          >
            {a.titel}
          </a>
          <button type="button" className="anhang-weg" aria-label={`Anhang ${a.titel} entfernen`} onClick={() => handleDelete(a.id)}>
            <Icon name="schliessen" groesse={14} />
          </button>
        </span>
      ))}

      <form onSubmit={handleSubmit} className="anhang-form">
        <input
          type="text"
          inputMode="url"
          className="anhang-feld"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link einfügen"
          aria-label="Link als Anhang hinzufügen"
        />
        <button type="submit" className="knopf leise klein" disabled={isPending || url.trim() === ""}>
          <Icon name="plus" groesse={16} />
          Link
        </button>
      </form>

      {dateien === null ? (
        <button type="button" className="knopf leise klein" onClick={dateiAuswahlOeffnen} disabled={isPending}>
          <Icon name="anhang" groesse={16} />
          Datei aus der Ablage
        </button>
      ) : dateien.length === 0 ? (
        <span className="anhang-hinweis">
          Noch keine Dateien in der <Link href="/dateiablage">Dateiablage</Link>.
          <button type="button" className="knopf leise klein" onClick={() => setDateien(null)}>
            OK
          </button>
        </span>
      ) : (
        <select
          className="anhang-feld"
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

      {error && (
        <p className="formular-fehler anhang-fehler" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
