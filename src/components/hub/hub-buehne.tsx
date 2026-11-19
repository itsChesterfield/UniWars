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
import { alsNaechstes, bandLage, BAND, dateiTyp, hubVorschlaege, kuerzen, lageSatz, lernZiel, mischen, spuren, SZENEN, szeneBeiScroll, uhrAus, wannKurz, woche, zuletztText, type Eintrag, type HubVorschlag } from "@/lib/hub-buehne";
import { briefingHolen } from "@/components/ki/tages-briefing";
import { studioOeffnen } from "@/lib/ki/studio-kontext";
import { SCHNELL_ERFASSEN } from "@/components/quick-add";
import { useAufgabenDetail } from "@/lib/use-aufgaben-detail";
import { berlinDatum } from "@/lib/zeit";
import { bewegungReduziert } from "@/lib/personalisierung-store";
import { fehlerMelden } from "@/lib/analytics";

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
  const [besuch, setBesuch] = useState<number[]>(() => SZENEN.map((_, i) => (i === 0 ? 1 : 0)));
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
        zu(szeneBeiScroll(-(el.getBoundingClientRect().top - oben), hoehe.current, SZENEN.length));
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
    return `${f ? `${f.name} · ` : ""}${z.art}`;
  };

  // ---- 02 Woche
  const tage = useMemo(() => woche({ stundenplan: d.stundenplan, deadlines: d.deadlines, pruefungen: d.pruefungen, fachName: (id) => fach(id)?.name ?? null }, jetzt), [d, jetzt, fach]);
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
    // 01 Heute
    <section key={`s0-${besuch[0]}`} className={klasse(0)} aria-label="Heute" aria-hidden={!aktiv(0)} inert={!aktiv(0)}>
      <div className="bue-oben">
        <div className="bue-datum">
          <p className="bue-tag">
            <SteigText text={String(Number(heute.slice(8, 10)))} schritt={90} />
          </p>
          <p className="bue-dz bue-blende" style={verz(420)}>
            <b>{wochentag}</b>
            <span>
              {monat} · KW <span className="zahl">{kw}</span>
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
        </div>
      </div>
      <div className="bue-liste">
        <div className="bue-links bue-blende" style={verz(820)}>
          <b>Als Nächstes</b>
          <span>
            {aktiv(0) ? <RollText wert={String(offen)} start="0" className="zahl" /> : offen} offen
            {vorschlaege.length ? ` · ${vorschlaege.length === 1 ? "ein Vorschlag" : `${vorschlaege.length} Vorschläge`} von Studio` : ""}
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
    <section key={`s1-${besuch[1]}`} className={klasse(1)} aria-label="Diese Woche" aria-hidden={!aktiv(1)} inert={!aktiv(1)}>
      <Kapitel nr="02" titel="Diese Woche" unter="Vorlesungen, Prüfungen und Fristen" />
      <div className="bue-woche" role="group" aria-label="Tag wählen">
        {tage.map((t, i) => (
          <span key={t.datum} className="bue-zeile">
            <span className="bue-innen" style={verz(300 + i * 45)}>
              <button type="button" className={`bue-wt${t.heute ? " heute" : ""}`} aria-pressed={gewaehlt.datum === t.datum} onClick={() => setTag(i)} aria-label={`${t.kurz} ${t.zahl}., ${t.ereignisse.length ? `${t.ereignisse.length} Einträge` : "frei"}`}>
                <b>{t.zahl}</b>
                <small>{t.kurz}</small>
              </button>
            </span>
          </span>
        ))}
      </div>
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
                  {e.ort ? ` · ${e.ort}` : ""}
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
      <Link className="bue-zum bue-blende" style={verz(900)} href="/termine">
        Ganze Woche in Termine
        <Icon name="pfeil-rechts" groesse={16} />
      </Link>
    </section>,

    // 03 Mensa
    <section key={`s2-${besuch[2]}`} className={klasse(2)} aria-label="Mensa heute" aria-hidden={!aktiv(2)} inert={!aktiv(2)}>
      <Kapitel nr="03" titel="Mensa heute" unter={d.mensa ? d.mensa.mensa : "Noch keine Mensa gewählt"} />
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
    <section key={`s3-${besuch[3]}`} className={klasse(3)} aria-label="Zuletzt geöffnet" aria-hidden={!aktiv(3)} inert={!aktiv(3)}>
      <Kapitel nr="04" titel="Zuletzt geöffnet" unter="Weiter, wo du aufgehört hast" />
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
    <div ref={strecke} className={`buehne-strecke ${modus}`} data-richtung={richtung < 0 ? "zurueck" : "vor"} style={{ "--n": SZENEN.length } as CSSProperties}>
      {modus === "buehne" && SZENEN.map((s, i) => <span key={s.id} className="buehne-rast" style={{ top: `calc(${i} * var(--buehne-h, 600px))` }} aria-hidden="true" />)}
      <div className="buehne">
        {modus === "buehne" && (
          <>
            <span className="buehne-zaehler zahl" aria-hidden="true">
              <span className="buehne-roll">
                <span style={{ transform: `translateY(-${sz * 1.2}em)` }}>
                  {SZENEN.map((_, i) => (
                    <i key={i}>0{i + 1}</i>
                  ))}
                </span>
              </span>
              <span> / 0{SZENEN.length}</span>
            </span>
            <nav className="buehne-nav" aria-label="Kapitel der Übersicht">
              {SZENEN.map((s, i) => (
                <button key={s.id} type="button" aria-current={i === sz ? "step" : undefined} onClick={() => springen(i)}>
                  <span className="name">{s.name}</span>
                  <span className="zahl">0{i + 1}</span>
                  <span className="strich" />
                </button>
              ))}
            </nav>
            <p className={`buehne-weiter${sz === SZENEN.length - 1 ? " weg" : ""}`} aria-hidden="true">
              <span className="pf">
                <Icon name="runter" groesse={16} />
              </span>
              Weiter: {SZENEN[Math.min(SZENEN.length - 1, sz + 1)].name}
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
      <span className={`zahl bue-w${dringend ? " dringend" : ""}`}>{wann}</span>
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
