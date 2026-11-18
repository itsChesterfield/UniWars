"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { dokumentFachSetzen, dokumentLoeschen, dokumentSpeichern, type Dokument } from "@/app/(hubs)/textverarbeitung/actions";
import { DreiPunkteMenue } from "@/components/hubs/drei-punkte-menue";
import { Icon } from "@/components/nav-icon";
import { Zustand } from "@/components/zustand";
import type { IconName } from "@/lib/icons";
import { BildAuswahl, bildUrl } from "@/components/hubs/bild-auswahl";
import { OHNE_TITEL } from "@/components/textverarbeitung/dokument-liste";
import { KiFeedbackLeiste } from "@/components/textverarbeitung/ki-feedback-leiste";
import { useAutoSpeichern } from "@/lib/hubs/auto-speichern";
import { zitatImText } from "@/lib/literatur/apa";
import { alsDocx, dateiname, dateiSpeichern } from "@/lib/textverarbeitung/docx-export";
import type { FachOption } from "@/lib/fach-option";
import type { Json } from "@/lib/supabase/types";
import { fehlerMelden, track } from "@/lib/analytics";
import { SpeicherStatusAnzeige } from "@/components/bewegung/speicher-status";

type Quelle = { id: string; autoren: string; titel: string; jahr: number; seiten: string | null };
type Aenderung = { titel: string; inhalt: Json; klartext: string; woerter: number };

