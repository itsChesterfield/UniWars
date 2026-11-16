"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { hubLayoutSpeichern } from "@/app/settings/actions";
import { HubBaustein, type HubDaten } from "@/components/hub/hub-bausteine";
import { track } from "@/lib/analytics";
import {
  BAUSTEIN_NAMEN,
  GROESSEN,
  HUB_ANORDNEN,
  GROESSEN_NAMEN,
  VOREINSTELLUNGEN,
  VOREINSTELLUNG_NAMEN,
  gleich,
  groesseSetzen,
  hubLayoutLesen,
  kopie,
  rasterPlan,
  sichtbare,
  sichtbarSetzen,
  umsetzen,
  verschieben,
  voreinstellungVon,
  type BausteinId,
  type Groesse,
  type HubLayout,
  type Platz,
  type Voreinstellung,
} from "@/lib/hub-layout";

const MAX_RUECKGAENGIG = 30;

const I = {
  griff: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="5.5" cy="3.5" r="1.3" />
      <circle cx="10.5" cy="3.5" r="1.3" />
      <circle cx="5.5" cy="8" r="1.3" />
      <circle cx="10.5" cy="8" r="1.3" />
      <circle cx="5.5" cy="12.5" r="1.3" />
      <circle cx="10.5" cy="12.5" r="1.3" />
    </svg>
  ),
  strich: (d: string) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.split("|").map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  ),
};
const LINKS = "M19 12H5|m11 18-6-6 6-6";
const RECHTS = "M5 12h14|m13 6 6 6-6 6";
const AUGE_AUS = "M3 3l18 18|M10.5 6.1A9.6 9.6 0 0 1 12 6c5 0 8.4 4.4 9.5 6a17 17 0 0 1-2.7 3.2|M6.4 7.5A16.6 16.6 0 0 0 2.5 12c1.1 1.6 4.5 6 9.5 6a9.3 9.3 0 0 0 3.7-.8|M9.9 9.9a3 3 0 0 0 4.2 4.2";
const PLUS = "M12 5v14|M5 12h14";
const ZURUECK = "M9 14 4 9l5-5|M4 9h10.500a5.500 5.500 0 0 1 0 11H11";

/** Bausteine sind verschieden groß: Es zählt der Baustein unter dem Zeiger, nicht die nächste Mitte. */
const kollision: CollisionDetection = (args) => {
  const unterZeiger = pointerWithin(args);
  return unterZeiger.length ? unterZeiger : closestCenter(args);
};

const ZURUECK_TASTEN = ["ArrowUp", "ArrowLeft"];
const VOR_TASTEN = ["ArrowDown", "ArrowRight"];

const ruhig = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Bausteine gleiten an ihren neuen Platz, statt zu springen (FLIP). */
function useGleiten(ref: React.RefObject<HTMLElement | null>, schluessel: string) {
  const vorher = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const neu = new Map<string, DOMRect>();
    ref.current?.querySelectorAll<HTMLElement>("[data-id]").forEach((el) => {
      el.getAnimations().forEach((a) => a.cancel());
      const b = el.getBoundingClientRect();
      const a = vorher.current.get(el.dataset.id!);
      neu.set(el.dataset.id!, b);
      if (!a || ruhig()) return;
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], { duration: 200, easing: "cubic-bezier(.22,.9,.24,1)" });
    });
    vorher.current = neu;
  }, [ref, schluessel]);
}

