"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { toggleDeadlineErledigt } from "@/app/deadline/actions";
import { toggleTodoErledigt } from "@/app/todo/actions";
import { SteigText } from "@/components/bewegung/steig-text";
import { RollText } from "@/components/bewegung/roll-text";
import { Icon } from "@/components/nav-icon";
import type { HubDaten } from "@/components/hub/hub-daten";
import { alsNaechstes, bandLage, BAND, dateiTyp, hubVorschlaege, kuerzen, lageSatz, lernZiel, mischen, spuren, SZENEN, szeneBeiScroll, tagZeile, uhrAus, wannKurz, woche, zuletztText, type Eintrag, type HubVorschlag } from "@/lib/hub-buehne";
import { briefingHolen } from "@/components/ki/tages-briefing";
import { studioOeffnen } from "@/lib/ki/studio-kontext";
import { SCHNELL_ERFASSEN } from "@/components/quick-add";
import { useAufgabenDetail } from "@/lib/use-aufgaben-detail";
import { berlinDatum, berlinTageZwischen } from "@/lib/zeit";
import { fehlerMelden } from "@/lib/analytics";
import { klausurCluster, phaseAktiv, tagesplan, standFuer, vorschlagZeigen } from "@/lib/klausurphase";
import { bewegungReduziert, darstellungWaehlen, usePersoenlich } from "@/lib/personalisierung-store";

export type BuehneDaten = HubDaten & {
  notenschnitt: number | null;
  dateien: { id: string; name: string; mime_typ: string; geaendert_am: string; fach_id: string | null }[];
};

const verz = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;
/** Sichtbare Mindestdauer eines Termins im Wochenband (Stunden) */
const MINDEST = 1.25;
/** So viele Gerichte passen in die Szene Mensa */
const GERICHTE_MAX = 6;

type Posten = Eintrag | HubVorschlag;

