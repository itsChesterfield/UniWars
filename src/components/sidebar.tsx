"use client";

import { NavMond } from "@/components/bewegung/nav-mond";
import { Fragment, Suspense, useEffect, useId, useRef, useState, useTransition, type DragEvent } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { AssistentStarter } from "@/components/assistent/assistent-starter";
import { Befehlspalette } from "@/components/befehlspalette";
import { AllesRaster, allesOeffnen } from "@/components/alles-raster";
import { SCHNELL_ERFASSEN } from "@/components/quick-add";
import { InaktivitaetsWaechter } from "@/components/inaktivitaet-waechter";
import { Rueckfrage } from "@/components/rueckfrage";
import { Meldung } from "@/components/meldung";
import { TimerWaechter } from "@/components/work-station/timer-waechter";
import { ChatPunkt } from "@/components/chat/chat-punkt";
import { ProfilAvatar, avatarName } from "@/components/profil-avatar";
import { Icon, NavIcon } from "@/components/nav-icon";
import { studioOeffnen } from "@/lib/ki/studio-kontext";
import { useTimerZustand } from "@/lib/work-station/timer-store";
import { KURZNAMEN, hubVonId, hubsInGruppen } from "@/lib/hubs/navigation";
import { BEREICHE } from "@/lib/dashboard-bereiche";
import { HUB_DRAG_TYP } from "@/lib/geteilte-ansicht";
import { logout } from "@/app/logout/actions";
import { abmelden, track } from "@/lib/analytics";
import type { Enums } from "@/lib/supabase/types";
import { NACH_OBEN, NACH_UNTEN } from "@/components/bereich-uebergang";
import { designWaehlen, usePersoenlich, useSystemDunkel } from "@/lib/personalisierung-store";
import { DESIGN_NAMEN, bereichHref, sichtbaresDesign, tabLeiste, type Symbolleiste } from "@/lib/personalisierung";

/** Gleicher Schlüssel wie im Skript in app/layout.tsx. Die Symbolleiste ist immer schmal; der Schlüssel bleibt für ältere Browserstände. */
export const SIDEBAR_SCHLUESSEL = "uniwars-sidebar-eingeklappt";
/**
 * Meldet eine laufende Navigation an <html data-laedt>. Die Kopfleiste zeigt dann
 * nach 300 ms die Lichtspur, die alte Ansicht bleibt stehen (DESIGN.md Abschnitt 7).
 */
function LadeMelder() {
  const { pending } = useLinkStatus();
  useEffect(() => {
    if (!pending) return;
    document.documentElement.setAttribute("data-laedt", "");
    return () => document.documentElement.removeAttribute("data-laedt");
  }, [pending]);
  return null;
}

/** Hub-Symbol an den Rand ziehen → geteilte Ansicht (siehe GeteilteAnsicht). */
function hubZiehen(e: DragEvent, href: string) {
  e.dataTransfer.setData(HUB_DRAG_TYP, href);
  e.dataTransfer.setData("text/uri-list", new URL(href, window.location.origin).toString());
  e.dataTransfer.effectAllowed = "copyLink";
}

/** Punkt am Work-Station-Symbol, solange ein Fokus-Timer läuft oder pausiert ist. */
function TimerPunkt() {
  const zustand = useTimerZustand();
  if (!zustand || (!zustand.laeuft && zustand.restMs === zustand.dauerMs)) return null;
  return <span className="badge" aria-hidden />;
}

function Funke() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3.5l1.8 4.7 4.7 1.8-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.8Z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" />
    </svg>
  );
}

