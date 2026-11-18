"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { CALLOUTS, type CalloutTyp } from "@/components/notizen/editor-erweiterungen";
import { zielText } from "@/lib/notizen/wikilinks";
import { browserWertSchreiben, useBrowserWert } from "@/lib/browser-wert";
import { Icon as Zeichen } from "@/components/nav-icon";

export type LinkZiel = { id: string; name: string; art: "notiz" | "pdf" };

type Registerkarte = "start" | "einfuegen" | "absatz" | "tabelle";
const TAB_SCHLUESSEL = "uniwars-notiz-leiste-tab";
const EINGEKLAPPT_SCHLUESSEL = "uniwars-notiz-leiste-zu";

const SCHRIFTFARBEN = ["#1f2937", "#6b7280", "#b91c1c", "#c2410c", "#a16207", "#15803d", "#0369a1", "#1d4ed8", "#7e22ce", "#be185d"];
const MARKERFARBEN = ["#fef08a", "#bbf7d0", "#bae6fd", "#fbcfe8", "#fed7aa", "#ddd6fe", "#e5e7eb"];
const SCHRIFTGROESSEN = [
  { wert: "", name: "Normal" },
  { wert: "0.8em", name: "Klein" },
  { wert: "1.2em", name: "Groß" },
  { wert: "1.5em", name: "Sehr groß" },
  { wert: "2em", name: "Riesig" },
];
const SCHRIFTARTEN = [
  { wert: "", name: "Standard" },
  { wert: "Georgia, serif", name: "Serif" },
  { wert: "ui-monospace, monospace", name: "Monospace" },
  { wert: "'Comic Sans MS', 'Comic Neue', cursive", name: "Handschrift" },
];

type Absatz = "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "zitat" | "code";
const ABSATZFORMATE: { wert: Absatz; name: string }[] = [
  { wert: "p", name: "Standard" },
  { wert: "h1", name: "Überschrift 1" },
  { wert: "h2", name: "Überschrift 2" },
  { wert: "h3", name: "Überschrift 3" },
  { wert: "h4", name: "Überschrift 4" },
  { wert: "h5", name: "Überschrift 5" },
  { wert: "h6", name: "Überschrift 6" },
  { wert: "zitat", name: "Zitat" },
  { wert: "code", name: "Code" },
];