const zahl = (n: number, stellen = 1) => n.toLocaleString("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen });

/**
 * Zentraler Hub als Bühne (Entscheidung Didi, 19.11., Entwurf „A · Bühne“, Inhalt nach Idee A): vier Kapitel, die sich beim
 * Scrollen ablösen wie Seiten. Echtes Scrollen bleibt: Die Strecke ist so hoch wie alle Szenen, die Bühne
 * steht (sticky), Einrastpunkte je Szene. Die alte Szene geht in Scrollrichtung hinaus, die neue baut sich auf
 * (Buchstaben steigen, Zeilen steigen, Flächen heben sich). Nur transform und opacity.
 * Am Handy und bei reduzierter Bewegung stehen die Szenen einfach untereinander.
 */
export function HubBuehne({ d }: { d: BuehneDaten }) {
  const [jetzt, setJetzt] = useState(() => new Date(d.serverJetzt));
  useEffect(() => {
    const t = window.setInterval(() => setJetzt(new Date()), 60_000);
    const sofort = window.setTimeout(() => setJetzt(new Date()), 0);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(sofort);
    };
  }, []);

  const [modus, setModus] = useState<"buehne" | "fluss">("buehne");
  const [sz, setSz] = useState(0);
  const [alt, setAlt] = useState(-1);
  const [richtung, setRichtung] = useState<1 | -1>(1);
  const [besuch, setBesuch] = useState<number[]>(() => [...SZENEN, null].map((_, i) => (i === 0 ? 1 : 0)));
  /** Zahl der Kapitel (mit Klausurphase eins mehr), für den Scroll-Lauscher */
  const anzahl = useRef<number>(SZENEN.length);
  const strecke = useRef<HTMLDivElement>(null);
  const hoehe = useRef(0);
  const aufraeumen = useRef(0);

  // Handy und reduzierte Bewegung: Szenen untereinander, ohne Bühne
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px), (prefers-reduced-motion: reduce)");
    const pruefen = () => setModus(mq.matches || bewegungReduziert() ? "fluss" : "buehne");
    pruefen();
    mq.addEventListener("change", pruefen);
    return () => mq.removeEventListener("change", pruefen);
  }, []);

  // Bühnenhöhe aus der echten Lage messen (Kopfleiste und Notch bleiben stehen)
  useLayoutEffect(() => {
    const el = strecke.current;
    if (!el || modus !== "buehne") return;
    const messen = () => {
      const oben = el.getBoundingClientRect().top + window.scrollY;
      const h = Math.max(420, window.innerHeight - oben - 8);
      hoehe.current = h;
      el.style.setProperty("--buehne-oben", `${oben}px`);
      el.style.setProperty("--buehne-h", `${h}px`);
    };
    messen();
    window.addEventListener("resize", messen);
    return () => window.removeEventListener("resize", messen);
  }, [modus]);

  const zu = useCallback((i: number) => {
    setSz((vorher) => {
      if (i === vorher) return vorher;
      setAlt(vorher);
      setRichtung(i > vorher ? 1 : -1);
      setBesuch((b) => b.map((n, j) => (j === i ? n + 1 : n)));
      window.clearTimeout(aufraeumen.current);
      aufraeumen.current = window.setTimeout(() => setAlt(-1), 520);
      return i;
    });
  }, []);

  // Scrollstand wählt die Szene (passiv, einmal pro Bild)
  useEffect(() => {
    if (modus !== "buehne") return;
    let geplant = 0;
    const lauschen = () => {
      if (geplant) return;
      geplant = requestAnimationFrame(() => {
        geplant = 0;
        const el = strecke.current;
        if (!el || !hoehe.current) return;
        const oben = Number.parseFloat(el.style.getPropertyValue("--buehne-oben")) || 0;
        zu(szeneBeiScroll(-(el.getBoundingClientRect().top - oben), hoehe.current, anzahl.current));
      });
    };
    window.addEventListener("scroll", lauschen, { passive: true });
    return () => {
      window.removeEventListener("scroll", lauschen);
      if (geplant) cancelAnimationFrame(geplant);
    };
  }, [modus, zu]);

  const springen = (i: number) => {
    const el = strecke.current;
    if (!el) return;
    if (modus === "fluss") {
      el.querySelectorAll<HTMLElement>(".szene")[i]?.scrollIntoView({ behavior: bewegungReduziert() ? "auto" : "smooth", block: "start" });
      return;
    }
    const oben = Number.parseFloat(el.style.getPropertyValue("--buehne-oben")) || 0;
    const start = el.getBoundingClientRect().top + window.scrollY - oben;
    window.scrollTo({ top: start + i * hoehe.current, behavior: "smooth" });
  };

  const fach = useCallback((id: string | null) => d.faecher.find((f) => f.id === id) ?? null, [d.faecher]);

  // ---- Klausurphase (lib/klausurphase.ts): eigenes erstes Kapitel, Vorschlag im Kapitel Heute
  const darstellung = usePersoenlich("darstellung", d.darstellung);
  const cluster = useMemo(() => klausurCluster(d.pruefungen, jetzt), [d.pruefungen, jetzt]);
  const klausurAn = Boolean(cluster) && phaseAktiv(darstellung.klausurphase, jetzt);
  const vorschlag = vorschlagZeigen(cluster, darstellung.klausurphase, jetzt);
  const plan = useMemo(() => (cluster ? tagesplan(cluster, d.themen, d.karten.stapel, (id) => fach(id)?.name ?? null) : []), [cluster, d.themen, d.karten.stapel, fach]);
  const phaseSetzen = (an: boolean) => {
    if (!cluster) return;
    // Beenden merkt sich die erste Klausur, damit der Vorschlag nicht gleich wiederkommt
    darstellungWaehlen({ ...darstellung, klausurphase: an ? { bis: cluster.bis } : { abgelehnt: cluster.erste.id } });
    // Das neue Kapitel steht vorn: beim Starten dorthin, beim Beenden rückt alles eins nach vorn
    if (an) {
      zu(0);
      requestAnimationFrame(() => springen(0));
    }
    else if (klausurAn) setSz((i) => Math.max(0, i - 1));
  };
  const liste = useMemo(() => (klausurAn ? [{ id: "klausur", name: "Klausuren" }, ...SZENEN] : [...SZENEN]), [klausurAn]);
  useLayoutEffect(() => {
    anzahl.current = liste.length;
  }, [liste]);
  const I = Object.fromEntries(liste.map((x, i) => [x.id, i])) as Record<"klausur" | "heute" | "woche" | "mensa" | "zuletzt", number>;
  const nr = (i: number) => String(i + 1).padStart(2, "0");
  const tageText = (t: number) => (t === 0 ? "heute" : t === 1 ? "morgen" : `in ${t} Tagen`);
  const kurzDatum = (iso: string) => new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", timeZone: "Europe/Berlin" }).format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso));
  const kopf = (() => {
    const erst = plan[0];
    const dann = plan[1] ? ` Danach: ${plan[1].titel}.` : "";
    if (erst?.frage) {
      const thema = erst.titel.replace(/ wiederholen$/, "");
      return { text: `Heute zuerst: ${thema} wiederholen.`, betont: thema.split(" "), unter: `Das Thema wackelt am meisten.${dann}` };
    }
    if (erst) return { text: `Heute zuerst: ${erst.titel}.`, betont: [] as string[], unter: `Sie sind heute fällig.${dann}` };
    return { text: "Noch kein Stand für deine Klausuren.", betont: [] as string[], unter: "Lern mit Karteikarten oder lass dich von Studio abfragen, dann steht hier, was wackelt." };
  })();

  // ---- 01 Heute: Fristen, Prüfungen, To-dos und Vorschläge von Studio
  const [erledigt, setErledigt] = useState<Record<string, boolean>>({});
  const eintraege = useMemo(() => alsNaechstes(d, jetzt), [d, jetzt]);
  const lage = lageSatz(eintraege, jetzt);
  const offen = eintraege.filter((e) => !erledigt[e.id]).length;
  const [vorschlaege, setVorschlaege] = useState<HubVorschlag[]>([]);
  // Kommen die Vorschläge erst nach dem Aufbau, steigen sie ohne Wartezeit ein
  const [spaet, setSpaet] = useState(false);
  useEffect(() => {
    let ab = false;
    const start = performance.now();
    briefingHolen().then((b) => {
      if (ab || !b) return;
      setSpaet(performance.now() - start > 300);
      setVorschlaege(hubVorschlaege(b.vorschlaege));
    });
    return () => {
      ab = true;
    };
  }, []);
  const zeilen: Posten[] = mischen<Posten, Posten>(eintraege, vorschlaege, 5);
  const { oeffne } = useAufgabenDetail();
  const router = useRouter();
  const umschalten = (e: Eintrag) => {
    if (e.quelle === "pruefung") return;
    const neu = !erledigt[e.id];
    setErledigt((x) => ({ ...x, [e.id]: neu }));
    const aufruf = e.quelle === "deadline" ? toggleDeadlineErledigt(e.id, neu) : toggleTodoErledigt(e.id, neu);
    Promise.resolve(aufruf).catch((err) => {
      fehlerMelden(err, { ort: "hub_buehne_abhaken" });
      setErledigt((x) => ({ ...x, [e.id]: !neu }));
    });
  };
  const ziel = (z: Posten): string | null => ("quelle" in z ? (z.quelle === "pruefung" ? null : lernZiel(z.titel, d.karten.stapel)) : (z.href ?? null));
  const oeffnen = (z: Posten) => {
    const href = ziel(z);
    if (href) {
      router.push(href);
      return;
    }
    if ("quelle" in z) oeffne(z.quelle, z.id);
    else if (z.frage) studioOeffnen(z.frage);
  };
  const meta = (z: Posten) => {
    if (!("quelle" in z)) return z.grund;
    const f = fach(z.fachId);
    // Unteraufgaben sagen, wozu sie gehören, statt wie eine eigene Aufgabe auszusehen
    return `${f ? `${f.name}, ` : ""}${z.teilVon ? `Teil von „${z.teilVon}“` : z.art}`;
  };

  // ---- 02 Woche
  const tage = useMemo(() => woche({ stundenplan: d.stundenplan, deadlines: d.deadlines, pruefungen: d.pruefungen, todos: d.todos, fachName: (id) => fach(id)?.name ?? null }, jetzt), [d, jetzt, fach]);
  const heuteIndex = Math.max(0, tage.findIndex((t) => t.heute));
  const [tag, setTag] = useState<number | null>(null);
  const gewaehlt = tage[tag ?? heuteIndex];
  const jetztStunde = (() => {
    const [h, m] = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Berlin" }).format(jetzt).split(":").map(Number);
    return h + m / 60;
  })();

  const heute = berlinDatum(jetzt);
  const gelegt = useMemo(() => spuren(gewaehlt.ereignisse, MINDEST), [gewaehlt]);
  const spurZahl = Math.max(1, ...gelegt.map((e) => e.spur + 1));

  // ---- 03 Mensa
  const gerichte = d.mensa?.gerichte ?? [];

  const datum = new Intl.DateTimeFormat("de-DE", { weekday: "long", month: "long", timeZone: "Europe/Berlin" }).formatToParts(jetzt);
  const wochentag = datum.find((p) => p.type === "weekday")?.value ?? "";
  const monat = datum.find((p) => p.type === "month")?.value ?? "";
  const kw = (() => {
    const t = new Date(`${heute}T12:00:00Z`);
    const tagNr = (t.getUTCDay() + 6) % 7;
    t.setUTCDate(t.getUTCDate() - tagNr + 3);
    const ersterDo = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((t.getTime() - ersterDo.getTime()) / 86_400_000 - 3 + ((ersterDo.getUTCDay() + 6) % 7)) / 7);
  })();

  const klasse = (i: number) => {
    if (modus === "fluss") return "szene";
    let k = "szene";
    if (i === sz) k += " ein";
    else if (i === alt) k += " aus";
    return k;
  };
  const aktiv = (i: number) => modus === "fluss" || i === sz;

  const szenen = [
    // Klausurphase: eigenes erstes Kapitel
    ...(klausurAn && cluster
      ? [
          <section key={`klausur-${besuch[I.klausur]}`} className={klasse(I.klausur)} aria-label="Klausuren" aria-hidden={!aktiv(I.klausur)} inert={!aktiv(I.klausur)}>
            <div className="bue-oben">
              <div className="bue-datum">
                <p className="bue-tag">
                  <SteigText text={String(cluster.tageBisErste)} schritt={90} />
                </p>
                <p className="bue-dz bue-blende" style={verz(420)}>
                  <b>{cluster.tageBisErste === 1 ? "Tag" : "Tage"}</b>
                  <span>bis zur ersten Klausur</span>
                </p>
              </div>
              <div className="bue-text">
                <h1 className="bue-lage">
                  <SteigText text={kopf.text} start={260} akzent={kopf.betont} />
                </h1>
                <p className="bue-unter bue-blende" style={verz(760)}>
                  {kopf.unter}
                </p>
              </div>
            </div>
            <div className="bue-liste">
              <div className="bue-links bue-blende" style={verz(820)}>
                <b>Deine Klausuren</b>
                <span>
                  <span className="zahl">{cluster.klausuren.length}</span> bis <span className="zahl">{kurzDatum(cluster.bis)}</span>
                </span>
                <button type="button" className="knopf leise klein" onClick={() => phaseSetzen(false)}>
                  Klausurphase beenden
                </button>
              </div>
              <ol className="bue-reihen">
                {cluster.klausuren.map((k, i) => {
                  const f = fach(k.fach_id);
                  const st = standFuer(k.fach_id, d.themen, d.karten.stapel);
                  const t = Math.max(0, berlinTageZwischen(jetzt, new Date(k.datum)));
                  return (
                    <li key={k.id} className="bue-zeile">
                      <span className="bue-innen" style={verz(860 + i * 70)}>
                        <div className="bue-reihe kp-reihe">
                          <span className="bue-marke" aria-hidden="true">
                            <Icon name="ziel" groesse={14} />
                          </span>
                          <button type="button" className="bue-auf" onClick={() => oeffne("pruefung", k.id)}>
                            <span className="bue-t">
                              <span className="bue-strich">{k.titel}</span>
                              <small>
                                <span>
                                  {f ? `${f.name}, ` : ""}
                                  <span className="zahl">{kurzDatum(k.datum)}</span>
                                </span>
                                <span className="kp-stand" style={{ "--c": f?.farbe ?? "var(--akzent)" } as CSSProperties}>
                                  {st.anteil !== null && (
                                    <span className="kp-balken" aria-hidden="true">
                                      <i style={{ transform: `scaleX(${st.anteil})` }} />
                                    </span>
                                  )}
                                  {st.text}
                                </span>
                              </small>
                            </span>
                            <span className="bue-w">{tageText(t).split(/(\d+)/).map((teil, j) => (/^\d/.test(teil) ? <span key={j} className="zahl">{teil}</span> : teil))}</span>
                            <Icon name="pfeil-rechts" groesse={18} className="bue-p" />
                          </button>
                        </div>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
            {plan.length > 0 && (
              <div className="bue-liste kp-plan">
                <div className="bue-links bue-blende" style={verz(1000)}>
                  <b>Heute lernen</b>
                  <span>aus Wissensstand und fälligen Karten</span>
                </div>
                <ol className="bue-reihen">
                  {plan.slice(0, 3).map((x, i) => {
                    const inhalt = (
                      <>
                        <span className="bue-t">
                          <span className="bue-strich">{x.titel}</span>
                          <small>{x.unter}</small>
                        </span>
                        <Icon name="pfeil-rechts" groesse={18} className="bue-p" />
                      </>
                    );
                    return (
                      <li key={x.id} className="bue-zeile">
                        <span className="bue-innen" style={verz(1040 + i * 70)}>
                          <div className="bue-reihe">
                            <span className="bue-marke" aria-hidden="true">
                              <Icon name={x.frage ? "studio" : "karteikarten"} groesse={14} />
                            </span>
                            {x.href ? (
                              <Link className="bue-auf" href={x.href}>
                                {inhalt}
                              </Link>
                            ) : (
                              <button type="button" className="bue-auf" onClick={() => x.frage && studioOeffnen(x.frage)}>
                                {inhalt}
                              </button>
                            )}
                          </div>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </section>,
        ]
      : []),
    // 01 Heute
    <section key={`heute-${besuch[I.heute]}`} className={klasse(I.heute)} aria-label="Heute" aria-hidden={!aktiv(I.heute)} inert={!aktiv(I.heute)}>
      <div className="bue-oben">
        <div className="bue-datum">
          <p className="bue-tag">
            <SteigText text={String(Number(heute.slice(8, 10)))} schritt={90} />
          </p>
          <p className="bue-dz bue-blende" style={verz(420)}>
            <b>{wochentag}</b>
            <span>
              {monat}, KW <span className="zahl">{kw}</span>
            </span>
          </p>
        </div>
        <div className="bue-text">
          <h1 className="bue-lage">
            <SteigText text={lage.text} start={260} akzent={lage.betont} />
          </h1>
          <p className="bue-unter bue-blende" style={verz(760)}>
            {lage.unter}
          </p>
          {vorschlag && cluster && (
            <div className="kp-vorschlag bue-blende" style={verz(900)}>
              <p>
                <b>
                  {tageText(cluster.tageBisErste).replace(/^./, (c) => c.toUpperCase())} schreibst du {cluster.erste.titel}
                  {cluster.klausuren.length > 1 ? `, danach ${cluster.klausuren.length - 1} weitere` : ""}.
                </b>{" "}
                In der Klausurphase zeigt der Hub zuerst deine Klausuren und was heute dran ist.
              </p>
              <div className="kp-knoepfe">
                <button type="button" className="knopf neben klein" onClick={() => phaseSetzen(true)}>
                  Klausurphase starten
                </button>
                <button type="button" className="knopf leise klein" onClick={() => phaseSetzen(false)}>
                  Nicht jetzt
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="bue-liste">
        <div className="bue-links bue-blende" style={verz(820)}>
          <b>Als Nächstes</b>
          <span>
            {aktiv(I.heute) ? <RollText wert={String(offen)} start="0" className="zahl" /> : offen} offen
            {vorschlaege.length ? `, ${vorschlaege.length === 1 ? "ein Vorschlag" : `${vorschlaege.length} Vorschläge`} von Studio` : ""}
          </span>
          <Link className="bue-zum" href="/aufgaben">
            Alle Aufgaben
            <Icon name="pfeil-rechts" groesse={16} />
          </Link>
        </div>
        {zeilen.length ? (
          <ol className="bue-reihen">
            {zeilen.map((z, i) => (
              <li key={z.id} className="bue-zeile">
                <span className="bue-innen" style={verz(spaet && !("quelle" in z) ? 60 : 860 + i * 70)}>
                  <Zeile z={z} fertig={!!erledigt[z.id]} onHaken={() => "quelle" in z && umschalten(z)} onOeffnen={() => oeffnen(z)} ziel={ziel(z)} meta={meta(z)} wann={"quelle" in z ? wannKurz(z.wann, jetzt) : ""} />
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="bue-leer bue-blende" style={verz(860)}>
            <p>Nichts offen.</p>
            <button type="button" className="knopf klein" onClick={() => window.dispatchEvent(new CustomEvent(SCHNELL_ERFASSEN, { detail: { quelle: "hub" } }))}>
              <Icon name="plus" groesse={16} />
              Aufgabe anlegen
            </button>
          </div>
        )}
      </div>
    </section>,

    // 02 Diese Woche
    <section key={`woche-${besuch[I.woche]}`} className={klasse(I.woche)} aria-label="Diese Woche" aria-hidden={!aktiv(I.woche)} inert={!aktiv(I.woche)}>
      <Kapitel nr={nr(I.woche)} titel="Diese Woche" unter="Vorlesungen, Prüfungen und Fristen" />
      <div className="bue-woche" role="group" aria-label="Tag wählen">
        {tage.map((t, i) => (
          <span key={t.datum} className="bue-zeile">
            <span className="bue-innen" style={verz(300 + i * 45)}>
              <button type="button" className={`bue-wt${t.heute ? " heute" : ""}`} aria-pressed={gewaehlt.datum === t.datum} onClick={() => setTag(i)}>
                <b>{t.zahl}</b>{" "}
                <small>{t.kurz}</small>
                <span className="vh">, {t.ereignisse.length === 0 ? "frei" : t.ereignisse.length === 1 ? "1 Eintrag" : `${t.ereignisse.length} Einträge`}</span>
              </button>
            </span>
          </span>
        ))}
      </div>
      {/* Der gewählte Tag ausgeschrieben: trennt die Tagesreiter vom Zeitband, dessen Stunden sonst wie Wochentage wirken */}
      <p className="bue-tagzeile">{tagZeile(gewaehlt.datum, gewaehlt.ereignisse.length)}</p>
      <div className="bue-band" key={gewaehlt.datum} style={{ "--spuren": spurZahl } as CSSProperties}>
        {[8, 10, 12, 14, 16, 18, 20, 22].map((h, i) => (
          <span key={h} className="bue-tick bue-blende" style={{ left: `${bandLage(h, h).links}%`, ...verz(500 + i * 35) }}>
            <span className="zahl">{String(h).padStart(2, "0")}</span>
          </span>
        ))}
        {gelegt.map((e, i) => {
          const l = bandLage(e.von, e.bis);
          const breite = Math.max(l.breite, (MINDEST / (BAND.bis - BAND.von)) * 100);
          const links = Math.min(l.links, 100 - breite);
          const farbe = e.art === "frist" ? "var(--color-error)" : e.art === "pruefung" ? "var(--akzent)" : (fach(e.fachId)?.farbe ?? "var(--linie-2)");
          const art = e.art === "frist" ? "Frist" : e.art === "pruefung" ? "Prüfung" : "Vorlesung";
          const beginn = e.uhr ?? uhrAus(e.von);
          const zeit = e.art === "frist" ? `fällig um ${beginn}` : `${beginn} bis ${uhrAus(e.bis)}`;
          return (
            <Link
              key={e.id}
              href="/termine"
              className="bue-ereignis bue-hebt"
              aria-label={`${art}: ${e.titel}, ${zeit}${e.ort ? `, ${e.ort}` : ""}`}
              style={{ left: `${links}%`, width: `calc(${breite}% - 4px)`, "--spur": e.spur, "--c": farbe, ...verz(620 + i * 110) } as CSSProperties}
            >
              <span className="bue-kurz" aria-hidden="true">
                <b>{e.titel}</b>
                <span>
                  <span className="zahl">{beginn}</span>
                  {e.ort ? `, ${e.ort}` : ""}
                </span>
              </span>
              <span className={`bue-voll${links > 66 ? " rechts" : ""}`} aria-hidden="true">
                <small>{art}</small>
                <b>{e.titel}</b>
                <span className="bue-vz">
                  <Icon name="uhr" groesse={14} />
                  <span className="zahl">{zeit}</span>
                </span>
                {e.ort && (
                  <span className="bue-vz">
                    <Icon name="globus" groesse={14} />
                    {e.ort}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
        {!gewaehlt.ereignisse.length && <span className="bue-frei bue-blende" style={verz(300)}>Frei. Nichts eingetragen.</span>}
        {gewaehlt.heute && jetztStunde >= BAND.von && jetztStunde <= BAND.bis && (
          <span className="bue-jetzt bue-waechst" style={{ left: `${bandLage(jetztStunde, jetztStunde).links}%`, ...verz(1000) }} role="img" aria-label="jetzt" />
        )}
      </div>
      {/* Handy: der gewählte Tag als Liste statt Zeitband (nur per CSS sichtbar) */}
      <ol className="bue-agenda" aria-label={`${gewaehlt.kurz} ${gewaehlt.zahl}.`}>
        {gewaehlt.ereignisse.length ? (
          gewaehlt.ereignisse.map((e) => {
            const farbe = e.art === "frist" ? "var(--color-error)" : e.art === "pruefung" ? "var(--akzent)" : (fach(e.fachId)?.farbe ?? "var(--linie-2)");
            const beginn = e.uhr ?? uhrAus(e.von);
            return (
              <li key={e.id}>
                <Link className="bue-agenda-zeile" href="/termine" style={{ "--c": farbe } as CSSProperties}>
                  <span className="bue-agenda-zeit zahl">
                    {beginn}
                    {e.art !== "frist" && <small>bis {uhrAus(e.bis)}</small>}
                  </span>
                  <span className="bue-agenda-text">
                    <b>{e.titel}</b>
                    <small>
                      {e.art === "frist" ? "Frist" : e.art === "pruefung" ? "Prüfung" : "Vorlesung"}
                      {e.ort ? `, ${e.ort}` : ""}
                    </small>
                  </span>
                </Link>
              </li>
            );
          })
        ) : (
          <li className="bue-agenda-frei">Frei. Nichts eingetragen.</li>
        )}
      </ol>
      <Link className="bue-zum bue-blende" style={verz(900)} href="/termine">
        Ganze Woche in Termine
        <Icon name="pfeil-rechts" groesse={16} />
      </Link>
    </section>,

    // 03 Mensa
    <section key={`mensa-${besuch[I.mensa]}`} className={klasse(I.mensa)} aria-label="Mensa heute" aria-hidden={!aktiv(I.mensa)} inert={!aktiv(I.mensa)}>
      <Kapitel nr={nr(I.mensa)} titel="Mensa heute" unter={d.mensa ? d.mensa.mensa : "Noch keine Mensa gewählt"} />
      <div className="bue-raster bue-abstand">
        <p className="bue-links bue-blende" style={verz(600)}>
          <b>{d.mensa?.heute ? "Heute" : d.mensa?.datum ? "Nächster Tag" : "Speiseplan"}</b>
          {d.mensa?.datum ? `${d.mensa.datum.slice(8, 10)}.${d.mensa.datum.slice(5, 7)}.` : ""}
          {gerichte.length > GERICHTE_MAX ? <span className="bue-mehr">und {gerichte.length - GERICHTE_MAX} weitere</span> : null}
        </p>
        {gerichte.length ? (
          <ol className={`bue-gerichte${gerichte.length > 3 ? " zwei" : ""}`}>
            {gerichte.slice(0, GERICHTE_MAX).map((g, i) => (
              <li key={`${g.name}-${i}`} className="bue-zeile">
                <span className="bue-innen bue-gericht" style={verz(560 + i * 70)}>
                  <span className="bue-t">
                    <span className="bue-gname">{kuerzen(g.name, 70)}</span>
                    <small>
                      {g.kategorie}
                      {g.vegan && <span className="bue-vegan">vegan</span>}
                    </small>
                  </span>
                  <span className="zahl bue-preis">{g.preis !== null ? `${zahl(g.preis, 2)} €` : ""}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="bue-leer bue-blende" style={verz(700)}>
            {d.mensaGewaehlt ? "Heute gibt es keinen Speiseplan." : "Wähle deine Mensa, dann steht hier das Tagesangebot."}{" "}
            {!d.mensaGewaehlt && (
              <Link className="link" href="/einstellungen">
                Mensa wählen
              </Link>
            )}
          </p>
        )}
      </div>
    </section>,

    // 04 Zuletzt geöffnet
    <section key={`zuletzt-${besuch[I.zuletzt]}`} className={klasse(I.zuletzt)} aria-label="Zuletzt geöffnet" aria-hidden={!aktiv(I.zuletzt)} inert={!aktiv(I.zuletzt)}>
      <Kapitel nr={nr(I.zuletzt)} titel="Zuletzt geöffnet" unter="Weiter, wo du aufgehört hast" />
      {d.dateien.length ? (
        <div className="bue-dateien">
          {d.dateien.map((f, i) => {
            const typ = dateiTyp(f.mime_typ, f.name);
            return (
              <Link key={f.id} className="bue-datei bue-hebt" style={verz(380 + i * 70)} href={typ === "PDF" ? `/pdf-reader/${f.id}` : "/dateiablage"}>
                <span className="bue-datei-kopf">
                  <span className="zahl">{typ}</span>
                  <span>{zuletztText(f.geaendert_am, jetzt)}</span>
                </span>
                <b>{kuerzen(f.name.replace(/\.[^.]+$/, ""), 60)}</b>
                <small>{fach(f.fach_id)?.name ?? "Ohne Fach"}</small>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="bue-leer bue-blende" style={verz(500)}>
          Noch keine Dateien. <Link className="link" href="/dateiablage">Zur Dateiablage</Link>
        </p>
      )}
    </section>,
  ];

  return (
    <div ref={strecke} className={`buehne-strecke ${modus}`} data-richtung={richtung < 0 ? "zurueck" : "vor"} style={{ "--n": liste.length } as CSSProperties}>
      {modus === "buehne" && liste.map((s, i) => <span key={s.id} className="buehne-rast" style={{ top: `calc(${i} * var(--buehne-h, 600px))` }} aria-hidden="true" />)}
      <div className="buehne">
        {modus === "buehne" && (
          <>
            <span className="buehne-zaehler zahl" aria-hidden="true">
              <span className="buehne-roll">
                <span style={{ transform: `translateY(-${sz * 1.2}em)` }}>
                  {liste.map((_, i) => (
                    <i key={i}>{nr(i)}</i>
                  ))}
                </span>
              </span>
              <span> / {nr(liste.length - 1)}</span>
            </span>
            <nav className="buehne-nav" aria-label="Kapitel der Übersicht">
              {liste.map((s, i) => (
                <button key={s.id} type="button" aria-current={i === sz ? "step" : undefined} onClick={() => springen(i)}>
                  <span className="name">{s.name}</span>
                  <span className="zahl">{nr(i)}</span>
                  <span className="strich" />
                </button>
              ))}
            </nav>
            <p className={`buehne-weiter${sz === liste.length - 1 ? " weg" : ""}`} aria-hidden="true">
              <span className="pf">
                <Icon name="runter" groesse={16} />
              </span>
              Weiter: {liste[Math.min(liste.length - 1, sz + 1)].name}
            </p>
          </>
        )}
        {szenen}
      </div>
    </div>
  );
}

/** Eine Zeile in „Als Nächstes“: vorne der Haken (oder das Studio-Zeichen), der Rest öffnet. */
function Zeile({ z, fertig, onHaken, onOeffnen, ziel, meta, wann }: { z: Posten; fertig: boolean; onHaken: () => void; onOeffnen: () => void; ziel: string | null; meta: string; wann: string }) {
  const studio = !("quelle" in z);
  const pruefung = "quelle" in z && z.quelle === "pruefung";
  const dringend = "quelle" in z && z.dringend;
  const inhalt = (
    <>
      <span className="bue-t">
        <span className="bue-strich">{z.titel}</span>
        <small>
          {studio && <span className="bue-st">Studio</span>}
          {meta}
        </small>
      </span>
      <span className={`bue-w${dringend ? " dringend" : ""}`}>
        {/* Mono nur für Zahlen und Zeiten, Wörter wie „heute“ in der Grundschrift */}
        {wann.split(/(\d[\d.:]*)/).map((teil, i) => (/^\d/.test(teil) ? <span key={i} className="zahl">{teil}</span> : teil))}
      </span>
      <Icon name="pfeil-rechts" groesse={18} className="bue-p" />
    </>
  );
  return (
    <div className={`bue-reihe${fertig ? " fertig" : ""}${studio ? " studio" : ""}`}>
      {studio ? (
        <span className="bue-marke" aria-hidden="true">
          <Icon name="studio" groesse={14} />
        </span>
      ) : pruefung ? (
        <span className="bue-marke" aria-hidden="true">
          <Icon name="ziel" groesse={14} />
        </span>
      ) : (
        <button type="button" className="bue-haken" aria-pressed={fertig} aria-label={`${z.titel} ${fertig ? "wieder öffnen" : "erledigt"}`} onClick={onHaken}>
          <Icon name="haken" groesse={14} />
        </button>
      )}
      {ziel ? (
        <Link className="bue-auf" href={ziel}>
          {inhalt}
        </Link>
      ) : (
        <button type="button" className="bue-auf" onClick={onOeffnen}>
          {inhalt}
        </button>
      )}
    </div>
  );
}

function Kapitel({ nr, titel, unter }: { nr: string; titel: string; unter: string }) {
  return (
    <div className="bue-kap">
      <span className="bue-kap-nr zahl" aria-hidden="true">
        <SteigText text={nr} schritt={70} />
      </span>
      <h2>
        <SteigText text={titel} start={120} schritt={22} />
        <small className="bue-blende" style={verz(400)}>
          {unter}
        </small>
      </h2>
    </div>
  );
}