function ProfilMenue({ name, email, avatarUrl, theme }: { name: string; email: string; avatarUrl: string | null; theme: Enums<"theme"> }) {
  const [offen, setOffen] = useState(false);
  const [laeuft, starte] = useTransition();
  const menueId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const knopf = useRef<HTMLButtonElement>(null);
  // Gewechselt wird zum anderen der beiden Designs; „Wie das System“ zählt als das, was gerade zu sehen ist
  const anderes = sichtbaresDesign(usePersoenlich("theme", theme), useSystemDunkel()) === "DUNKEL" ? "HELL" : "DUNKEL";

  return (
    <div className="profilmenue">
      <button
        ref={knopf}
        type="button"
        className="rprofil"
        aria-haspopup="dialog"
        aria-expanded={offen}
        aria-controls={menueId}
        aria-label={avatarName(name, avatarUrl, `Profil, ${name}`)}
        onClick={() => {
          if (dialog.current?.open) return;
          dialog.current?.showModal();
          setOffen(true);
        }}
      >
        <ProfilAvatar name={name} url={avatarUrl} groesse={28} />
        <span className="rprofil-name" aria-hidden>
          {name}
        </span>
      </button>
      <dialog
        ref={dialog}
        id={menueId}
        className="menue"
        aria-label="Profil"
        onClose={() => {
          setOffen(false);
          knopf.current?.focus();
        }}
        onClick={(e) => {
          if (e.target !== e.currentTarget) return;
          const rand = e.currentTarget.getBoundingClientRect();
          if (e.clientX < rand.left || e.clientX > rand.right || e.clientY < rand.top || e.clientY > rand.bottom) {
            e.currentTarget.close();
          }
        }}
      >
        <div className="menue-kopf">
          <ProfilAvatar name={name} url={avatarUrl} groesse={32} />
          <span>
            <b>{name}</b>
            <small>{email}</small>
          </span>
        </div>
        <Link href="/einstellungen/personalisierung" className="menue-eintrag" onNavigate={() => dialog.current?.close()}>
          Personalisierung
        </Link>
        <button
          type="button"
          className="menue-eintrag"
          disabled={laeuft}
          onClick={() =>
            starte(async () => {
              track("theme_gewechselt", { theme: anderes, ort: "profilmenue" });
              await designWaehlen(anderes);
            })
          }
        >
          {DESIGN_NAMEN[anderes]} verwenden
        </button>
        <Link href="/einstellungen" className="menue-eintrag" onNavigate={() => dialog.current?.close()}>
          Einstellungen
        </Link>
        <form action={logout} className="menue-trenn">
          <button type="submit" className="menue-eintrag" onClick={() => abmelden()}>
            Abmelden
          </button>
        </form>
      </dialog>
    </div>
  );
}

/**
 * Design B3: schmale Symbolleiste links (Desktop) und Tab-Leiste unten (Handy).
 * Der Name bleibt "Sidebar", damit beide Gerüste (Hubs und Zentraler Hub) sie unverändert einbinden.
 */
