"use client";

import { useId, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { hubLayoutSpeichern } from "@/app/settings/actions";
import { NavIcon } from "@/components/nav-icon";
import { track } from "@/lib/analytics";
import { VOREINSTELLUNGEN, VOREINSTELLUNG_NAMEN, kopie, voreinstellungVon, type HubLayout, type Voreinstellung } from "@/lib/hub-layout";
import { hubVonId } from "@/lib/hubs/navigation";
import {
  DESIGN_NAMEN,
  bereichUmsetzen,
  bereichVerschieben,
  bereichZeigen,
  symbolleistenGruppen,
  type Darstellung,
  type Symbolleiste,
  type Theme,
} from "@/lib/personalisierung";
import { darstellungWaehlen, designWaehlen, symbolleisteWaehlen, usePersoenlich } from "@/lib/personalisierung-store";

const FEHLER = "Das hat nicht geklappt. Deine vorige Einstellung gilt weiter, versuch es bitte noch einmal.";

function Strich({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.split("|").map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

const GRIFF = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <circle cx="5.5" cy="3.5" r="1.3" />
    <circle cx="10.5" cy="3.5" r="1.3" />
    <circle cx="5.5" cy="8" r="1.3" />
    <circle cx="10.5" cy="8" r="1.3" />
    <circle cx="5.5" cy="12.5" r="1.3" />
    <circle cx="10.5" cy="12.5" r="1.3" />
  </svg>
);

function Abschnitt({ id, titel, text, children }: { id: string; titel: string; text: string; children: ReactNode }) {
  return (
    <section className="p-sek" aria-labelledby={`ps-${id}`}>
      <div className="p-kopf">
        <h2 id={`ps-${id}`}>{titel}</h2>
        <p>{text}</p>
      </div>
      <div className="p-inhalt">{children}</div>
    </section>
  );
}

function Zeile({ label, info, children }: { label: string; info?: string; children: ReactNode }) {
  return (
    <div className="p-zeile">
      <div>
        <span className="p-label">{label}</span>
        {info && <span className="p-info">{info}</span>}
      </div>
      {children}
    </div>
  );
}

function Segment<T extends string>({ label, wert, optionen, onWahl }: { label: string; wert: T | null; optionen: [T, string][]; onWahl: (w: T) => void }) {
  return (
    <div className="segment" role="group" aria-label={label}>
      {optionen.map(([w, n]) => (
        <button key={w} type="button" aria-pressed={wert === w} onClick={() => wert !== w && onWahl(w)}>
          {n}
        </button>
      ))}
    </div>
  );
}

/** Verkleinerte Ansicht eines Designs: Symbolleiste, Kontextspalte, Arbeitsfläche mit Hauptknopf. */
function Vorschau({ design, mini = false }: { design: "nacht" | "hochschule"; mini?: boolean }) {
  return (
    <span className={`dvorschau${mini ? " mini" : ""}`} data-theme={design} aria-hidden>
      {!mini && (
        <>
          <span className="dv-rail">
            <i />
            <i />
            <i />
          </span>
          <span className="dv-kontext">
            <i />
            <i />
            <i />
          </span>
        </>
      )}
      <span className="dv-flaeche">
        <i className="dv-titel" />
        <i />
        {!mini && <i />}
        <i className="dv-knopf" />
      </span>
    </span>
  );
}

/** Ein Bereich in der Liste der Symbolleiste: Griff, Pfeile, Schalter. */
function LeistenZeile({
  id,
  sichtbar,
  fest,
  erster,
  letzter,
  hilfeId,
  onSchieben,
  onZeigen,
}: {
  id: string;
  sichtbar: boolean;
  fest: boolean;
  erster: boolean;
  letzter: boolean;
  hilfeId: string;
  onSchieben: (r: -1 | 1) => void;
  onZeigen: (an: boolean) => void;
}) {
  const hub = hubVonId(id);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const name = hub?.name ?? id;
  const stil: CSSProperties = {
    // nur senkrecht: Bereiche bleiben in ihrer Gruppe
    transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)` : undefined,
    transition,
  };
  return (
    <li ref={setNodeRef} style={stil} data-id={id} className={isDragging ? "zieht" : undefined}>
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="griff"
        aria-label={`${name} verschieben`}
        {...attributes}
        aria-describedby={hilfeId}
        {...listeners}
      >
        {GRIFF}
      </button>
      {hub && <NavIcon path={hub.icon} groesse={16} />}
      <span className={`p-n${sichtbar ? "" : " aus"}`}>
        {name}
        {fest ? <small>Immer sichtbar</small> : !sichtbar ? <small>Über die Suche erreichbar</small> : null}
      </span>
      <button type="button" className="symbolknopf" aria-label={`${name} nach oben`} disabled={erster} onClick={() => onSchieben(-1)} data-schieb={`${id}:-1`}>
        <Strich d="M12 19V5|m6 11 6-6 6 6" />
      </button>
      <button type="button" className="symbolknopf" aria-label={`${name} nach unten`} disabled={letzter} onClick={() => onSchieben(1)} data-schieb={`${id}:1`}>
        <Strich d="M12 5v14|m18 13-6 6-6-6" />
      </button>
      <button
        type="button"
        className="schalter"
        role="switch"
        aria-checked={sichtbar}
        aria-label={`${name} in der Symbolleiste zeigen`}
        disabled={fest}
        onClick={() => onZeigen(!sichtbar)}
      />
    </li>
  );
}

function LeistenGruppe({
  name,
  eintraege,
  hilfeId,
  onUmsetzen,
  onSchieben,
  onZeigen,
}: {
  name: string;
  eintraege: { id: string; sichtbar: boolean; fest: boolean }[];
  hilfeId: string;
  onUmsetzen: (id: string, aufId: string) => void;
  onSchieben: (id: string, r: -1 | 1) => void;
  onZeigen: (id: string, an: boolean) => void;
}) {
  const sensoren = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = eintraege.map((e) => e.id);
  const titelId = useId();
  const nameVon = (id: unknown) => hubVonId(String(id))?.name ?? String(id);
  const stelle = (id: unknown) => `Platz ${ids.indexOf(String(id)) + 1} von ${ids.length}`;
  const ansagen: Announcements = {
    onDragStart: ({ active }) => `${nameVon(active.id)} aufgenommen, ${stelle(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${nameVon(active.id)} auf Platz ${ids.indexOf(String(over.id)) + 1} von ${ids.length}.` : undefined),
    onDragEnd: ({ active, over }) => `${nameVon(active.id)} abgelegt auf Platz ${ids.indexOf(String(over?.id ?? active.id)) + 1} von ${ids.length}.`,
    onDragCancel: ({ active }) => `Abgebrochen. ${nameVon(active.id)} bleibt an seinem Platz.`,
  };
  const ende = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onUmsetzen(String(active.id), String(over.id));
  };
  return (
    <>
      <h3 className="p-gruppe-t" id={titelId}>
        {name}
      </h3>
      <DndContext
        sensors={sensoren}
        collisionDetection={closestCenter}
        onDragEnd={ende}
        accessibility={{ announcements: ansagen, screenReaderInstructions: { draggable: "" } }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol className="p-liste" aria-labelledby={titelId}>
            {eintraege.map((e, i) => (
              <LeistenZeile
                key={e.id}
                {...e}
                erster={i === 0}
                letzter={i === eintraege.length - 1}
                hilfeId={hilfeId}
                onSchieben={(r) => onSchieben(e.id, r)}
                onZeigen={(an) => onZeigen(e.id, an)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </>
  );
}

/**
 * Design B3: Einstellungen › Personalisierung (DESIGN.md Abschnitt 6).
 * Jede Änderung gilt sofort und wird gespeichert. Klappt das Speichern nicht, springt die Wahl zurück.
 */
export function Personalisierung({
  theme,
  darstellung,
  symbolleiste,
  hubLayout,
}: {
  theme: Theme;
  darstellung: Darstellung;
  symbolleiste: Symbolleiste;
  hubLayout: HubLayout;
}) {
  const design = usePersoenlich("theme", theme);
  const d = usePersoenlich("darstellung", darstellung);
  const leiste = usePersoenlich("symbolleiste", symbolleiste);
  const [hub, setHub] = useState<HubLayout>(hubLayout);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ansage, setAnsage] = useState("");
  const [, starte] = useTransition();
  const hilfeId = useId();

  function ausfuehren(aktion: () => Promise<boolean>, text?: string, danach?: () => void) {
    setFehler(null);
    if (text) setAnsage(text);
    starte(async () => {
      const ok = await aktion();
      if (!ok) setFehler(FEHLER);
      else danach?.();
    });
  }

  const darstellungSetzen = <K extends keyof Darstellung>(k: K, w: Darstellung[K]) => {
    track("darstellung_geaendert", { [k]: String(w) });
    ausfuehren(() => darstellungWaehlen({ ...d, [k]: w }));
  };

  const leisteSetzen = (neu: Symbolleiste | null, text: string, fokus?: string) => {
    if (!neu) return;
    track("symbolleiste_geaendert");
    ausfuehren(() => symbolleisteWaehlen(neu), text);
    // Am Rand ist der gedrückte Pfeil gesperrt: Fokus auf den anderen Pfeil derselben Zeile
    if (fokus) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-schieb="${fokus}"]:not(:disabled)`)?.focus());
  };

  const voreinstellung = voreinstellungVon(hub);
  const name = (id: string) => hubVonId(id)?.name ?? id;

  return (
    <div className="pers">
      <p className="vh" aria-live="polite">
        {ansage}
      </p>

      <Abschnitt id="design" titel="Design" text="Zwei ruhige Designs. Mit „Wie das System“ wechselt UniVerse mit deinem Gerät zwischen hell und dunkel.">
        <div className="designkarten" role="group" aria-label="Design">
          {(
            [
              ["DUNKEL", "Dunkel, Akzent Gold", <Vorschau key="n" design="nacht" />],
              ["HELL", "Hell, Akzent Blau", <Vorschau key="h" design="hochschule" />],
              [
                "SYSTEM",
                "Hell Hochschule, dunkel Sternenhimmel",
                <span key="s" className="dv-paar">
                  <Vorschau design="hochschule" mini />
                  <Vorschau design="nacht" mini />
                </span>,
              ],
            ] as [Theme, string, ReactNode][]
          ).map(([t, info, bild]) => (
            <button
              key={t}
              type="button"
              className="designkarte"
              aria-pressed={design === t}
              onClick={() => {
                if (design === t) return;
                track("theme_gewechselt", { theme: t, ort: "personalisierung" });
                ausfuehren(() => designWaehlen(t), `${DESIGN_NAMEN[t]} gewählt.`);
              }}
            >
              {bild}
              <span className="dk-name">{DESIGN_NAMEN[t]}</span>
              <span className="dk-info">{info}</span>
            </button>
          ))}
        </div>
        <Zeile label="Design-Schalter in der Kopfleiste" info="Sonst wechselst du über das Profil-Menü oder die Suche.">
          <button
            type="button"
            className="schalter"
            role="switch"
            aria-checked={d.design_schalter}
            aria-label="Design-Schalter in der Kopfleiste zeigen"
            onClick={() => darstellungSetzen("design_schalter", !d.design_schalter)}
          />
        </Zeile>
      </Abschnitt>

      <Abschnitt id="hub" titel="Zentraler Hub" text="Welche Bausteine der Hub zeigt, in welcher Reihenfolge und wie breit.">
        <Zeile label="Voreinstellung" info={voreinstellung ? undefined : "Gerade gilt deine eigene Anordnung."}>
          <Segment
            label="Voreinstellung des Hubs"
            wert={voreinstellung}
            optionen={(Object.keys(VOREINSTELLUNG_NAMEN) as Voreinstellung[]).map((k) => [k, VOREINSTELLUNG_NAMEN[k]])}
            onWahl={(v: Voreinstellung) => {
              const vorher = hub;
              const neu = kopie(VOREINSTELLUNGEN[v]);
              setHub(neu);
              track("hub_voreinstellung", { voreinstellung: v, ort: "personalisierung" });
              ausfuehren(
                async () => {
                  const { ok } = await hubLayoutSpeichern(neu).catch(() => ({ ok: false }));
                  if (!ok) setHub(vorher);
                  return ok;
                },
                `Hub: ${VOREINSTELLUNG_NAMEN[v]}.`,
              );
            }}
          />
        </Zeile>
        <Zeile label="Eigene Anordnung" info="Verschieben, Breite ändern, ausblenden. Direkt im Hub.">
          <Link href="/?anordnen" className="knopf neben klein" onClick={() => track("hub_anordnen_gestartet", { ort: "personalisierung" })}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="4" y="4" width="7" height="7" rx="1.5" />
              <rect x="13" y="4" width="7" height="7" rx="1.5" />
              <rect x="4" y="13" width="16" height="7" rx="1.5" />
            </svg>
            Hub anordnen
          </Link>
        </Zeile>
      </Abschnitt>

      <Abschnitt
        id="leiste"
        titel="Symbolleiste"
        text="Reihenfolge innerhalb der Gruppen und welche Bereiche sichtbar sind. Die ersten vier sichtbaren stehen am Handy in der Tab-Leiste."
      >
        <p className="vh" id={hilfeId}>
          Leertaste nimmt den Bereich auf. Pfeiltasten verschieben ihn innerhalb der Gruppe, Leertaste legt ihn ab, Escape bricht ab.
        </p>
        <div className="p-leiste">
          {symbolleistenGruppen(leiste).map((g) => (
            <LeistenGruppe
              key={g.name}
              name={g.name}
              eintraege={g.eintraege}
              hilfeId={hilfeId}
              onUmsetzen={(id, aufId) => leisteSetzen(bereichUmsetzen(leiste, id, aufId), `${name(id)} verschoben.`)}
              onSchieben={(id, r) => {
                const neu = bereichVerschieben(leiste, id, r);
                const platz = neu ? g.eintraege.findIndex((e) => e.id === id) + r : 0;
                leisteSetzen(neu, `${name(id)} auf Platz ${platz + 1} von ${g.eintraege.length}.`, `${id}:${-r}`);
              }}
              onZeigen={(id, an) =>
                leisteSetzen(bereichZeigen(leiste, id, an), an ? `${name(id)} ist wieder sichtbar.` : `${name(id)} ausgeblendet. Über die Suche bleibt der Bereich erreichbar.`)
              }
            />
          ))}
        </div>
      </Abschnitt>

      <Abschnitt id="darstellung" titel="Darstellung" text="Gilt nur für dich, auch wenn du später ein geteiltes Design übernimmst.">
        <Zeile label="Schriftgröße">
          <Segment label="Schriftgröße" wert={d.schrift} optionen={[["normal", "Normal"], ["gross", "Groß"]]} onWahl={(w) => darstellungSetzen("schrift", w)} />
        </Zeile>
        <Zeile label="Dichte" info="Kompakt rückt Abstände enger zusammen.">
          <Segment label="Dichte" wert={d.dichte} optionen={[["normal", "Normal"], ["kompakt", "Kompakt"]]} onWahl={(w) => darstellungSetzen("dichte", w)} />
        </Zeile>
        <Zeile label="Bewegung" info="Reduziert heißt: nur Überblenden, nichts gleitet.">
          <Segment
            label="Bewegung"
            wert={d.bewegung}
            optionen={[["system", "Wie das System"], ["reduziert", "Reduziert"]]}
            onWahl={(w) => darstellungSetzen("bewegung", w)}
          />
        </Zeile>
      </Abschnitt>

      {/* unten am Rand, damit die Meldung auch nach dem Scrollen zu sehen ist */}
      {fehler && (
        <p className="p-meldung" role="alert">
          <span>{fehler}</span>
          <button type="button" className="knopf leise klein" onClick={() => setFehler(null)}>
            Schließen
          </button>
        </p>
      )}
    </div>
  );
}
