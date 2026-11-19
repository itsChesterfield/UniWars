"use client";

import { useEffect, useState, useTransition, type CSSProperties } from "react";
import posthog from "posthog-js";
import {
  createStundenplanEintrag,
  updateStundenplanEintrag,
  deleteStundenplanEintrag,
  type StundenplanInput,
} from "@/app/stundenplan/actions";
import { belegtZeitenLaden } from "@/app/kalender/actions";
import type { BelegtBlock } from "@/lib/kalender/google";
import type { Tables, Enums } from "@/lib/supabase/types";
import type { FachOption } from "@/lib/fach-option";
import { materialZiel } from "@/lib/dateiablage/material";
import { berlinDatum } from "@/lib/zeit";
import { mitschriftAnlegen } from "@/app/(hubs)/notizen/actions";
import { MaterialAmZiel } from "@/components/dateiablage/material-verknuepfungen";
import { MaterialDialog } from "@/components/dateiablage/material-dialog";
import { useRouter, useSearchParams } from "next/navigation";
import { StundenplanFotoDialog } from "@/components/stundenplan-foto-dialog";
import { spurenVerteilen } from "@/lib/spuren";
import { Zustand } from "@/components/zustand";
import { Icon } from "@/components/nav-icon";

type Eintrag = Tables<"stundenplan_eintrag">;
type Deadline = Tables<"deadline">;
type Pruefung = Tables<"pruefung">;

const TAGE: Enums<"wochentag">[] = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"];
const TAG_LABEL: Record<Enums<"wochentag">, string> = {
  MO: "Mo",
  DI: "Di",
  MI: "Mi",
  DO: "Do",
  FR: "Fr",
  SA: "Sa",
  SO: "So",
};
const TAG_LABEL_LANG: Record<Enums<"wochentag">, string> = {
  MO: "Montag",
  DI: "Dienstag",
  MI: "Mittwoch",
  DO: "Donnerstag",
  FR: "Freitag",
  SA: "Samstag",
  SO: "Sonntag",
};
const JS_TAG_ZU_WOCHENTAG: Record<number, Enums<"wochentag">> = {
  0: "SO",
  1: "MO",
  2: "DI",
  3: "MI",
  4: "DO",
  5: "FR",
  6: "SA",
};

const BASIS_STUNDE = 8;
const END_STUNDE = 18;
const PX_PRO_MINUTE = 0.6;
const RASTER_HOEHE = (END_STUNDE - BASIS_STUNDE) * 60 * PX_PRO_MINUTE;

function minutenSeitBasis(zeit: string): number {
  const [h, m] = zeit.split(":").map(Number);
  return (h - BASIS_STUNDE) * 60 + m;
}

function toTimeInput(zeit: string): string {
  return zeit.slice(0, 5);
}

function montagDieserWoche(datum: Date): Date {
  const wochentag = datum.getDay();
  const diffZuMontag = wochentag === 0 ? -6 : 1 - wochentag;
  const montag = new Date(datum);
  montag.setDate(datum.getDate() + diffZuMontag);
  montag.setHours(0, 0, 0, 0);
  return montag;
}

