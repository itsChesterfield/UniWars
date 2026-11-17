"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { toggleDeadlineErledigt } from "@/app/deadline/actions";
import { toggleTodoErledigt } from "@/app/todo/actions";
import { TagesBriefing } from "@/components/ki/tages-briefing";
import { SCHNELL_ERFASSEN } from "@/components/quick-add";
import { track } from "@/lib/analytics";
import { restzeitGross } from "@/lib/countdown";
import type { BausteinId } from "@/lib/hub-layout";
import { faelligText, minutenText, restUhr, wochenTage } from "@/lib/hub-texte";
import type { Tables } from "@/lib/supabase/types";
import { useAufgabenDetail } from "@/lib/use-aufgaben-detail";
import { berlinDatum, berlinUhrzeit, berlinWochentag } from "@/lib/zeit";

export type FaelligeKarten = { anzahl: number; stapel: { id: string; name: string; anzahl: number }[] };

export type HubDaten = {
  name: string;
  faecher: Tables<"fach">[];
  deadlines: Tables<"deadline">[];
  todos: Tables<"todo">[];
  pruefungen: Tables<"pruefung">[];
  stundenplan: Tables<"stundenplan_eintrag">[];
  lernSessions: Tables<"lern_session">[];
  streak: number;
  karten: FaelligeKarten;
  /** Zeitpunkt der Anfrage auf dem Server (ISO): Mit ihm zeichnen Server und Browser den ersten Stand gleich */
  serverJetzt: string;
};

/**
 * Die Uhr startet mit der Zeit des Servers, damit „morgen um 23:00“ und der Countdown schon im
 * Server-HTML stehen und beim Laden nichts nachrutscht. Im Browser läuft sie danach mit der echten Zeit weiter.
 */
function useJetzt(taktMs: number, start: string): Date {
  const [jetzt, setJetzt] = useState<Date>(() => new Date(start));
  useEffect(() => {
    const setzen = () => setJetzt(new Date());
    setzen();
    const id = window.setInterval(setzen, taktMs);
    return () => window.clearInterval(id);
  }, [taktMs]);
  return jetzt;
}

const FARBE_OHNE_FACH = "var(--text-3)";