function absatzSetzen(editor: Editor, wert: Absatz) {
  const kette = editor.chain().focus();
  if (wert === "p") kette.setParagraph().run();
  else if (wert === "zitat") (editor.isActive("blockquote") ? kette.lift("blockquote") : kette.setParagraph().setBlockquote()).run();
  else if (wert === "code") kette.toggleCodeBlock().run();
  else kette.setHeading({ level: Number(wert.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
}

function Knopf({
  titel,
  aktiv = false,
  deaktiviert = false,
  onClick,
  children,
  breit = false,
}: {
  titel: string;
  aktiv?: boolean;
  deaktiviert?: boolean;
  onClick: () => void;
  children: ReactNode;
  breit?: boolean;
}) {
  return (
    <button
      type="button"
      title={titel}
      aria-pressed={aktiv}
      disabled={deaktiviert}
      className={`wz-knopf ${aktiv ? "an" : ""} ${breit ? "breit" : ""}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {/* Name aus dem Text (WCAG 2.5.3): Sichtbares nur für Sehende, der Name für Screenreader */}
      <span aria-hidden>{children}</span>
      <span className="sr-only">{titel}</span>
    </button>
  );
}

/** Knopf mit aufklappendem Feld (Farben, Tabellen, Eingaben) */
function Aufklapp({ titel, knopf, aktiv = false, children }: { titel: string; knopf: ReactNode; aktiv?: boolean; children: (zu: () => void) => ReactNode }) {
  const [offen, setOffen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!offen) return;
    const weg = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as globalThis.Node)) setOffen(false);
    };
    document.addEventListener("mousedown", weg);
    document.addEventListener("keydown", weg);
    return () => {
      document.removeEventListener("mousedown", weg);
      document.removeEventListener("keydown", weg);
    };
  }, [offen]);
  return (
    <div className="wz-aufklapp" ref={ref}>
      <button
        type="button"
        title={titel}
        aria-expanded={offen}
        className={`wz-knopf ${aktiv ? "an" : ""}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOffen((o) => !o)}
      >
        <span aria-hidden>{knopf}</span>
        <span className="sr-only">{titel}</span>
        <Zeichen name="runter" groesse={12} />
      </button>
      {offen && <div className="wz-feld">{children(() => setOffen(false))}</div>}
    </div>
  );
}

function Trenner() {
  return <span className="wz-trenner" aria-hidden />;
}

function Icon({ d, groesse = 16 }: { d: string; groesse?: number }) {
  return (
    <svg width={groesse} height={groesse} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.split("|").map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

const ICONS = {
  links: "M4 6h16|M4 10h10|M4 14h16|M4 18h10",
  mitte: "M4 6h16|M7 10h10|M4 14h16|M7 18h10",
  rechts: "M4 6h16|M10 10h10|M4 14h16|M10 18h10",
  block: "M4 6h16|M4 10h16|M4 14h16|M4 18h16",
  aufzaehlung: "M9 6h11|M9 12h11|M9 18h11|M4.5 6h.01|M4.5 12h.01|M4.5 18h.01",
  nummer: "M10 6h10|M10 12h10|M10 18h10|M4 5h1v4|M4 9h2|M6 18H4l2-2.5a1 1 0 0 0-2-.8",
  check: "M4 5h5v5H4z|m5 16 1.5 1.5L9 15|M13 7.5h7|M13 16.5h7",
  einzugPlus: "M3 6h18|M11 10h10|M11 14h10|M3 18h18|m3 9 3 3-3 3",
  einzugMinus: "M3 6h18|M11 10h10|M11 14h10|M3 18h18|M7 9l-3 3 3 3",
  linie: "M3 12h18",
  code: "m8 8-4 4 4 4|m16 8 4 4-4 4|m14 5-4 14",
  radierer: "m7 21-4-4L14 6l4 4-8 8|M7 21h13|m12 8 4 4",
};

/**
 * Werkzeugleiste wie in Word: alle Formatierungen zum Anklicken, gruppiert.
 * In Tabellen erscheint eine zweite Zeile für Zeilen/Spalten.
 */
export function Werkzeugleiste({
  editor,
  ziele,
  extra,
}: {
  editor: Editor;
  /** Notizen und PDFs für "Verlinken" */
  ziele: LinkZiel[];
  extra?: ReactNode;
}) {
  const z = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const stil = e.getAttributes("textStyle") as Record<string, string | undefined>;
      let absatz: Absatz = "p";
      for (let l = 1; l <= 6; l++) if (e.isActive("heading", { level: l })) absatz = `h${l}` as Absatz;
      if (e.isActive("codeBlock")) absatz = "code";
      else if (e.isActive("blockquote")) absatz = "zitat";
      return {
        absatz,
        fett: e.isActive("bold"),
        kursiv: e.isActive("italic"),
        unterstrichen: e.isActive("underline"),
        durch: e.isActive("strike"),
        hoch: e.isActive("superscript"),
        tief: e.isActive("subscript"),
        code: e.isActive("code"),
        link: e.isActive("link"),
        aufzaehlung: e.isActive("bulletList"),
        nummer: e.isActive("orderedList"),
        check: e.isActive("taskList"),
        callout: e.isActive("callout"),
        tabelle: e.isActive("table"),
        ausrichtung: (["center", "right", "justify"] as const).find((a) => e.isActive({ textAlign: a })) ?? "left",
        farbe: stil.color ?? null,
        hintergrund: stil.backgroundColor ?? null,
        groesse: stil.fontSize ?? "",
        schrift: stil.fontFamily ?? "",
        kannRueck: e.can().undo(),
        kannVor: e.can().redo(),
        inListe: e.isActive("listItem") || e.isActive("taskItem"),
      };
    },
  });

  const c = () => editor.chain().focus();
  const tabWahl = (useBrowserWert(TAB_SCHLUESSEL, "start") as Registerkarte) || "start";
  const eingeklappt = useBrowserWert(EINGEKLAPPT_SCHLUESSEL, "0") === "1";

  // Registerkarten wie in Word: nur eine Gruppe sichtbar, Leiste einklappbar
  const tab: Registerkarte = tabWahl === "tabelle" && !z.tabelle ? "start" : tabWahl;

  function tabKlick(t: Registerkarte) {
    if (eingeklappt) browserWertSchreiben(EINGEKLAPPT_SCHLUESSEL, null);
    else if (t === tab) {
      browserWertSchreiben(EINGEKLAPPT_SCHLUESSEL, "1");
      return;
    }
    browserWertSchreiben(TAB_SCHLUESSEL, t);
  }

  const reiter: { id: Registerkarte; name: string }[] = [
    { id: "start", name: "Start" },
    { id: "einfuegen", name: "Einfügen" },
    { id: "absatz", name: "Absatz" },
    ...(z.tabelle ? [{ id: "tabelle" as const, name: "Tabelle" }] : []),
  ];

  return (
    <div className={`wz ${eingeklappt ? "wz-zu" : ""}`} role="toolbar" aria-label="Formatierung">
      <div className="wz-kopf">
        <span className="wz-gruppe">
          <Knopf titel="Rückgängig (Strg+Z)" deaktiviert={!z.kannRueck} onClick={() => c().undo().run()}>
            <Zeichen name="rueckgaengig" groesse={16} />
          </Knopf>
          <Knopf titel="Wiederholen (Strg+Y)" deaktiviert={!z.kannVor} onClick={() => c().redo().run()}>
            <Zeichen name="wiederholen" groesse={16} />
          </Knopf>
        </span>
        <span className="wz-reiter" role="tablist" aria-label="Registerkarten">
          {reiter.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={!eingeklappt && tab === r.id}
              className={r.id === "tabelle" ? "kontext" : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => tabKlick(r.id)}
            >
              {r.name}
            </button>
          ))}
        </span>
        {eingeklappt && (
          <span className="wz-mini">
            <Knopf titel="Fett (Strg+B)" aktiv={z.fett} onClick={() => c().toggleBold().run()}>
              <b>F</b>
            </Knopf>
            <Knopf titel="Kursiv (Strg+I)" aktiv={z.kursiv} onClick={() => c().toggleItalic().run()}>
              <i>K</i>
            </Knopf>
            <Knopf titel="Unterstrichen (Strg+U)" aktiv={z.unterstrichen} onClick={() => c().toggleUnderline().run()}>
              <u>U</u>
            </Knopf>
            <VerlinkenKnopf editor={editor} ziele={ziele} />
          </span>
        )}
        <button
          type="button"
          className="knopf leise klein nur-symbol wz-einklappen"
          title={eingeklappt ? "Leiste ausklappen" : "Leiste einklappen (nur Registerkarten)"}
          aria-label={eingeklappt ? "Leiste ausklappen" : "Leiste einklappen"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => browserWertSchreiben(EINGEKLAPPT_SCHLUESSEL, eingeklappt ? null : "1")}
        >
          <Zeichen name={eingeklappt ? "runter" : "hoch"} groesse={16} />
        </button>
      </div>

      {!eingeklappt && tab === "start" && (
        <div className="wz-zeile" role="tabpanel">
          <div className="wz-gruppe" aria-label="Schrift">
            <select className="wz-auswahl wz-absatz" title="Absatzformat" aria-label="Absatzformat" value={z.absatz} onChange={(e) => absatzSetzen(editor, e.target.value as Absatz)}>
              {ABSATZFORMATE.map((a) => (
                <option key={a.wert} value={a.wert}>
                  {a.name}
                </option>
              ))}
            </select>
            <select
              className="wz-auswahl"
              title="Schriftart"
              aria-label="Schriftart"
              value={z.schrift}
              onChange={(e) => (e.target.value ? c().setFontFamily(e.target.value).run() : c().unsetFontFamily().removeEmptyTextStyle().run())}
            >
              {SCHRIFTARTEN.map((s) => (
                <option key={s.name} value={s.wert}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              className="wz-auswahl"
              title="Schriftgröße"
              aria-label="Schriftgröße"
              value={z.groesse}
              onChange={(e) => (e.target.value ? c().setFontSize(e.target.value).run() : c().unsetFontSize().removeEmptyTextStyle().run())}
            >
              {SCHRIFTGROESSEN.map((s) => (
                <option key={s.name} value={s.wert}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <Trenner />
          <div className="wz-gruppe" aria-label="Zeichen">
            <Knopf titel="Fett (Strg+B)" aktiv={z.fett} onClick={() => c().toggleBold().run()}>
              <b>F</b>
            </Knopf>
            <Knopf titel="Kursiv (Strg+I)" aktiv={z.kursiv} onClick={() => c().toggleItalic().run()}>
              <i>K</i>
            </Knopf>
            <Knopf titel="Unterstrichen (Strg+U)" aktiv={z.unterstrichen} onClick={() => c().toggleUnderline().run()}>
              <u>U</u>
            </Knopf>
            <Knopf titel="Durchgestrichen" aktiv={z.durch} onClick={() => c().toggleStrike().run()}>
              <s>ab</s>
            </Knopf>
            <Knopf titel="Hochgestellt (x²)" aktiv={z.hoch} onClick={() => c().toggleSuperscript().run()}>
              x<sup>2</sup>
            </Knopf>
            <Knopf titel="Tiefgestellt (x₂)" aktiv={z.tief} onClick={() => c().toggleSubscript().run()}>
              x<sub>2</sub>
            </Knopf>
            <Knopf titel="Code im Text" aktiv={z.code} onClick={() => c().toggleCode().run()}>
              <Icon d={ICONS.code} />
            </Knopf>
            <Aufklapp
              titel="Schriftfarbe"
              aktiv={Boolean(z.farbe)}
              knopf={
                <span className="wz-farbknopf">
                  A<span className="wz-farbstrich" style={{ background: z.farbe ?? "#b91c1c" }} />
                </span>
              }
            >
              {(zu) => (
                <div className="wz-farben">
                  {SCHRIFTFARBEN.map((f) => (
                    <button key={f} type="button" title={f} aria-label={`Schriftfarbe ${f}`} className="wz-farbe" style={{ "--c": f } as React.CSSProperties} onMouseDown={(e) => e.preventDefault()} onClick={() => (c().setColor(f).run(), zu())} />
                  ))}
                  <button type="button" className="knopf leise klein" onMouseDown={(e) => e.preventDefault()} onClick={() => (c().unsetColor().removeEmptyTextStyle().run(), zu())}>
                    Automatisch
                  </button>
                </div>
              )}
            </Aufklapp>
            <Aufklapp
              titel="Texthervorhebungsfarbe (Textmarker)"
              aktiv={Boolean(z.hintergrund) || editor.isActive("highlight")}
              knopf={
                <span className="wz-farbknopf">
                  <Zeichen name="textmarker" groesse={16} />
                  <span className="wz-farbstrich" style={{ background: z.hintergrund ?? "#fef08a" }} />
                </span>
              }
            >
              {(zu) => (
                <div className="wz-farben">
                  {MARKERFARBEN.map((f) => (
                    <button
                      key={f}
                      type="button"
                      title={f}
                      aria-label={`Textmarker ${f}`}
                      className="wz-farbe"
                      style={{ "--c": f } as React.CSSProperties}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => (c().unsetHighlight().setBackgroundColor(f).run(), zu())}
                    />
                  ))}
                  <button
                    type="button"
                    className="knopf leise klein"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => (c().unsetHighlight().unsetBackgroundColor().removeEmptyTextStyle().run(), zu())}
                  >
                    Keine Farbe
                  </button>
                </div>
              )}
            </Aufklapp>
            <Knopf titel="Formatierung löschen" onClick={() => c().unsetAllMarks().clearNodes().run()}>
              <Icon d={ICONS.radierer} />
            </Knopf>
          </div>
        </div>
      )}

      {!eingeklappt && tab === "absatz" && (
        <div className="wz-zeile" role="tabpanel">
          <div className="wz-gruppe" aria-label="Absatz">
            <Knopf titel="Aufzählung" aktiv={z.aufzaehlung} onClick={() => c().toggleBulletList().run()}>
              <Icon d={ICONS.aufzaehlung} />
            </Knopf>
            <Knopf titel="Nummerierung" aktiv={z.nummer} onClick={() => c().toggleOrderedList().run()}>
              <Icon d={ICONS.nummer} />
            </Knopf>
            <Knopf titel="Checkliste" aktiv={z.check} onClick={() => c().toggleTaskList().run()}>
              <Icon d={ICONS.check} />
            </Knopf>
            <Knopf titel="Einzug verkleinern (Umschalt+Tab)" deaktiviert={!z.inListe} onClick={() => c().liftListItem(editor.isActive("taskItem") ? "taskItem" : "listItem").run()}>
              <Icon d={ICONS.einzugMinus} />
            </Knopf>
            <Knopf titel="Einzug vergrößern (Tab)" deaktiviert={!z.inListe} onClick={() => c().sinkListItem(editor.isActive("taskItem") ? "taskItem" : "listItem").run()}>
              <Icon d={ICONS.einzugPlus} />
            </Knopf>
            <Knopf titel="Linksbündig" aktiv={z.ausrichtung === "left"} onClick={() => c().unsetTextAlign().run()}>
              <Icon d={ICONS.links} />
            </Knopf>
            <Knopf titel="Zentriert" aktiv={z.ausrichtung === "center"} onClick={() => c().setTextAlign("center").run()}>
              <Icon d={ICONS.mitte} />
            </Knopf>
            <Knopf titel="Rechtsbündig" aktiv={z.ausrichtung === "right"} onClick={() => c().setTextAlign("right").run()}>
              <Icon d={ICONS.rechts} />
            </Knopf>
            <Knopf titel="Blocksatz" aktiv={z.ausrichtung === "justify"} onClick={() => c().setTextAlign("justify").run()}>
              <Icon d={ICONS.block} />
            </Knopf>
          </div>
        </div>
      )}

      {!eingeklappt && tab === "einfuegen" && (
        <div className="wz-zeile" role="tabpanel">
          <div className="wz-gruppe" aria-label="Einfügen">
            <VerlinkenKnopf editor={editor} ziele={ziele} />
            <Aufklapp titel="Weblink" aktiv={z.link} knopf={<Zeichen name="link" groesse={16} />}>
              {(zu) => <WeblinkFeld editor={editor} zu={zu} />}
            </Aufklapp>
            <Aufklapp titel="Tabelle einfügen" aktiv={z.tabelle} knopf={<Zeichen name="tabelle" groesse={16} />}>
              {(zu) => <TabellenRaster onWahl={(zeilen, spalten) => (c().insertTable({ rows: zeilen, cols: spalten, withHeaderRow: true }).run(), zu())} />}
            </Aufklapp>
            <Aufklapp titel="Bild einfügen" knopf={<Zeichen name="bild" groesse={16} />}>
              {(zu) => (
                <EingabeFeld
                  beschriftung="Bildadresse (https://…)"
                  knopf="Einfügen"
                  onFertig={(url) => {
                    if (/^https?:\/\//i.test(url)) c().setImage({ src: url }).run();
                    zu();
                  }}
                />
              )}
            </Aufklapp>
            <Knopf titel="Trennlinie" onClick={() => c().setHorizontalRule().run()}>
              <Icon d={ICONS.linie} />
            </Knopf>
            <Aufklapp titel="Hinweisbox (Callout)" aktiv={z.callout} knopf={<Zeichen name="info" groesse={16} />}>
              {(zu) => (
                <div className="wz-liste">
                  {(Object.keys(CALLOUTS) as CalloutTyp[]).map((t) => (
                    <button key={t} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => (c().setCallout(t).run(), zu())}>
                      <Zeichen name={CALLOUTS[t].icon} groesse={16} />
                      {CALLOUTS[t].name}
                    </button>
                  ))}
                  {z.callout && (
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => (c().lift("callout").run(), zu())}>
                      <Zeichen name="schliessen" groesse={16} />
                      Box entfernen
                    </button>
                  )}
                </div>
              )}
            </Aufklapp>
            <Aufklapp titel="Formel (LaTeX)" knopf={<span className="wz-text">∑</span>}>
              {(zu) => <FormelFeld editor={editor} zu={zu} />}
            </Aufklapp>
            <Knopf titel="Code-Block" aktiv={z.absatz === "code"} onClick={() => c().toggleCodeBlock().run()}>
              <span className="wz-text">{"{ }"}</span>
            </Knopf>
            <Knopf titel="Zitat" aktiv={z.absatz === "zitat"} onClick={() => absatzSetzen(editor, "zitat")}>
              <Zeichen name="zitat" groesse={16} />
            </Knopf>
          </div>
          {extra && (
            <>
              <Trenner />
              <div className="wz-gruppe">{extra}</div>
            </>
          )}
        </div>
      )}

      {!eingeklappt && tab === "tabelle" && (
        <div className="wz-zeile" role="tabpanel">
          <Knopf breit titel="Zeile darüber" onClick={() => c().addRowBefore().run()}>
            + Zeile oben
          </Knopf>
          <Knopf breit titel="Zeile darunter" onClick={() => c().addRowAfter().run()}>
            + Zeile unten
          </Knopf>
          <Knopf breit titel="Spalte links" onClick={() => c().addColumnBefore().run()}>
            + Spalte links
          </Knopf>
          <Knopf breit titel="Spalte rechts" onClick={() => c().addColumnAfter().run()}>
            + Spalte rechts
          </Knopf>
          <Knopf breit titel="Zeile löschen" onClick={() => c().deleteRow().run()}>
            − Zeile
          </Knopf>
          <Knopf breit titel="Spalte löschen" onClick={() => c().deleteColumn().run()}>
            − Spalte
          </Knopf>
          <Knopf breit titel="Kopfzeile an/aus" onClick={() => c().toggleHeaderRow().run()}>
            Kopfzeile
          </Knopf>
          <Knopf breit titel="Tabelle löschen" onClick={() => c().deleteTable().run()}>
            <Zeichen name="loeschen" groesse={16} /> Tabelle
          </Knopf>
        </div>
      )}
    </div>
  );
}

function EingabeFeld({ beschriftung, knopf, start = "", onFertig }: { beschriftung: string; knopf: string; start?: string; onFertig: (wert: string) => void }) {
  const [wert, setWert] = useState(start);
  return (
    <form
      className="wz-eingabe"
      onSubmit={(e) => {
        e.preventDefault();
        onFertig(wert.trim());
      }}
    >
      <label>
        <span>{beschriftung}</span>
        <input autoFocus value={wert} onChange={(e) => setWert(e.target.value)} />
      </label>
      <button type="submit" className="knopf haupt klein">
        {knopf}
      </button>
    </form>
  );
}

function WeblinkFeld({ editor, zu }: { editor: Editor; zu: () => void }) {
  const start = (editor.getAttributes("link").href as string | undefined) ?? "";
  return (
    <div>
      <EingabeFeld
        beschriftung="Webadresse"
        knopf={start ? "Ändern" : "Verlinken"}
        start={start}
        onFertig={(roh) => {
          const url = roh && !/^[a-z]+:/i.test(roh) ? `https://${roh}` : roh;
          const kette = editor.chain().focus().extendMarkRange("link");
          if (!url) kette.unsetLink().run();
          else if (/^(https?:|mailto:)/i.test(url)) {
            if (editor.state.selection.empty && !start) kette.insertContent({ type: "text", text: roh, marks: [{ type: "link", attrs: { href: url } }] }).run();
            else kette.setLink({ href: url }).run();
          }
          zu();
        }}
      />
      {start && (
        <button type="button" className="knopf leise klein" onClick={() => (editor.chain().focus().extendMarkRange("link").unsetLink().run(), zu())}>
          Link entfernen
        </button>
      )}
    </div>
  );
}

function FormelFeld({ editor, zu }: { editor: Editor; zu: () => void }) {
  const [latex, setLatex] = useState("");
  const [block, setBlock] = useState(false);
  return (
    <form
      className="wz-eingabe"
      onSubmit={(e) => {
        e.preventDefault();
        if (!latex.trim()) return;
        const kette = editor.chain().focus();
        (block ? kette.insertBlockMath({ latex: latex.trim() }) : kette.insertInlineMath({ latex: latex.trim() })).run();
        zu();
      }}
    >
      <label>
        <span>Formel in LaTeX, z. B. \frac{"{a}"}{"{b}"}, x^2, \sum_{"{i=1}"}^n</span>
        <input autoFocus value={latex} onChange={(e) => setLatex(e.target.value)} placeholder="E = mc^2" />
      </label>
      <label className="wz-check">
        <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} /> Eigene Zeile (groß)
      </label>
      <button type="submit" className="knopf haupt klein">
        Einfügen
      </button>
    </form>
  );
}

function TabellenRaster({ onWahl }: { onWahl: (zeilen: number, spalten: number) => void }) {
  const [hover, setHover] = useState<[number, number]>([2, 2]);
  return (
    <div className="wz-raster-wrap">
      <div className="wz-raster" onMouseLeave={() => setHover([2, 2])}>
        {Array.from({ length: 6 }, (_, r) =>
          Array.from({ length: 6 }, (_, s) => (
            <button
              key={`${r}-${s}`}
              type="button"
              aria-label={`${r + 1} × ${s + 1}`}
              className={r <= hover[0] && s <= hover[1] ? "an" : ""}
              onMouseEnter={() => setHover([r, s])}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onWahl(r + 1, s + 1)}
            />
          )),
        )}
      </div>
      <span>
        {hover[0] + 1} Zeilen × {hover[1] + 1} Spalten
      </span>
    </div>
  );
}

/** "Verlinken": Notiz oder PDF (optional mit Seite) suchen und als [[…]] einfügen */
function VerlinkenKnopf({ editor, ziele }: { editor: Editor; ziele: LinkZiel[] }) {
  return (
    <Aufklapp titel="Verlinken: Notiz oder PDF" knopf={<span className="wz-text wz-verlinken">[[ ]] Verlinken</span>}>
      {(zu) => <VerlinkenFeld editor={editor} ziele={ziele} zu={zu} />}
    </Aufklapp>
  );
}

function VerlinkenFeld({ editor, ziele, zu }: { editor: Editor; ziele: LinkZiel[]; zu: () => void }) {
  const [suche, setSuche] = useState(() => {
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, " ").slice(0, 80);
  });
  const [seite, setSeite] = useState("");
  const [index, setIndex] = useState(0);
  const q = suche.trim().toLowerCase();
  const treffer = ziele.filter((z) => !q || z.name.toLowerCase().includes(q)).slice(0, 12);
  const neuAnlegen = q && !ziele.some((z) => z.name.toLowerCase() === q) ? suche.trim() : null;

  function einfuegen(name: string, art: "notiz" | "pdf") {
    const s = art === "pdf" ? Number(seite) || null : null;
    const { from, to } = editor.state.selection;
    const markiert = editor.state.doc.textBetween(from, to, " ").trim();
    editor
      .chain()
      .focus()
      .insertContent([
        { type: "wikilink", attrs: { ziel: zielText(name, s), label: markiert && markiert !== name ? markiert : null } },
        { type: "text", text: " " },
      ])
      .run();
    zu();
  }

  return (
    <div className="wz-verlinken-feld">
      <input
        autoFocus
        aria-label="Notiz oder PDF suchen"
        placeholder="Notiz oder PDF suchen …"
        value={suche}
        onChange={(e) => {
          setSuche(e.target.value);
          setIndex(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndex((i) => Math.min(i + 1, treffer.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const t = treffer[index];
            if (t) einfuegen(t.name, t.art);
            else if (neuAnlegen) einfuegen(neuAnlegen, "notiz");
          }
        }}
      />
      <label className="wz-seite">
        <span>Seite (bei PDFs):</span>
        <input inputMode="numeric" value={seite} onChange={(e) => setSeite(e.target.value.replace(/\D/g, ""))} placeholder="–" />
      </label>
      <ul className="wz-treffer">
        {treffer.map((t, i) => (
          <li key={`${t.art}-${t.id}`}>
            <button type="button" className={i === index ? "an" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => einfuegen(t.name, t.art)}>
              <Zeichen name={t.art === "pdf" ? "pdf" : "notizen"} groesse={16} />
              {t.name}
            </button>
          </li>
        ))}
        {neuAnlegen && (
          <li>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => einfuegen(neuAnlegen, "notiz")}>
              <Zeichen name="plus" groesse={16} />
              Neue Notiz „{neuAnlegen}“ verlinken
            </button>
          </li>
        )}
        {treffer.length === 0 && !neuAnlegen && <li className="leer">Keine Notizen oder PDFs.</li>}
      </ul>
    </div>
  );
}