function Block({
  platz,
  position,
  anzahl,
  bearbeiten,
  zieht,
  d,
  onGroesse,
  onSchieben,
  onAusblenden,
}: {
  platz: Platz;
  position: number;
  anzahl: number;
  bearbeiten: boolean;
  zieht: boolean;
  d: HubDaten;
  onGroesse: (g: Groesse) => void;
  onSchieben: (r: -1 | 1) => void;
  onAusblenden: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef } = useSortable({ id: platz.id, disabled: !bearbeiten });
  const name = BAUSTEIN_NAMEN[platz.id];
  return (
    <>
      <div
        ref={setNodeRef}
        className={`block${bearbeiten ? " bearb" : ""}${zieht ? " zieht" : ""}`}
        data-id={platz.id}
        data-spalte={platz.spalte}
        data-zeile={platz.zeile}
        style={{ "--span": bearbeiten ? platz.spanne : platz.spanne + platz.frei } as React.CSSProperties}
      >
        {bearbeiten ? (
          <div className="bwerk">
            <button
              type="button"
              className="griff"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              data-griff={platz.id}
              aria-label={`${name} verschieben, Position ${position + 1} von ${anzahl}`}
            >
              {I.griff}
            </button>
            <span className="bname">{name}</span>
            <span className="segment gr" role="group" aria-label={`Breite von ${name}`}>
              {GROESSEN[platz.id].map((g) => (
                <button key={g} type="button" aria-pressed={g === platz.groesse} aria-label={GROESSEN_NAMEN[g]} title={GROESSEN_NAMEN[g]} onClick={() => onGroesse(g)}>
                  {g}
                </button>
              ))}
            </span>
            <span className="bwerk-rechts">
              <button type="button" className="symbolknopf" data-schieb="-1" aria-label={`${name} nach vorn`} disabled={position === 0} onClick={() => onSchieben(-1)}>
                {I.strich(LINKS)}
              </button>
              <button type="button" className="symbolknopf" data-schieb="1" aria-label={`${name} nach hinten`} disabled={position === anzahl - 1} onClick={() => onSchieben(1)}>
                {I.strich(RECHTS)}
              </button>
              <button type="button" className="symbolknopf" aria-label={`${name} ausblenden`} onClick={onAusblenden}>
                {I.strich(AUGE_AUS)}
              </button>
            </span>
          </div>
        ) : null}
        <div className="binhalt" inert={bearbeiten}>
          <HubBaustein id={platz.id} d={d} />
        </div>
      </div>
      {bearbeiten && platz.frei > 0 ? (
        <div className="frei" style={{ "--span": platz.frei } as React.CSSProperties}>
          <p>Freier Platz. Im Hub wird {name} so breit, dass die Zeile voll ist.</p>
        </div>
      ) : null}
    </>
  );
}

/**
 * Design B3: Übersicht des Zentralen Hubs (DESIGN.md Abschnitt 5).
 * Raster mit drei Spalten; „Anpassen“ schaltet direkt hier in den Bearbeiten-Modus:
 * Griff (Maus, Touch, Tastatur), Pfeile nach vorn und hinten, Breite, Ausblenden in eine Ablage, Rückgängig.
 */