export function Sidebar({
  userId,
  name,
  email,
  avatarUrl = null,
  theme = "HELL",
  symbolleiste,
  kiVerfuegbar = false,
}: {
  userId: string;
  /** Anzeigename (Nutzername) */
  name: string;
  email: string;
  avatarUrl?: string | null;
  theme?: Enums<"theme">;
  /** Reihenfolge und ausgeblendete Bereiche (Personalisierung) */
  symbolleiste: Symbolleiste;
  /** KI-12: Mistral-Key gesetzt → Knopf für UniVerse Studio (Strg+J) */
  kiVerfuegbar?: boolean;
}) {
  const pfad = usePathname();
  const [zuNachKlick, setZuNachKlick] = useState(false);
  const leiste = usePersoenlich("symbolleiste", symbolleiste);
  const gruppen = hubsInGruppen(leiste);
  /** Reihenfolge der Symbolleiste, für die Richtung des Übergangs */
  const reihe = gruppen.flatMap((g) => g.hubs.map((h) => h.href));
  const tabs = tabLeiste(leiste).map((id) => ({ id, href: bereichHref(id), hub: hubVonId(id) }));
  // Die Bereiche des Zentralen Hubs (Termine, Noten …) gehören zum Zentralen Hub
  const istAktiv = (href: string) =>
    href === "/" ? BEREICHE.some((b) => b.href === pfad) : pfad === href || pfad.startsWith(`${href}/`);
  const mobilAktiv = tabs.some((m) => istAktiv(m.href));
  const aktuell = reihe.findIndex((href) => istAktiv(href));
  // Ziel unter dem aktuellen Bereich → neue Ansicht kommt von unten, sonst von oben
  const richtung = (href: string) => [reihe.indexOf(href) > aktuell ? NACH_UNTEN : NACH_OBEN];
  const tab = (m: (typeof tabs)[number]) => (
    <Link
      key={m.href}
      href={m.href}
      aria-current={istAktiv(m.href) ? "page" : undefined}
      transitionTypes={istAktiv(m.href) ? undefined : richtung(m.href)}
    >
      <LadeMelder />
      {m.hub && <NavIcon path={m.hub.icon} groesse={20} />}
      {KURZNAMEN[m.id] ?? m.hub?.name}
    </Link>
  );

  return (
    <>
      <nav
        className="rail"
        aria-label="Bereiche"
        data-zu={zuNachKlick ? "" : undefined}
        // Nach einem Klick klappt die Leiste zu und bleibt zu, bis die Maus sie verlässt
        onClick={(e) => {
          // Nicht beim Profil-Knopf: Dessen Menü soll offen bleiben
          const ziel = (e.target as HTMLElement).closest("a, button");
          if (ziel && !ziel.closest(".profilmenue")) setZuNachKlick(true);
        }}
        onMouseLeave={() => setZuNachKlick(false)}
      >
        <TimerWaechter />
        <NavMond schluessel={`${pfad}|${reihe.join(",")}`} />
        <Link href="/" className="rmarke" aria-label="UniVerse, Zentraler Hub">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="4.5" />
            <path d="M3.5 14.5c2.5 3.5 14.5-1.5 17-6" />
          </svg>
        </Link>

        {gruppen.map((gruppe, gi) => (
          <Fragment key={gruppe.name}>
            {gi > 0 && <span className="rtrenn" aria-hidden />}
            <ul className="rgruppe" aria-label={gruppe.name}>
              {gruppe.hubs.map((hub) => {
                const aktiv = istAktiv(hub.href);
                return (
                  <li key={hub.href}>
                    <Link
                      href={hub.href}
                      className="rpunkt"
                      aria-label={hub.name}
                      aria-current={aktiv ? "page" : undefined}
                      draggable
                      onDragStart={(e) => hubZiehen(e, hub.href)}
                      transitionTypes={aktiv ? undefined : richtung(hub.href)}
                    >
                      <LadeMelder />
                      <NavIcon path={hub.icon} />
                      {hub.href === "/work-station" && <TimerPunkt />}
                      {hub.href === "/chat" && <ChatPunkt />}
                      <span className="tip" aria-hidden>
                        {hub.name}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Fragment>
        ))}

        <div className="rfuss">
          {kiVerfuegbar && (
            <button type="button" className="rpunkt" aria-label="UniVerse Studio, Strg+J" onClick={() => studioOeffnen()}>
              <Funke />
              <span className="tip" aria-hidden>
                UniVerse Studio <kbd>Strg</kbd> <kbd>J</kbd>
              </span>
            </button>
          )}
          <Link
            href="/einstellungen"
            className="rpunkt"
            aria-label="Einstellungen"
            aria-current={pfad.startsWith("/einstellungen") ? "page" : undefined}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
            </svg>
            <span className="tip" aria-hidden>
              Einstellungen
            </span>
          </Link>
          <ProfilMenue name={name} email={email} avatarUrl={avatarUrl} theme={theme} />
        </div>
      </nav>

      <nav className="mobilnav" aria-label="Bereiche">
        {tabs.slice(0, 2).map(tab)}
        <button
          type="button"
          className="mobilnav-plus"
          onClick={() => window.dispatchEvent(new CustomEvent(SCHNELL_ERFASSEN, { detail: { quelle: "tableiste" } }))}
        >
          <span className="mobilnav-plus-flaeche" aria-hidden>
            <Icon name="plus" groesse={20} />
          </span>
          Erfassen
        </button>
        {tabs.slice(2).map(tab)}
        <button type="button" aria-haspopup="dialog" onClick={() => allesOeffnen()} aria-current={mobilAktiv ? undefined : "page"}>
          <Icon name="menue" groesse={20} />
          Alles
        </button>
      </nav>
      <AllesRaster leiste={leiste} kiVerfuegbar={kiVerfuegbar} />

      {kiVerfuegbar && (
        <Suspense fallback={null}>
          <AssistentStarter />
        </Suspense>
      )}
      <Befehlspalette userId={userId} kiVerfuegbar={kiVerfuegbar} theme={theme} />
      <InaktivitaetsWaechter />
      <Rueckfrage />
      <Meldung />
    </>
  );
}