function uhrzeit(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function positionFuerZeitpunkt(dt: Date): number {
  const minuten = (dt.getHours() - BASIS_STUNDE) * 60 + dt.getMinutes();
  return Math.min(Math.max(minuten * PX_PRO_MINUTE, 0), RASTER_HOEHE - 18);
}

function leeresFormular(ersteFachId: string | null): StundenplanInput {
  return {
    fach_id: ersteFachId ?? "",
    tag: "MO",
    start_zeit: "09:00",
    end_zeit: "10:30",
    raum: null,
    dozent: null,
  };
}

export function StundenplanManager({
  initialEintraege,
  faecher,
  deadlines = [],
  pruefungen = [],
  kalenderVerbunden = false,
  embedded = false,
}: {
  initialEintraege: Eintrag[];
  faecher: FachOption[];
  deadlines?: Deadline[];
  pruefungen?: Pruefung[];
  kalenderVerbunden?: boolean;
  embedded?: boolean;
}) {
  const [eintraege, setEintraege] = useState(initialEintraege);
  const [formOpen, setFormOpen] = useState(false);
  const [fotoOffen, setFotoOffen] = useState(false);
  const router = useRouter();
  const parameter = useSearchParams();
  const direkteVorlesung = materialZiel({ art: "vorlesung", id: parameter.get("vorlesung"), datum: parameter.get("datum") });
  const [termin, setTermin] = useState<{ id: string; datum: string } | null>(null);
  const vorlesung = termin ?? (direkteVorlesung?.art === "vorlesung" ? direkteVorlesung : null);
  const ausgewaehlterTermin = vorlesung ? eintraege.find((e) => e.id === vorlesung.id) : undefined;
  const [mitschriftFehler, setMitschriftFehler] = useState("");
  const [mitschriftWartet, mitschriftStarten] = useTransition();
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<StundenplanInput>(leeresFormular(faecher[0]?.id ?? null));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [wochenOffset, setWochenOffset] = useState(0);
  const [belegt, setBelegt] = useState<{ woche: number; bloecke: BelegtBlock[] }>({ woche: NaN, bloecke: [] });

  useEffect(() => {
    if (!kalenderVerbunden) return;
    let abgebrochen = false;
    const von = montagDieserWoche(new Date());
    von.setDate(von.getDate() + wochenOffset * 7);
    const bis = new Date(von);
    bis.setDate(von.getDate() + 7);
    belegtZeitenLaden(von.toISOString(), bis.toISOString())
      .then((antwort) => {
        if (!abgebrochen) setBelegt({ woche: wochenOffset, bloecke: antwort.bloecke });
      })
      .catch(() => undefined);
    return () => {
      abgebrochen = true;
    };
  }, [kalenderVerbunden, wochenOffset]);

  const belegtDieseWoche = kalenderVerbunden && belegt.woche === wochenOffset ? belegt.bloecke : [];

  /** Einträge eines Tages; überlappende stehen nebeneinander */
  function blockeFuerTag(tag: Enums<"wochentag">) {
    const amTag = eintraege
      .filter((e) => e.tag === tag)
      .map((e) => ({ e, start: minutenSeitBasis(e.start_zeit), ende: minutenSeitBasis(e.end_zeit) }));
    const spuren = spurenVerteilen(amTag);
    return amTag.map((x) => ({ ...x, ...spuren.get(x)! }));
  }

  function belegtFuerTag(tagIndex: number) {
    const tagStart = new Date(montag);
    tagStart.setDate(montag.getDate() + tagIndex);
    tagStart.setHours(BASIS_STUNDE, 0, 0, 0);
    const tagEnde = new Date(tagStart);
    tagEnde.setHours(END_STUNDE, 0, 0, 0);
    return belegtDieseWoche.flatMap((b, i) => {
      const start = Math.max(new Date(b.start).getTime(), tagStart.getTime());
      const ende = Math.min(new Date(b.end).getTime(), tagEnde.getTime());
      if (ende <= start) return [];
      return [
        {
          key: `${tagIndex}-${i}`,
          top: ((start - tagStart.getTime()) / 60_000) * PX_PRO_MINUTE,
          hoehe: Math.max(((ende - start) / 60_000) * PX_PRO_MINUTE, 8),
        },
      ];
    });
  }

  function openCreateForm() {
    if (faecher.length === 0) {
      setError("Bitte zuerst ein Fach anlegen.");
      return;
    }
    setEditId(null);
    setForm(leeresFormular(faecher[0].id));
    setError(null);
    setFormOpen(true);
  }

  function openEditForm(e: Eintrag) {
    setEditId(e.id);
    setForm({
      fach_id: e.fach_id,
      tag: e.tag,
      start_zeit: toTimeInput(e.start_zeit),
      end_zeit: toTimeInput(e.end_zeit),
      raum: e.raum,
      dozent: e.dozent,
    });
    setError(null);
    setFormOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        if (editId) {
          const updated = await updateStundenplanEintrag(editId, form);
          setEintraege((prev) => prev.map((x) => (x.id === editId ? updated : x)));
          posthog.capture("stundenplan_eintrag_bearbeitet", { eintrag_id: editId });
        } else {
          const created = await createStundenplanEintrag(form);
          setEintraege((prev) => [...prev, created]);
          posthog.capture("stundenplan_eintrag_angelegt", { eintrag_id: created.id });
        }
        setFormOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteStundenplanEintrag(id);
        setEintraege((prev) => prev.filter((x) => x.id !== id));
        posthog.capture("stundenplan_eintrag_geloescht", { eintrag_id: id });
        setFormOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  const stunden = Array.from({ length: END_STUNDE - BASIS_STUNDE + 1 }, (_, i) => BASIS_STUNDE + i);

  const montag = montagDieserWoche(new Date());
  montag.setDate(montag.getDate() + wochenOffset * 7);
  const sonntag = new Date(montag);
  sonntag.setDate(montag.getDate() + 6);
  sonntag.setHours(23, 59, 59, 999);
  const wochenLabel = `${montag.toLocaleDateString("de-DE", { day: "2-digit", month: "short" })} – ${sonntag.toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}`;
  const deadlinesDieseWoche = deadlines.filter((d) => {
    const dt = new Date(d.faellig_am);
    return dt >= montag && dt <= sonntag;
  });
  const pruefungenDieseWoche = pruefungen.filter((p) => {
    const dt = new Date(p.datum);
    return dt >= montag && dt <= sonntag;
  });

  const heuteIndex = wochenOffset === 0 ? (new Date().getDay() + 6) % 7 : -1;

  const inhalt = (
    <>
      <div className="stundenplan-leiste">
        <div className="stundenplan-woche" role="group" aria-label="Woche wählen">
          <button
            type="button"
            className="knopf leise klein nur-symbol"
            onClick={() => setWochenOffset((o) => o - 1)}
            aria-label="Vorherige Woche"
          >
            <Icon name="pfeil-links" groesse={16} />
          </button>
          <span className="stundenplan-woche-text" aria-live="polite">
            {wochenLabel}
          </span>
          <button
            type="button"
            className="knopf leise klein nur-symbol"
            onClick={() => setWochenOffset((o) => o + 1)}
            aria-label="Nächste Woche"
          >
            <Icon name="pfeil-rechts" groesse={16} />
          </button>
          {wochenOffset !== 0 && (
            <button type="button" className="knopf leise klein" onClick={() => setWochenOffset(0)}>
              Diese Woche
            </button>
          )}
        </div>
        <div className="stundenplan-aktionen">
          <button
            type="button"
            onClick={() => setFotoOffen(true)}
            className="knopf leise klein"
            title="Stundenplan per Foto oder Screenshot eintragen lassen"
          >
            <Icon name="kamera" groesse={16} />
            Aus Foto
          </button>
          <button type="button" onClick={openCreateForm} className="knopf neben klein">
            <Icon name="plus" groesse={16} />
            Eintrag
          </button>
        </div>
      </div>

      {fotoOffen && (
        <StundenplanFotoDialog
          faecher={faecher}
          vorhandene={eintraege.length}
          onSchliessen={() => setFotoOffen(false)}
          onUebernommen={(neu, ersetzt) => {
            setFotoOffen(false);
            setEintraege((l) => (ersetzt ? neu : [...l, ...neu]));
            // neue Fächer und Termine auch im Rest der Seite zeigen
            router.refresh();
          }}
        />
      )}

      {error && !formOpen && (
        <p className="formular-fehler" role="alert">
          {error}
        </p>
      )}

      {eintraege.length === 0 && !formOpen && (
        <Zustand
          art="leer"
          region
          ebene={3}
          titel="Noch kein Stundenplan."
          aktion={
            <button type="button" className="knopf neben klein" onClick={() => setFotoOffen(true)}>
              <Icon name="kamera" groesse={16} />
              Aus Foto eintragen
            </button>
          }
        >
          Trag deine Veranstaltungen ein oder lass sie aus einem Foto deines Stundenplans erkennen. Fristen und Prüfungen der Woche stehen dann mit im Raster.
        </Zustand>
      )}

      {eintraege.length > 0 && (
        // Der Raster scrollt am Handy waagerecht: per Tastatur erreichbar und beschriftet (WCAG 2.1.1)
        <div
          className="stundenplan-grid"
          style={{ "--raster-hoehe": `${RASTER_HOEHE}px`, "--stunde": `${60 * PX_PRO_MINUTE}px` } as CSSProperties}
          tabIndex={0}
          role="region"
          aria-label={`Stundenplan, Woche ${wochenLabel}`}
        >
          <div className="stundenplan-stunden" aria-hidden>
            {stunden.map((h) => (
              <div key={h} className="stundenplan-stunde">
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {TAGE.map((tag, tagIndex) => (
            <div key={tag} className={`stundenplan-tag-spalte${tagIndex === heuteIndex ? " heute" : ""}`}>
              <div className="stundenplan-tag-label">{TAG_LABEL[tag]}</div>
              <div className="stundenplan-tag-body">
                {belegtFuerTag(tagIndex).map((b) => (
                  <div
                    key={b.key}
                    className="stundenplan-belegt"
                    style={{ top: b.top, height: b.hoehe }}
                    title="Belegt (Google Kalender)"
                  >
                    Belegt
                  </div>
                ))}
                {blockeFuerTag(tag).map(({ e, start, ende, spur, spuren }) => {
                  const fach = faecher.find((f) => f.id === e.fach_id);
                  const zeit = `${toTimeInput(e.start_zeit)}–${toTimeInput(e.end_zeit)}`;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      className="stundenplan-block"
                      style={
                        {
                          top: start * PX_PRO_MINUTE,
                          height: Math.max((ende - start) * PX_PRO_MINUTE, 20),
                          left: `calc(${(spur / spuren) * 100}% + 1px)`,
                          width: `calc(${100 / spuren}% - 2px)`,
                          "--c": fach?.farbe ?? "var(--text-3)",
                        } as CSSProperties
                      }
                      onClick={() => {
                        const datum = new Date(montag);
                        datum.setDate(datum.getDate() + tagIndex);
                        datum.setHours(12);
                        setTermin({ id: e.id, datum: berlinDatum(datum) });
                        setMitschriftFehler("");
                      }}
                      title={`${fach?.name ?? "Eintrag"}, ${zeit}${e.raum ? `, ${e.raum}` : ""}`}
                    >
                      <span className="stundenplan-block-fach">{fach?.name ?? "Eintrag"}</span>
                      <span className="stundenplan-block-zeit">
                        <span className="vh">{TAG_LABEL_LANG[tag]}, </span>
                        {zeit}
                        {e.raum && <span className="vh">, {e.raum}</span>}
                      </span>
                    </button>
                  );
                })}

                {deadlinesDieseWoche
                  .filter((d) => JS_TAG_ZU_WOCHENTAG[new Date(d.faellig_am).getDay()] === tag)
                  .map((d) => (
                    <div
                      key={d.id}
                      className="kalender-marker kalender-marker-deadline"
                      style={{ top: positionFuerZeitpunkt(new Date(d.faellig_am)) }}
                      title={`${uhrzeit(d.faellig_am)} · ${d.titel}`}
                    >
                      <span className="vh">Frist: </span>
                      {uhrzeit(d.faellig_am)} {d.titel}
                    </div>
                  ))}

                {pruefungenDieseWoche
                  .filter((p) => JS_TAG_ZU_WOCHENTAG[new Date(p.datum).getDay()] === tag)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="kalender-marker kalender-marker-pruefung"
                      style={{ top: positionFuerZeitpunkt(new Date(p.datum)) }}
                      title={`${uhrzeit(p.datum)} · ${p.titel}`}
                    >
                      <span className="vh">Prüfung: </span>
                      {uhrzeit(p.datum)} {p.titel}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {vorlesung && ausgewaehlterTermin && (
        <MaterialDialog titel={faecher.find((f) => f.id === ausgewaehlterTermin.fach_id)?.name ?? "Vorlesung"}
          schliessen={() => {
            setTermin(null);
            if (direkteVorlesung) {
              const params = new URLSearchParams(parameter);
              params.delete("vorlesung"); params.delete("datum");
              router.replace(params.size ? `/termine?${params}` : "/termine", { scroll: false });
            }
          }}>
          <p><time dateTime={vorlesung.datum}>{new Date(`${vorlesung.datum}T12:00:00Z`).toLocaleDateString("de-DE")}</time>
            {ausgewaehlterTermin.raum ? ` · ${ausgewaehlterTermin.raum}` : ""}</p>
          <MaterialAmZiel key={`${vorlesung.id}:${vorlesung.datum}`} ziel={{ art: "vorlesung", id: vorlesung.id, datum: vorlesung.datum }} />
          {mitschriftFehler && <p role="alert">{mitschriftFehler}</p>}
          <div className="dat-auswahl-form">
            <button type="button" className="knopf neben klein" disabled={mitschriftWartet} onClick={() => mitschriftStarten(async () => {
              try {
                const notiz = await mitschriftAnlegen(vorlesung.id, vorlesung.datum);
                router.push(`/notizen?id=${notiz.id}`);
              } catch { setMitschriftFehler("Die Mitschrift konnte nicht geöffnet werden."); }
            })}>Mitschrift öffnen</button>
            <button type="button" className="knopf leise klein" onClick={() => { setTermin(null); openEditForm(ausgewaehlterTermin); }}>Termin bearbeiten</button>
          </div>
        </MaterialDialog>
      )}
      {formOpen && (
        <form className="crud-form" onSubmit={handleSubmit}>
          <h3>{editId ? "Eintrag bearbeiten" : "Neuer Eintrag"}</h3>
          {error && (
            <p className="formular-fehler" role="alert">
              {error}
            </p>
          )}

          <label htmlFor="sp-fach">Fach</label>
          <select
            id="sp-fach"
            value={form.fach_id}
            onChange={(e) => setForm((f) => ({ ...f, fach_id: e.target.value }))}
            required
          >
            {faecher.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          <div className="crud-form-reihe">
            <div>
              <label htmlFor="sp-tag">Wochentag</label>
              <select
                id="sp-tag"
                value={form.tag}
                onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value as Enums<"wochentag"> }))}
              >
                {TAGE.map((tag) => (
                  <option key={tag} value={tag}>
                    {TAG_LABEL_LANG[tag]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sp-start">Beginn</label>
              <input
                id="sp-start"
                type="time"
                value={form.start_zeit}
                onChange={(e) => setForm((f) => ({ ...f, start_zeit: e.target.value }))}
                required
              />
            </div>
            <div>
              <label htmlFor="sp-ende">Ende</label>
              <input
                id="sp-ende"
                type="time"
                value={form.end_zeit}
                onChange={(e) => setForm((f) => ({ ...f, end_zeit: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="crud-form-reihe">
            <div>
              <label htmlFor="sp-raum">Raum</label>
              <input
                id="sp-raum"
                value={form.raum ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, raum: e.target.value || null }))}
              />
            </div>
            <div>
              <label htmlFor="sp-dozent">Lehrperson</label>
              <input
                id="sp-dozent"
                value={form.dozent ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, dozent: e.target.value || null }))}
              />
            </div>
          </div>

          <div className="crud-form-actions">
            <button type="submit" className="knopf haupt" disabled={isPending} aria-busy={isPending}>
              {isPending ? "Speichern…" : "Speichern"}
            </button>
            <button type="button" className="knopf leise" onClick={() => setFormOpen(false)} disabled={isPending}>
              Abbrechen
            </button>
            {editId && (
              <button
                type="button"
                className="knopf gefahr rechts"
                onClick={() => handleDelete(editId)}
                disabled={isPending}
              >
                Löschen
              </button>
            )}
          </div>
        </form>
      )}
    </>
  );

  if (embedded) return inhalt;

  return (
    <section aria-labelledby="abschnitt-stundenplan">
      <h2 id="abschnitt-stundenplan" className="abschnitt-titel">
        Stundenplan
      </h2>
      {inhalt}
    </section>
  );
}