export function woerterZaehlen(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function DokumentEditor({
  dokument,
  faecher,
  quellen,
  istNeu,
}: {
  dokument: Dokument;
  faecher: FachOption[];
  quellen: Quelle[];
  istNeu: boolean;
  /** KI-06: Mistral-Key gesetzt → "✨ Feedback" anzeigen */
  kiVerfuegbar?: boolean;
}) {
  const router = useRouter();
  const [titel, setTitel] = useState(dokument.titel);
  const [fachId, setFachId] = useState(dokument.fach_id);
  const [bildDialog, setBildDialog] = useState(false);
  const [exportiert, setExportiert] = useState<string | null>(null);
  const [kiOffen, setKiOffen] = useState(false);
  const { status, aendern } = useAutoSpeichern<Aenderung>((a) => dokumentSpeichern(dokument.id, a));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      TableKit.configure({ table: { resizable: false } }),
      Image.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder: "Hier beginnt dein Text …" }),
    ],
    content: dokument.inhalt as JSONContent,
    immediatelyRender: false,
    autofocus: istNeu ? false : "start",
    editorProps: { attributes: { class: "md-inhalt txt-inhalt", "aria-label": "Dokumenttext" } },
    onUpdate: ({ editor: e }) => {
      const klartext = e.getText({ blockSeparator: "\n" });
      aendern({ inhalt: e.getJSON() as Json, klartext, woerter: woerterZaehlen(klartext) });
    },
  });

  // TXT-03: Wort- und Zeichenzähler (Gesamt + Auswahl)
  const zaehler = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return { woerter: 0, zeichen: 0, auswahlWoerter: 0, auswahlZeichen: 0 };
      const text = e.getText({ blockSeparator: "\n" });
      const { from, to } = e.state.selection;
      const auswahl = from === to ? "" : e.state.doc.textBetween(from, to, " ");
      return {
        woerter: woerterZaehlen(text),
        zeichen: text.replace(/\n/g, "").length,
        auswahlWoerter: woerterZaehlen(auswahl),
        auswahlZeichen: auswahl.length,
      };
    },
  });

  // TXT-04: Gliederung aus den Überschriften
  const gliederung = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const liste: { ebene: number; text: string; pos: number }[] = [];
      e?.state.doc.descendants((knoten, pos) => {
        if (knoten.type.name === "heading") liste.push({ ebene: Number(knoten.attrs.level), text: knoten.textContent, pos });
        return knoten.type.name !== "heading";
      });
      return liste;
    },
    equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });

  function zuUeberschrift(pos: number) {
    if (!editor) return;
    editor.chain().focus().setTextSelection(pos + 1).run();
    (editor.view.nodeDOM(pos) as HTMLElement | null)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function fachAendern(neu: string) {
    setFachId(neu || null);
    dokumentFachSetzen(dokument.id, neu || null).catch((err) => fehlerMelden(err, { ort: "dokument_fach" }));
  }

  async function loeschen() {
    if (!window.confirm(`„${titel || OHNE_TITEL}“ wirklich löschen?`)) return;
    try {
      await dokumentLoeschen(dokument.id);
      track("dokument_geloescht");
      router.push("/textverarbeitung");
    } catch (err) {
      fehlerMelden(err, { ort: "dokument_loeschen" });
      window.alert("Löschen hat nicht geklappt.");
    }
  }

  async function exportieren(art: "pdf" | "docx") {
    if (!editor) return;
    track("dokument_exportiert", { format: art, woerter: zaehler?.woerter ?? 0 });
    if (art === "pdf") {
      window.print();
      return;
    }
    setExportiert("Word-Datei wird erstellt …");
    try {
      const blob = await alsDocx(titel || OHNE_TITEL, editor.getJSON());
      dateiSpeichern(blob, dateiname(titel || OHNE_TITEL, "docx"));
      setExportiert(null);
    } catch (err) {
      setExportiert("Export hat nicht geklappt.");
      fehlerMelden(err, { ort: "dokument_docx" });
    }
  }

  return (
    <div className="txt-seite">
      <Link href="/textverarbeitung" className="knopf leise klein zurueck-link">
        <Icon name="pfeil-links" groesse={16} />
        Alle Dokumente
      </Link>
      <div className="txt-kopf">
        <input
          className="txt-titel"
          value={titel}
          placeholder={OHNE_TITEL}
          aria-label="Titel"
          maxLength={300}
          autoFocus={istNeu}
          onChange={(e) => {
            setTitel(e.target.value);
            aendern({ titel: e.target.value });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              editor?.commands.focus("start");
            }
          }}
        />
        <div className="txt-kopf-aktionen">
          <SpeicherStatusAnzeige status={status} text={exportiert} />
          <select className="txt-fach" value={fachId ?? ""} onChange={(e) => fachAendern(e.target.value)} aria-label="Fach">
            <option value="">Ohne Fach</option>
            {faecher.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <DreiPunkteMenue
            label="Exportieren"
            knopfText="Exportieren"
            punkte={[
              { label: "Als PDF (Drucken, dann „Als PDF speichern“)", onClick: () => void exportieren("pdf") },
              { label: "Als Word (.docx)", onClick: () => void exportieren("docx") },
            ]}
          />
          <DreiPunkteMenue label="Weitere Aktionen für dieses Dokument" punkte={[{ label: "Löschen", onClick: () => void loeschen(), gefahr: true }]} />
        </div>
      </div>

      {editor && <Werkzeugleiste editor={editor} quellen={quellen} onBild={() => setBildDialog(true)} />}

      <div className={`txt-koerper ${kiOffen && editor ? "mit-ki" : ""}`}>
        <nav className="txt-gliederung" aria-labelledby="txt-gliederung-titel">
          <h2 id="txt-gliederung-titel">Gliederung</h2>
          {!gliederung || gliederung.length === 0 ? (
            <p>Überschriften erscheinen hier automatisch.</p>
          ) : (
            <ul>
              {gliederung.map((g) => (
                <li key={g.pos} style={{ "--einzug": `${(g.ebene - 1) * 12}px` } as React.CSSProperties}>
                  <button type="button" onClick={() => zuUeberschrift(g.pos)} className={`txt-gliederung-${g.ebene}`}>
                    {g.text || "(leere Überschrift)"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <div className="txt-papier-wrap">
          <article className="txt-papier dok-papier">
            <h1 className="nur-druck">{titel || OHNE_TITEL}</h1>
            <EditorContent editor={editor} />
          </article>
        </div>

        {kiOffen && editor && <KiFeedbackLeiste editor={editor} dokumentId={dokument.id} onSchliessen={() => setKiOffen(false)} />}
      </div>

      {zaehler && (
        <p className="txt-fuss" aria-live="off">
          {zaehler.auswahlZeichen > 0 && (
            <span className="txt-auswahl">
              Auswahl <span className="zahl">{zaehler.auswahlWoerter.toLocaleString("de-DE")}</span> Wörter, <span className="zahl">{zaehler.auswahlZeichen.toLocaleString("de-DE")}</span> Zeichen
            </span>
          )}
          <span>
            <span className="zahl">{zaehler.woerter.toLocaleString("de-DE")}</span> Wörter, <span className="zahl">{zaehler.zeichen.toLocaleString("de-DE")}</span> Zeichen
          </span>
        </p>
      )}

      {bildDialog && editor && (
        <BildAuswahl
          fachId={fachId}
          onSchliessen={() => setBildDialog(false)}
          onWahl={(b) => {
            setBildDialog(false);
            editor.chain().focus().setImage({ src: bildUrl(b.id), alt: b.name }).run();
            track("dokument_bild_eingefuegt");
          }}
        />
      )}
    </div>
  );
}

// --- TXT-02: Formatierungsleiste (bleibt beim Scrollen stehen) ---------------

type Block = "p" | "h1" | "h2" | "h3";

function Werkzeugleiste({ editor, quellen, onBild }: { editor: Editor; quellen: Quelle[]; onBild: () => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: (e.isActive("heading", { level: 1 })
        ? "h1"
        : e.isActive("heading", { level: 2 })
          ? "h2"
          : e.isActive("heading", { level: 3 })
            ? "h3"
            : "p") as Block,
      fett: e.isActive("bold"),
      kursiv: e.isActive("italic"),
      unter: e.isActive("underline"),
      punkte: e.isActive("bulletList"),
      nummern: e.isActive("orderedList"),
      zitat: e.isActive("blockquote"),
      tabelle: e.isActive("table"),
      rueckgaengig: e.can().undo(),
      wiederholen: e.can().redo(),
    }),
  });
  const [quellenOffen, setQuellenOffen] = useState(false);

  function blockSetzen(b: Block) {
    const kette = editor.chain().focus();
    if (b === "p") kette.setParagraph().run();
    else kette.setHeading({ level: Number(b.slice(1)) as 1 | 2 | 3 }).run();
  }

  const knopf = (inhalt: React.ReactNode, titel: string, aktiv: boolean | undefined, aktion: () => void, deaktiviert = false) => (
    <button
      type="button"
      title={titel}
      aria-pressed={aktiv}
      disabled={deaktiviert}
      className={`wz-knopf ${aktiv ? "an" : ""}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={aktion}
    >
      {/* Name aus dem Text (WCAG 2.5.3) */}
      <span aria-hidden>{inhalt}</span>
      <span className="sr-only">{titel}</span>
    </button>
  );
  const symbol = (name: IconName) => <Icon name={name} groesse={16} />;
  const mitText = (name: IconName, text: string) => (
    <>
      {symbol(name)} {text}
    </>
  );

  return (
    <div className="wz txt-werkzeuge" role="toolbar" aria-label="Formatierung">
      <div className="wz-zeile">
        <select className="wz-auswahl wz-absatz" value={s.block} onChange={(e) => blockSetzen(e.target.value as Block)} aria-label="Absatzformat">
          <option value="p">Absatz</option>
          <option value="h1">Überschrift 1</option>
          <option value="h2">Überschrift 2</option>
          <option value="h3">Überschrift 3</option>
        </select>
        <span className="wz-trenner" />
        {knopf(<b>F</b>, "Fett (Strg+B)", s.fett, () => editor.chain().focus().toggleBold().run())}
        {knopf(<i>K</i>, "Kursiv (Strg+I)", s.kursiv, () => editor.chain().focus().toggleItalic().run())}
        {knopf(<u>U</u>, "Unterstrichen (Strg+U)", s.unter, () => editor.chain().focus().toggleUnderline().run())}
        <span className="wz-trenner" />
        {knopf(symbol("aufzaehlung"), "Aufzählung", s.punkte, () => editor.chain().focus().toggleBulletList().run())}
        {knopf(symbol("nummerierung"), "Nummerierung", s.nummern, () => editor.chain().focus().toggleOrderedList().run())}
        {knopf(symbol("zitat"), "Zitat-Block", s.zitat, () => editor.chain().focus().toggleBlockquote().run())}
        <span className="wz-trenner" />
        {s.tabelle ? (
          <>
            {knopf(mitText("plus", "Zeile"), "Zeile darunter einfügen", undefined, () => editor.chain().focus().addRowAfter().run())}
            {knopf(mitText("plus", "Spalte"), "Spalte rechts einfügen", undefined, () => editor.chain().focus().addColumnAfter().run())}
            {knopf(mitText("minus", "Zeile"), "Zeile löschen", undefined, () => editor.chain().focus().deleteRow().run())}
            {knopf(mitText("minus", "Spalte"), "Spalte löschen", undefined, () => editor.chain().focus().deleteColumn().run())}
            {knopf(mitText("loeschen", "Tabelle"), "Tabelle löschen", undefined, () => editor.chain().focus().deleteTable().run())}
          </>
        ) : (
          knopf(mitText("tabelle", "Tabelle"), "Tabelle einfügen (3 × 3)", undefined, () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())
        )}
        {knopf(mitText("bild", "Bild"), "Bild einfügen", undefined, onBild)}
        {knopf(mitText("literatur", "Quelle"), "Quelle zitieren", quellenOffen, () => setQuellenOffen(true))}
        <span className="wz-trenner" />
        {knopf(symbol("rueckgaengig"), "Rückgängig (Strg+Z)", undefined, () => editor.chain().focus().undo().run(), !s.rueckgaengig)}
        {knopf(symbol("wiederholen"), "Wiederholen (Strg+Y)", undefined, () => editor.chain().focus().redo().run(), !s.wiederholen)}
      </div>
      {quellenOffen && (
        <QuellenAuswahl
          quellen={quellen}
          onSchliessen={() => setQuellenOffen(false)}
          onWahl={(q) => {
            setQuellenOffen(false);
            editor.chain().focus().insertContent(`${zitatImText(q)} `).run();
            track("dokument_quelle_eingefuegt");
          }}
        />
      )}
    </div>
  );
}

/** TXT-05: Quelle aus der Literaturverwaltung zitieren */
function QuellenAuswahl({ quellen, onWahl, onSchliessen }: { quellen: Quelle[]; onWahl: (q: Quelle) => void; onSchliessen: () => void }) {
  const [suche, setSuche] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const sichtbar = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return quellen.filter((x) => !q || `${x.autoren} ${x.titel} ${x.jahr}`.toLowerCase().includes(q));
  }, [quellen, suche]);

  return (
    <dialog
      ref={ref}
      className="formular-dialog txt-quellen"
      aria-labelledby="txt-quellen-titel"
      onCancel={(e) => {
        e.preventDefault();
        onSchliessen();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onSchliessen();
      }}
    >
      <h2 id="txt-quellen-titel">Quelle zitieren</h2>
      {quellen.length === 0 ? (
        <Zustand
          art="leer"
          icon="literatur"
          titel="Noch keine Quellen."
          region
          ebene={3}
          aktion={
            <Link href="/literaturverwaltung" className="knopf neben klein">
              Zur Literaturverwaltung
            </Link>
          }
        />
      ) : (
        <>
          <input aria-label="Quelle suchen" placeholder="Quelle suchen …" value={suche} onChange={(e) => setSuche(e.target.value)} autoFocus />
          <ul className="txt-quellen-liste">
            {sichtbar.map((q) => (
              <li key={q.id}>
                <button type="button" onClick={() => onWahl(q)}>
                  <strong>{zitatImText(q)}</strong>
                  <span>{q.titel}</span>
                </button>
              </li>
            ))}
            {sichtbar.length === 0 && <li className="leer">Keine Treffer.</li>}
          </ul>
        </>
      )}
      <button type="button" className="knopf leise" onClick={onSchliessen}>
        Abbrechen
      </button>
    </dialog>
  );
}