export function HubUebersicht({ d, layoutRoh }: { d: HubDaten; layoutRoh: unknown }) {
  const [layout, setLayout] = useState<HubLayout>(() => hubLayoutLesen(layoutRoh));
  const [bearbeiten, setBearbeiten] = useState(false);
  const [rueck, setRueck] = useState<HubLayout[]>([]);
  const [zieht, setZieht] = useState<BausteinId | null>(null);
  const [geist, setGeist] = useState(false);
  const [ansage, setAnsage] = useState("");
  const [fehler, setFehler] = useState(false);
  const [, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const stand = useRef(layout);
  const vorZiehen = useRef<HubLayout | null>(null);
  const fokusNach = useRef<string | null>(null);
  const router = useRouter();
  const pfad = usePathname();
  const suche = useSearchParams();

  useEffect(() => {
    stand.current = layout;
  }, [layout]);

  const sichern = useCallback((l: HubLayout) => {
    start(async () => {
      const antwort = await hubLayoutSpeichern(l).catch(() => ({ ok: false }));
      setFehler(!antwort.ok);
    });
  }, []);

  const aendern = useCallback(
    (neu: HubLayout | null, text: string, fokus?: string) => {
      if (!neu || gleich(neu, stand.current)) return;
      setRueck((r) => [...r.slice(1 - MAX_RUECKGAENGIG), kopie(stand.current)]);
      setLayout(neu);
      sichern(neu);
      setAnsage(text);
      fokusNach.current = fokus ?? null;
    },
    [sichern],
  );

  const rueckStand = useRef(rueck);
  useEffect(() => {
    rueckStand.current = rueck;
  }, [rueck]);
  const rueckgaengig = useCallback(() => {
    const letzter = rueckStand.current.at(-1);
    if (!letzter) return;
    setRueck((r) => r.slice(0, -1));
    setLayout(letzter);
    sichern(letzter);
    setAnsage("Rückgängig gemacht.");
  }, [sichern]);

  const an = useCallback(() => {
    setRueck([]);
    setBearbeiten(true);
    setAnsage("Bearbeiten-Modus. Bausteine lassen sich verschieben, in der Breite ändern und ausblenden.");
    fokusNach.current = "[data-griff]";
    track("hub_anordnen_geoeffnet");
  }, []);

  const aus = useCallback(() => {
    setBearbeiten(false);
    setAnsage("Anordnung gespeichert.");
    if (suche.get("anordnen") !== null) {
      const p = new URLSearchParams(suche.toString());
      p.delete("anordnen");
      router.replace(p.size ? `${pfad}?${p}` : pfad, { scroll: false });
    }
  }, [pfad, router, suche]);

  // Start über die Kopfleiste, die Befehlspalette oder den Link „/?anordnen“ aus den Einstellungen
  useEffect(() => {
    window.addEventListener(HUB_ANORDNEN, an);
    return () => window.removeEventListener(HUB_ANORDNEN, an);
  }, [an]);
  const sollAn = suche.get("anordnen") !== null;
  useEffect(() => {
    if (!sollAn) return;
    const id = window.setTimeout(an, 0);
    return () => window.clearTimeout(id);
  }, [sollAn, an]);

  // Die Kopfleiste blendet „Anpassen“ aus, solange angeordnet wird
  useEffect(() => {
    if (bearbeiten) document.documentElement.dataset.hubBearbeiten = "";
    else delete document.documentElement.dataset.hubBearbeiten;
    return () => {
      delete document.documentElement.dataset.hubBearbeiten;
    };
  }, [bearbeiten]);

  useEffect(() => {
    if (!bearbeiten) return;
    const taste = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        rueckgaengig();
      }
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [bearbeiten, rueckgaengig]);

  const schluessel = `${bearbeiten}|${JSON.stringify(layout)}`;
  useGleiten(box, schluessel);
  useLayoutEffect(() => {
    // Beim Umsortieren hängt der Browser den Knoten um und nimmt ihm den Fokus: zurückgeben.
    const ziel = zieht ? `[data-griff="${zieht}"]` : fokusNach.current;
    if (!ziel) return;
    fokusNach.current = null;
    const el = box.current?.querySelector<HTMLElement>(ziel);
    if (!el) return;
    if (document.activeElement !== el) el.focus({ preventScroll: true });
    if (!zieht || !geist) el.scrollIntoView({ block: "nearest" });
  }, [schluessel, zieht, geist]);

  /**
   * Tastatur: Jede Pfeiltaste rückt den aufgenommenen Baustein um einen Platz in der Reihenfolge.
   * Das ist bei verschieden großen Bausteinen verlässlicher als das Springen nach Koordinaten.
   * Die Koordinaten bleiben stehen; sichtbar wandert der hervorgehobene Baustein selbst.
   */
  const mitTastatur = useRef(false);
  const tastenSchritt = useRef<KeyboardCoordinateGetter>(() => undefined);
  useEffect(() => {
    tastenSchritt.current = (e, { active, currentCoordinates }) => {
      const richtung = ZURUECK_TASTEN.includes(e.code) ? -1 : VOR_TASTEN.includes(e.code) ? 1 : 0;
      if (!richtung) return undefined;
      e.preventDefault();
      const neu = verschieben(stand.current, active as BausteinId, richtung);
      if (neu) {
        const reihe = sichtbare(neu);
        stand.current = neu;
        setLayout(neu);
        setAnsage(`Position ${reihe.indexOf(active as BausteinId) + 1} von ${reihe.length}.`);
      }
      return currentCoordinates;
    };
  }, []);
  const koordinaten = useCallback<KeyboardCoordinateGetter>((e, args) => tastenSchritt.current(e, args), []);
  const sensoren = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: koordinaten }));

  const ids = sichtbare(layout);
  const stelle = (id: unknown) => `Position ${ids.indexOf(id as BausteinId) + 1} von ${ids.length}`;
  const nameVon = (id: unknown) => BAUSTEIN_NAMEN[id as BausteinId];
  const ansagen: Announcements = {
    onDragStart: ({ active }) => `${nameVon(active.id)} aufgenommen. ${stelle(active.id)}. Pfeiltasten verschieben, Leertaste legt ab, Escape bricht ab.`,
    onDragOver: () => undefined,
    onDragEnd: ({ active }) => `${nameVon(active.id)} abgelegt auf ${stelle(active.id)}.`,
    onDragCancel: ({ active }) => `Abgebrochen. ${nameVon(active.id)} ist wieder an seinem Platz.`,
  };

  const ziehStart = ({ active, activatorEvent }: DragStartEvent) => {
    const tastatur = activatorEvent instanceof KeyboardEvent;
    mitTastatur.current = tastatur;
    setGeist(!tastatur);
    vorZiehen.current = kopie(stand.current);
    setZieht(active.id as BausteinId);
  };
  const ziehUeber = ({ active, over }: DragOverEvent) => {
    if (mitTastatur.current || !over || over.id === active.id) return;
    const neu = umsetzen(stand.current, active.id as BausteinId, over.id as BausteinId);
    const reihe = sichtbare(neu);
    stand.current = neu;
    setLayout(neu);
    setAnsage(`Position ${reihe.indexOf(active.id as BausteinId) + 1} von ${reihe.length}.`);
  };
  const ziehEnde = ({ active }: DragEndEvent) => {
    const davor = vorZiehen.current;
    vorZiehen.current = null;
    setZieht(null);
    fokusNach.current = `[data-griff="${active.id}"]`;
    if (!davor || gleich(davor, stand.current)) return;
    setRueck((r) => [...r.slice(1 - MAX_RUECKGAENGIG), davor]);
    sichern(stand.current);
  };
  const ziehAbbruch = () => {
    if (vorZiehen.current) {
      stand.current = vorZiehen.current;
      setLayout(vorZiehen.current);
    }
    vorZiehen.current = null;
    setZieht(null);
  };

  const plan = rasterPlan(layout);
  const ausgeblendet = layout.filter(([, sichtbar]) => !sichtbar).map(([id]) => id);
  const vorein = voreinstellungVon(layout);

  const raster = (
    <div className={`hubraster${bearbeiten ? " im-bearb" : ""}`}>
      {plan.map((p, i) => (
        <Block
          key={p.id}
          platz={p}
          position={i}
          anzahl={plan.length}
          bearbeiten={bearbeiten}
          zieht={zieht === p.id}
          d={d}
          onGroesse={(g) => aendern(groesseSetzen(layout, p.id, g), `${BAUSTEIN_NAMEN[p.id]} ist jetzt ${GROESSEN_NAMEN[g]}.`)}
          onSchieben={(r) => {
            const neuePosition = i + r;
            // Am Rand wird der gedrückte Pfeil gesperrt: Fokus auf den anderen Pfeil.
            const amRand = neuePosition === 0 || neuePosition === plan.length - 1;
            aendern(
              verschieben(layout, p.id, r),
              `${BAUSTEIN_NAMEN[p.id]}, Position ${neuePosition + 1} von ${plan.length}.`,
              `[data-id="${p.id}"] [data-schieb="${amRand ? -r : r}"]`,
            );
          }}
          onAusblenden={() => aendern(sichtbarSetzen(layout, p.id, false), `${BAUSTEIN_NAMEN[p.id]} ausgeblendet.`, "#hub-fertig")}
        />
      ))}
    </div>
  );

  return (
    <div className="hubbox" ref={box}>
      <p className="vh" role="status" aria-live="polite">
        {ansage}
      </p>

      {bearbeiten && (
        <div className="bearbleiste">
          <div>
            <strong>Hub anordnen</strong>
            <span>{fehler ? "Speichern hat nicht geklappt. Die Anordnung gilt nur, bis du die Seite neu lädst." : "Am Griff ziehen oder mit Pfeilen verschieben. Breite über S, M und L."}</span>
          </div>
          <div className="segment" role="group" aria-label="Voreinstellung">
            {(Object.keys(VOREINSTELLUNGEN) as Voreinstellung[]).map((k) => (
              <button key={k} type="button" aria-pressed={vorein === k} onClick={() => aendern(kopie(VOREINSTELLUNGEN[k]), `Voreinstellung ${VOREINSTELLUNG_NAMEN[k]}.`)}>
                {VOREINSTELLUNG_NAMEN[k]}
              </button>
            ))}
          </div>
          <button type="button" className="knopf leise klein" disabled={!rueck.length} onClick={rueckgaengig}>
            {I.strich(ZURUECK)}
            Rückgängig
          </button>
          <button type="button" className="knopf haupt klein" id="hub-fertig" onClick={aus}>
            Fertig
          </button>
        </div>
      )}

      {!bearbeiten && plan.length === 0 ? (
        <div className="zustand">
          <h1>Alle Bausteine sind ausgeblendet.</h1>
          <p>Über „Anpassen“ holst du sie zurück.</p>
          <button type="button" className="knopf neben" onClick={an}>
            Hub anpassen
          </button>
        </div>
      ) : (
        <DndContext
          id="hub-raster"
          sensors={sensoren}
          collisionDetection={kollision}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          accessibility={{
            announcements: ansagen,
            screenReaderInstructions: { draggable: "Leertaste nimmt den Baustein auf. Pfeiltasten verschieben ihn, Leertaste legt ihn ab, Escape bricht ab." },
          }}
          onDragStart={ziehStart}
          onDragOver={ziehUeber}
          onDragEnd={ziehEnde}
          onDragCancel={ziehAbbruch}
        >
          <SortableContext items={ids} strategy={() => null}>
            {raster}
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {zieht && geist ? (
              <div className="geist">
                {I.griff}
                <span>
                  {BAUSTEIN_NAMEN[zieht]}, Breite {layout.find(([id]) => id === zieht)?.[2]}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {bearbeiten && (
        <div className="ablage" aria-label="Ausgeblendete Bausteine">
          <span className="info">{ausgeblendet.length ? "Ausgeblendet" : "Alle Bausteine sind sichtbar."}</span>
          {ausgeblendet.map((id) => (
            <button
              key={id}
              type="button"
              className="knopf leise klein"
              onClick={() => aendern(sichtbarSetzen(layout, id, true), `${BAUSTEIN_NAMEN[id]} wieder eingeblendet.`, `[data-griff="${id}"]`)}
            >
              {I.strich(PLUS)}
              {BAUSTEIN_NAMEN[id]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
