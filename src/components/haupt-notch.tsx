"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, type MouseEvent } from "react";
import { useSearchParams } from "next/navigation";
import { BEREICHE, type Bereich } from "@/lib/dashboard-bereiche";
import { flugBilder, nachbar, pfeilFuerNotch, type Lage } from "@/lib/bewegung/notch";
import { bewegungReduziert } from "@/lib/personalisierung-store";

/**
 * Notch des Zentralen Hubs: schmale Leiste oben mit den Bereichen.
 * Alle Bereiche sind schon geladen – ein Klick blendet nur um und ändert die Adresse
 * (window.history.pushState, von Next.js mitverfolgt), ohne neuen Server-Aufruf.
 * Zurück-Taste, Lesezeichen und „In neuem Tab öffnen“ funktionieren wie bei echten Seiten.
 * Ein gesetzter Fach-Filter bleibt beim Wechsel erhalten.
 *
 * Seit der Hub-Bühne (Didi, 18.11.): ← und → wechseln den Bereich, solange der Fokus nicht in einem Feld oder
 * einem Bedienelement mit eigenen Pfeilen liegt. Die Markierung fliegt mit vorauseilender Kante zum Ziel;
 * `html[data-notch-richtung]` sagt dem neuen Bereich, aus welcher Richtung er sich aufbaut.
 */
export function HauptNotch({ aktiv }: { aktiv: Bereich }) {
  const fachId = useSearchParams().get("fachId");
  const leiste = useRef<HTMLElement>(null);
  const marke = useRef<HTMLSpanElement>(null);
  const letzte = useRef<Lage | null>(null);
  const index = BEREICHE.findIndex((b) => b.bereich === aktiv);

  // Tab-Titel passend zum Bereich, auch bei Zurück/Vor
  useEffect(() => {
    const b = BEREICHE.find((x) => x.bereich === aktiv);
    document.title = !b || b.bereich === "uebersicht" ? "UniVerse" : `${b.name} · UniVerse`;
  }, [aktiv]);

  const hrefVon = useCallback(
    (b: (typeof BEREICHE)[number]) => (fachId && b.bereich !== "fortschritt" && b.bereich !== "faecher" ? `${b.href}?fachId=${encodeURIComponent(fachId)}` : b.href),
    [fachId],
  );

  const gehen = useCallback(
    (ziel: number) => {
      if (ziel === index) return;
      document.documentElement.dataset.notchRichtung = ziel > index ? "vor" : "zurueck";
      window.history.pushState(null, "", hrefVon(BEREICHE[ziel]));
    },
    [index, hrefVon],
  );

  function wechseln(e: MouseEvent<HTMLAnchorElement>, ziel: number) {
    // Strg/Cmd/Shift/Mittelklick: normales Verhalten (neuer Tab usw.)
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    gehen(ziel);
  }

  // ← und → im ganzen Hub
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.defaultPrevented) return;
      const el = (e.target instanceof Element ? e.target : document.body) as HTMLElement;
      const ok = pfeilFuerNotch({
        tag: el.tagName,
        rolle: el.getAttribute("role"),
        bearbeitbar: el.isContentEditable,
        inDialog: !!el.closest("dialog[open], [role=dialog]") || !!document.querySelector("dialog[open]"),
        inSegment: !!el.closest(".segment, [role=tablist], [role=toolbar], [data-pfeile]"),
      });
      if (!ok) return;
      e.preventDefault();
      gehen(nachbar(index, e.key === "ArrowRight" ? 1 : -1, BEREICHE.length));
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [index, gehen]);

  // Markierung: messen, beim Wechsel fliegen, bei Größenänderung still nachziehen
  useLayoutEffect(() => {
    const nav = leiste.current;
    const m = marke.current;
    if (!nav || !m) return;
    const setzen = (fliegen: boolean) => {
      const a = nav.querySelector<HTMLElement>("a.an");
      if (!a) return;
      const neu: Lage = { x: a.offsetLeft, breite: a.offsetWidth };
      m.style.width = `${neu.breite}px`;
      m.style.height = `${a.offsetHeight}px`;
      m.style.top = `${a.offsetTop}px`;
      const alt = letzte.current;
      letzte.current = neu;
      m.style.transform = `translateX(${neu.x}px)`;
      // Am Handy scrollt die Notch waagerecht: gewählten Bereich ins Bild holen
      if (fliegen && nav.scrollWidth > nav.clientWidth) {
        const ziel = Math.max(0, Math.min(neu.x - (nav.clientWidth - neu.breite) / 2, nav.scrollWidth - nav.clientWidth));
        nav.scrollTo({ left: ziel, behavior: bewegungReduziert() ? "auto" : "smooth" });
      }
      if (fliegen && alt && alt.x !== neu.x && !bewegungReduziert() && m.animate) {
        m.animate(flugBilder(alt, neu), { duration: 420, easing: "cubic-bezier(.22,.9,.24,1)" });
      }
      nav.dataset.marke = "da";
    };
    setzen(true);
    const ro = new ResizeObserver(() => setzen(false));
    ro.observe(nav);
    return () => ro.disconnect();
  }, [aktiv]);

  // Am Handy scrollt die Notch waagerecht: Auslaufkante an der Seite, auf der noch Bereiche liegen (Wisch-Hinweis)
  useEffect(() => {
    const nav = leiste.current;
    if (!nav) return;
    const setzen = () => {
      const links = nav.scrollLeft > 2;
      const rechts = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2;
      const rand = links && rechts ? "beide" : links ? "links" : rechts ? "rechts" : "";
      if (rand) nav.dataset.rand = rand;
      else delete nav.dataset.rand;
    };
    setzen();
    nav.addEventListener("scroll", setzen, { passive: true });
    const ro = new ResizeObserver(setzen);
    ro.observe(nav);
    return () => {
      nav.removeEventListener("scroll", setzen);
      ro.disconnect();
    };
  }, []);

  return (
    <nav ref={leiste} className="haupt-notch" aria-label="Bereiche" title="Bereiche wechseln mit ← und →">
      <span ref={marke} className="haupt-notch-marke" aria-hidden="true" />
      {BEREICHE.map((b, i) => {
        const href = hrefVon(b);
        return (
          <Link
            key={b.bereich}
            href={href}
            prefetch={false}
            onClick={(e) => wechseln(e, i)}
            className={b.bereich === aktiv ? "an" : ""}
            aria-current={b.bereich === aktiv ? "page" : undefined}
          >
            {b.name}
          </Link>
        );
      })}
    </nav>
  );
}
