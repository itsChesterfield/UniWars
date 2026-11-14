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
import { BildAuswahl, bildUrl } from "@/components/hubs/bild-auswahl";
import { OHNE_TITEL } from "@/components/textverarbeitung/dokument-liste";
import { KiFeedbackLeiste } from "@/components/textverarbeitung/ki-feedback-leiste";
import { SPEICHER_TEXT, useAutoSpeichern } from "@/lib/hubs/auto-speichern";
import { zitatImText } from "@/lib/literatur/apa";
import { alsDocx, dateiname, dateiSpeichern } from "@/lib/textverarbeitung/docx-export";
import type { FachOption } from "@/lib/fach-option";
import type { Json } from "@/lib/supabase/types";
import { fehlerMelden, track } from "@/lib/analytics";

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
  kiVerfuegbar = false,
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
      <div className="txt-kopf">
        <Link href="/textverarbeitung" className="hub-zurueck-link">
          ← Alle Dokumente
        </Link>
        <div className="txt-kopf-zeile">
          <input
            className="notiz-titel txt-titel"
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
            <span className={`speicher-status ${status}`} aria-live="polite">
              {exportiert ?? SPEICHER_TEXT[status]}
            </span>
            <select className="field txt-fach" value={fachId ?? ""} onChange={(e) => fachAendern(e.target.value)} aria-label="Fach">
              <option value="">Ohne Fach</option>
              {faecher.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            {kiVerfuegbar && (
              <button
                type="button"
                className={`btng txt-ki-knopf ${kiOffen ? "an" : ""}`}
                aria-expanded={kiOffen}
                title="Hinweise zu Struktur, Verständlichkeit und Stil"
                onClick={() => setKiOffen((o) => !o)}
                disabled={!editor}
              >
                ✨ Feedback
              </button>
            )}
            <ExportMenue onWahl={(art) => void exportieren(art)} />
            <DreiPunkteMenue punkte={[{ label: "Löschen", onClick: () => void loeschen(), gefahr: true }]} />
          </div>
        </div>
      </div>

      {editor && (
        <Werkzeugleiste
          editor={editor}
          quellen={quellen}
          onBild={() => setBildDialog(true)}
        />
      )}

      <div className={`txt-koerper ${kiOffen && editor ? "mit-ki" : ""}`}>
        <nav className="txt-gliederung" aria-label="Gliederung">
          <h3>Gliederung</h3>
          {!gliederung || gliederung.length === 0 ? (
            <p className="empty-state">Überschriften erscheinen hier automatisch.</p>
          ) : (
            <ul>
              {gliederung.map((g) => (
                <li key={g.pos} style={{ paddingLeft: (g.ebene - 1) * 12 }}>
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
        <div className="txt-fuss mono" aria-live="off">
          {zaehler.auswahlZeichen > 0 && (
            <span className="txt-auswahl">
              Auswahl: {zaehler.auswahlWoerter.toLocaleString("de-DE")} Wörter · {zaehler.auswahlZeichen.toLocaleString("de-DE")} Zeichen
            </span>
          )}
          <span>
            {zaehler.woerter.toLocaleString("de-DE")} Wörter · {zaehler.zeichen.toLocaleString("de-DE")} Zeichen
          </span>
        </div>
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

function ExportMenue({ onWahl }: { onWahl: (art: "pdf" | "docx") => void }) {
  return (
    <DreiPunkteMenueKnopf
      label="Exportieren"
      punkte={[
        { label: "Als PDF (Drucken → „Als PDF speichern“)", onClick: () => onWahl("pdf") },
        { label: "Als Word (.docx)", onClick: () => onWahl("docx") },
      ]}
    />
  );
}

/** Wie DreiPunkteMenue, aber mit Text-Knopf. */
function DreiPunkteMenueKnopf({ label, punkte }: { label: string; punkte: { label: string; onClick: () => void }[] }) {
  const [offen, setOffen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!offen) return;
    const zu = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOffen(false);
    };
    document.addEventListener("mousedown", zu);
    return () => document.removeEventListener("mousedown", zu);
  }, [offen]);
  return (
    <div className="drei-punkte" ref={ref}>
      <button type="button" className="btng" aria-haspopup="menu" aria-expanded={offen} onClick={() => setOffen((o) => !o)}>
        {label} ▾
      </button>
      {offen && (
        <div className="drei-punkte-menue" role="menu">
          {punkte.map((p) => (
            <button
              key={p.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOffen(false);
                p.onClick();
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
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

  const knopf = (label: string, titel: string, aktiv: boolean, aktion: () => void, extra = "") => (
    <button
      type="button"
      title={titel}
      aria-label={titel}
      aria-pressed={aktiv}
      className={`md-knopf ${aktiv ? "an" : ""} ${extra}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={aktion}
    >
      {label}
    </button>
  );

  return (
    <div className="txt-werkzeuge" role="toolbar" aria-label="Formatierung">
      <select className="field txt-block" value={s.block} onChange={(e) => blockSetzen(e.target.value as Block)} aria-label="Absatzformat">
        <option value="p">Absatz</option>
        <option value="h1">Überschrift 1</option>
        <option value="h2">Überschrift 2</option>
        <option value="h3">Überschrift 3</option>
      </select>
      <span className="txt-trenner" />
      {knopf("B", "Fett (Strg+B)", s.fett, () => editor.chain().focus().toggleBold().run(), "md-fett")}
      {knopf("I", "Kursiv (Strg+I)", s.kursiv, () => editor.chain().focus().toggleItalic().run(), "md-kursiv")}
      {knopf("U", "Unterstrichen (Strg+U)", s.unter, () => editor.chain().focus().toggleUnderline().run(), "md-unter")}
      <span className="txt-trenner" />
      {knopf("•", "Aufzählung", s.punkte, () => editor.chain().focus().toggleBulletList().run())}
      {knopf("1.", "Nummerierung", s.nummern, () => editor.chain().focus().toggleOrderedList().run())}
      {knopf("❝", "Zitat-Block", s.zitat, () => editor.chain().focus().toggleBlockquote().run())}
      <span className="txt-trenner" />
      {s.tabelle ? (
        <>
          {knopf("+Zeile", "Zeile darunter einfügen", false, () => editor.chain().focus().addRowAfter().run())}
          {knopf("+Spalte", "Spalte rechts einfügen", false, () => editor.chain().focus().addColumnAfter().run())}
          {knopf("−Zeile", "Zeile löschen", false, () => editor.chain().focus().deleteRow().run())}
          {knopf("−Spalte", "Spalte löschen", false, () => editor.chain().focus().deleteColumn().run())}
          {knopf("✕Tabelle", "Tabelle löschen", false, () => editor.chain().focus().deleteTable().run())}
        </>
      ) : (
        knopf("▦ Tabelle", "Tabelle einfügen (3 × 3)", false, () =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        )
      )}
      {knopf("🖼 Bild", "Bild einfügen", false, onBild)}
      <div className="drei-punkte">
        {knopf("❞ Quelle", "Quelle zitieren (TXT-05)", quellenOffen, () => setQuellenOffen((o) => !o))}
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
      <span className="txt-trenner" />
      {knopf("↶", "Rückgängig (Strg+Z)", false, () => editor.chain().focus().undo().run(), s.rueckgaengig ? "" : "aus")}
      {knopf("↷", "Wiederholen (Strg+Y)", false, () => editor.chain().focus().redo().run(), s.wiederholen ? "" : "aus")}
    </div>
  );
}

function QuellenAuswahl({ quellen, onWahl, onSchliessen }: { quellen: Quelle[]; onWahl: (q: Quelle) => void; onSchliessen: () => void }) {
  const [suche, setSuche] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const zu = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onSchliessen();
    };
    document.addEventListener("mousedown", zu);
    return () => document.removeEventListener("mousedown", zu);
  }, [onSchliessen]);
  const sichtbar = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return quellen.filter((x) => !q || `${x.autoren} ${x.titel} ${x.jahr}`.toLowerCase().includes(q));
  }, [quellen, suche]);

  return (
    <div className="drei-punkte-menue txt-quellen" ref={ref} role="dialog" aria-label="Quelle wählen">
      {quellen.length === 0 ? (
        <p className="empty-state" style={{ padding: 8 }}>
          Noch keine Quellen. <Link href="/literaturverwaltung">Zur Literaturverwaltung</Link>
        </p>
      ) : (
        <>
          <input className="field" placeholder="Quelle suchen …" value={suche} onChange={(e) => setSuche(e.target.value)} autoFocus />
          <div className="txt-quellen-liste">
            {sichtbar.map((q) => (
              <button key={q.id} type="button" onClick={() => onWahl(q)}>
                <strong>{zitatImText(q)}</strong>
                <span className="muted">{q.titel}</span>
              </button>
            ))}
            {sichtbar.length === 0 && <p className="empty-state" style={{ padding: 8 }}>Keine Treffer.</p>}
          </div>
        </>
      )}
    </div>
  );
}