function Symbol({ d, groesse = 16 }: { d: string; groesse?: number }) {
  return (
    <svg width={groesse} height={groesse} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.split("|").map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

const S = {
  fokus: "M12 6a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z|M12 13V9.5|M9.5 3h5",
  pfeil: "M5 12h14|m13 6 6 6-6 6",
  plus: "M12 5v14|M5 12h14",
  haken: "m5 12.5 4.5 4.5L19 7.5",
};

/* ---------- Als Nächstes ---------- */

type Kandidat = { art: "deadline" | "pruefung"; id: string; titel: string; wann: string; fachId: string | null };

function naechsterKandidat(d: HubDaten): Kandidat | null {
  const liste: Kandidat[] = [
    ...d.deadlines.filter((x) => !x.erledigt).map((x) => ({ art: "deadline" as const, id: x.id, titel: x.titel, wann: x.faellig_am, fachId: x.fach_id })),
    ...d.pruefungen.filter((x) => x.status === "ANSTEHEND").map((x) => ({ art: "pruefung" as const, id: x.id, titel: x.titel, wann: x.datum, fachId: x.fach_id })),
  ].sort((a, b) => new Date(a.wann).getTime() - new Date(b.wann).getTime());
  return liste[0] ?? null;
}

function Naechstes({ d }: { d: HubDaten }) {
  const jetzt = useJetzt(1000, d.serverJetzt);
  const { oeffne } = useAufgabenDetail();
  const k = naechsterKandidat(d);

  if (!k) {
    return (
      <section className="kopf" aria-labelledby="hub-h">
        <div className="kopf-text">
          <h2 id="hub-h">Gerade steht nichts an.</h2>
          <p className="unter">Keine offenen Fristen und keine anstehenden Prüfungen.</p>
          <div className="aktionen">
            <button type="button" className="knopf haupt" onClick={() => window.dispatchEvent(new CustomEvent(SCHNELL_ERFASSEN))}>
              <Symbol d={S.plus} />
              Etwas erfassen
            </button>
            <Link href="/work-station" className="knopf neben">
              <Symbol d={S.fokus} />
              Fokus starten
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const fach = d.faecher.find((f) => f.id === k.fachId);
  const restMs = jetzt ? new Date(k.wann).getTime() - jetzt.getTime() : null;
  const gross = restMs !== null && restMs >= 86_400_000 ? restzeitGross(k.wann) : null;

  return (
    <section className="kopf" aria-labelledby="hub-h">
      <span className="bahn" aria-hidden />
      <span className="planet" aria-hidden />
      <div className="kopf-text">
        <h2 id="hub-h">{k.titel}</h2>
        <p className="unter">
          <i aria-hidden style={{ background: fach?.farbe ?? FARBE_OHNE_FACH }} />
          {fach ? `${fach.name}, ` : ""}
          {jetzt ? faelligText(k.wann, jetzt) : k.art === "pruefung" ? "Prüfung" : "fällig"}
          {jetzt ? "." : ""}
        </p>
        <div className="aktionen">
          <Link href="/work-station" className="knopf haupt" onClick={() => track("hub_fokus_starten")}>
            <Symbol d={S.fokus} />
            Fokus starten
          </Link>
          <button type="button" className="knopf neben" onClick={() => oeffne(k.art, k.id)}>
            Details öffnen
          </button>
        </div>
      </div>
      {restMs !== null && (
        <div className="rest">
          {restMs < 0 ? (
            <>
              <div className="zahl rest-ueber">überfällig</div>
              <p>seit {berlinUhrzeit(new Date(k.wann))} Uhr</p>
            </>
          ) : (
            <>
              <div className="zahl" role="timer" aria-live="off">
                {gross ? `${gross.wert} ${gross.einheit}` : restUhr(restMs)}
              </div>
              <p>{k.art === "pruefung" ? "bis zur Prüfung" : "bis zur Abgabe"}</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------- Überblick ---------- */

function Fakten({ d }: { d: HubDaten }) {
  const jetzt = useJetzt(60_000, d.serverJetzt);
  const heute = berlinDatum(jetzt ?? new Date());
  const tag = berlinWochentag(jetzt ?? new Date());
  const stunden = d.stundenplan.filter((e) => e.tag === tag).map((e) => e.start_zeit.slice(0, 5));
  const fristen = d.deadlines.filter((x) => !x.erledigt && berlinDatum(new Date(x.faellig_am)) === heute).map((x) => berlinUhrzeit(new Date(x.faellig_am)));
  const zeiten = [...stunden, ...fristen].sort();
  const naechste = jetzt ? zeiten.find((z) => z >= berlinUhrzeit(jetzt)) : undefined;
  const minuten = d.lernSessions.filter((s) => berlinDatum(new Date(s.start)) === heute).reduce((a, s) => a + s.dauer_minuten, 0);
  const top = d.karten.stapel[0];

  return (
    <section className="fakten" aria-label="Überblick">
      <Link href="/karteikarten" className="fakt" style={{ "--c": "var(--f3)" } as React.CSSProperties}>
        <div className="zahl">{d.karten.anzahl}</div>
        {d.karten.anzahl > 0 ? (
          <p>
            <b>{d.karten.anzahl === 1 ? "Karteikarte" : "Karteikarten"}</b> heute fällig{top ? (
              <>
                , die meisten in <b>{top.name}</b>
              </>
            ) : null}
            .
          </p>
        ) : (
          <p>
            <b>Karteikarten</b> fällig. Für heute ist alles wiederholt.
          </p>
        )}
      </Link>
      <Link href="/termine" className="fakt" style={{ "--c": "var(--f4)" } as React.CSSProperties}>
        <div className="zahl">{zeiten.length}</div>
        <p>
          <b>{zeiten.length === 1 ? "Termin" : "Termine"}</b> heute
          {naechste ? (
            <>
              , der nächste um <b>{naechste}</b>
            </>
          ) : zeiten.length > 0 && jetzt ? (
            ", alle schon vorbei"
          ) : null}
          .
        </p>
      </Link>
      <Link href="/fortschritt" className="fakt" style={{ "--c": "var(--akzent)" } as React.CSSProperties}>
        <div className="zahl">{d.streak}</div>
        <p>
          <b>{d.streak === 1 ? "Tag" : "Tage"} in Folge</b> gelernt
          {minuten > 0 ? (
            <>
              , heute schon <b>{minutenText(minuten)}</b>
            </>
          ) : (
            ", heute noch nicht"
          )}
          .
        </p>
      </Link>
    </section>
  );
}

/* ---------- Heute ---------- */

type PlanZeile = {
  key: string;
  von: string | null;
  bis: string | null;
  farbe: string;
  titel: string;
  meta: string;
  ziel: { art: "deadline" | "todo"; id: string } | null;
  haken: null | (() => void);
  erledigt: boolean;
};

const MAX_TODOS = 5;

function Heute({ d }: { d: HubDaten }) {
  const jetzt = useJetzt(60_000, d.serverJetzt);
  const { oeffne } = useAufgabenDetail();
  const [, start] = useTransition();
  const [erledigt, setErledigt] = useState<Set<string>>(() => new Set(d.deadlines.filter((x) => x.erledigt).map((x) => x.id)));
  const heute = berlinDatum(jetzt ?? new Date());
  const tag = berlinWochentag(jetzt ?? new Date());
  const uhr = jetzt ? berlinUhrzeit(jetzt) : null;
  const fach = (id: string | null) => d.faecher.find((f) => f.id === id);

  const umschalten = (art: "deadline" | "todo", id: string) => {
    const neu = !erledigt.has(id);
    setErledigt((alt) => {
      const s = new Set(alt);
      if (neu) s.add(id);
      else s.delete(id);
      return s;
    });
    start(async () => {
      if (art === "deadline") await toggleDeadlineErledigt(id, neu);
      else await toggleTodoErledigt(id, neu);
      track(art === "deadline" ? "deadline_erledigt" : "todo_erledigt", { quelle: "hub" });
    });
  };

  const stunden: PlanZeile[] = d.stundenplan
    .filter((e) => e.tag === tag)
    .map((e) => ({
      key: `s-${e.id}`,
      von: e.start_zeit.slice(0, 5),
      bis: e.end_zeit.slice(0, 5),
      farbe: fach(e.fach_id)?.farbe ?? FARBE_OHNE_FACH,
      titel: fach(e.fach_id)?.name ?? "Veranstaltung",
      meta: [e.raum, e.dozent].filter(Boolean).join(", "),
      ziel: null,
      haken: null,
      erledigt: false,
    }));
  const fristen: PlanZeile[] = d.deadlines
    .filter((x) => berlinDatum(new Date(x.faellig_am)) === heute)
    .map((x) => ({
      key: `d-${x.id}`,
      von: berlinUhrzeit(new Date(x.faellig_am)),
      bis: null,
      farbe: fach(x.fach_id)?.farbe ?? FARBE_OHNE_FACH,
      titel: x.titel,
      meta: ["Frist", fach(x.fach_id)?.name].filter(Boolean).join(", "),
      ziel: { art: "deadline" as const, id: x.id },
      haken: () => umschalten("deadline", x.id),
      erledigt: erledigt.has(x.id),
    }));
  const offen = d.todos.filter((t) => !t.erledigt && !t.parent_id);
  const todos: PlanZeile[] = offen.slice(0, MAX_TODOS).map((t) => ({
    key: `t-${t.id}`,
    von: null,
    bis: null,
    farbe: fach(t.fach_id)?.farbe ?? FARBE_OHNE_FACH,
    titel: t.titel,
    meta: ["To-do", fach(t.fach_id)?.name].filter(Boolean).join(", "),
    ziel: { art: "todo" as const, id: t.id },
    haken: () => umschalten("todo", t.id),
    erledigt: erledigt.has(t.id),
  }));
  const mitZeit = [...stunden, ...fristen].sort((a, b) => (a.von ?? "").localeCompare(b.von ?? ""));
  const zeilen = [...mitZeit, ...todos];
  const jetztKey = uhr ? mitZeit.find((z) => (z.bis ?? z.von ?? "") >= uhr && !z.erledigt)?.key : undefined;

  return (
    <section className="heute" aria-labelledby="hub-heute">
      <div className="kopfzeile">
        <h2 id="hub-heute">Heute</h2>
        <span className="info">{jetzt ? new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }).format(jetzt) : ""}</span>
        <Link href="/termine" className="link rechts">
          Alle Termine
        </Link>
      </div>
      {zeilen.length === 0 ? (
        <p className="vleer">
          Heute steht nichts im Plan. <Link href="/termine" className="link">Stundenplan eintragen</Link>
        </p>
      ) : (
        <ul className="plan">
          {zeilen.map((z) => {
            const vorbei = z.erledigt || Boolean(uhr && z.von && (z.bis ?? z.von) < uhr && !z.haken);
            const laeuft = z.key === jetztKey;
            return (
              <li key={z.key} className={vorbei ? "vorbei" : laeuft ? "jetzt" : undefined}>
                {laeuft && <span className="jetztlinie" aria-hidden />}
                <span className="zeit">
                  {z.von ?? "offen"}
                  {z.bis && <small>{z.bis}</small>}
                </span>
                <span className="balken" style={{ "--c": z.farbe } as React.CSSProperties} />
                <div>
                  {z.ziel ? (
                    <button type="button" className="plan-titel" onClick={() => z.ziel && oeffne(z.ziel.art, z.ziel.id)}>
                      {z.titel}
                    </button>
                  ) : (
                    <strong>{z.titel}</strong>
                  )}
                  {z.meta && <span className="meta">{z.meta}</span>}
                </div>
                {z.haken ? (
                  <button type="button" className="haken" aria-pressed={z.erledigt} aria-label={`${z.titel} erledigt`} onClick={z.haken}>
                    <Symbol d={S.haken} groesse={14} />
                  </button>
                ) : (
                  <span className="stand">{vorbei ? "vorbei" : laeuft ? (z.von && uhr && z.von <= uhr ? "läuft" : "als Nächstes") : "geplant"}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {offen.length > MAX_TODOS && (
        <div className="vfuss">
          <Link href="/aufgaben" className="link">
            {offen.length - MAX_TODOS} weitere To-dos
          </Link>
        </div>
      )}
    </section>
  );
}

/* ---------- Diese Woche ---------- */

const TAGE = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"] as const;
const TAG_KURZ: Record<(typeof TAGE)[number], string> = { MO: "Mo", DI: "Di", MI: "Mi", DO: "Do", FR: "Fr", SA: "Sa", SO: "So" };

function Woche({ d }: { d: HubDaten }) {
  const jetzt = useJetzt(600_000, d.serverJetzt);
  const heute = jetzt ? berlinWochentag(jetzt) : null;
  const daten = jetzt ? wochenTage(jetzt) : null;
  const tage = TAGE.filter((t, i) => i < 5 || d.stundenplan.some((e) => e.tag === t));
  const zeiten = [...new Set(d.stundenplan.map((e) => e.start_zeit.slice(0, 5)))].sort();
  const fach = (id: string) => d.faecher.find((f) => f.id === id);

  return (
    <section className="woche-ab" aria-labelledby="hub-woche">
      <div className="kopfzeile">
        <h2 id="hub-woche">Diese Woche</h2>
        <Link href="/termine" className="link rechts">
          Stundenplan
        </Link>
      </div>
      {zeiten.length === 0 ? (
        <p className="vleer">
          Noch kein Stundenplan. <Link href="/termine" className="link">Stundenplan eintragen</Link>
        </p>
      ) : (
        <div className="raster-rahmen">
          <table className="plan-raster">
            <caption className="vh">Stundenplan dieser Woche</caption>
            <thead>
              <tr>
                <td />
                {tage.map((t) => (
                  <th key={t} scope="col" className={t === heute ? "ist-heute" : undefined}>
                    {TAG_KURZ[t]}
                    {daten && <span className="zahl"> {Number(daten[TAGE.indexOf(t)].slice(8))}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zeiten.map((z) => (
                <tr key={z}>
                  <th scope="row" className="zahl">
                    {z}
                  </th>
                  {tage.map((t) => {
                    const e = d.stundenplan.filter((x) => x.tag === t && x.start_zeit.slice(0, 5) === z);
                    return (
                      <td key={t} className={t === heute ? "ist-heute" : undefined}>
                        {e.map((x) => (
                          <span key={x.id} className="z" style={{ "--c": fach(x.fach_id)?.farbe ?? FARBE_OHNE_FACH } as React.CSSProperties}>
                            {fach(x.fach_id)?.name ?? "Veranstaltung"}
                            {x.raum && <small>{x.raum}</small>}
                          </span>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------- Wiederholen ---------- */

function Wiederholen({ d }: { d: HubDaten }) {
  return (
    <section className="wiederholen" aria-labelledby="hub-wdh">
      <div className="kopfzeile">
        <h2 id="hub-wdh">Wiederholen</h2>
        <span className="info">{d.karten.anzahl > 0 ? `${d.karten.anzahl} fällig` : ""}</span>
      </div>
      {d.karten.anzahl === 0 ? (
        <p className="vleer">Für heute ist alles wiederholt.</p>
      ) : (
        <>
          <ul className="stapel-kurz">
            {d.karten.stapel.slice(0, 3).map((s) => (
              <li key={s.id}>
                <Link href={`/karteikarten/${s.id}`}>
                  <span>{s.name}</span>
                  <span className="zahl">{s.anzahl}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="vfuss">
            <Link href="/karteikarten" className="knopf neben klein">
              Jetzt wiederholen
              <Symbol d={S.pfeil} groesse={14} />
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

export function HubBaustein({ id, d }: { id: BausteinId; d: HubDaten }): ReactNode {
  if (id === "naechstes") return <Naechstes d={d} />;
  if (id === "fakten") return <Fakten d={d} />;
  if (id === "heute") return <Heute d={d} />;
  if (id === "vorschlag") return <TagesBriefing />;
  if (id === "woche") return <Woche d={d} />;
  return <Wiederholen d={d} />;
}
