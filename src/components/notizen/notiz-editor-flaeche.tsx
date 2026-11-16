"use client";

import "katex/dist/katex.min.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { editorErweiterungen, type LinkAufloesung } from "@/components/notizen/editor-erweiterungen";
import { Werkzeugleiste, type LinkZiel } from "@/components/notizen/werkzeugleiste";
import { ZITAT_DRAG_TYP, quellenAngabe, zitatLesen, type Zitat } from "@/lib/geteilte-ansicht";
import { istPdfName, zielText } from "@/lib/notizen/wikilinks";
import { NOTIZ_EINFUEGEN } from "@/lib/ki/studio-kontext";
import { track } from "@/lib/analytics";

/** Gezogene PDF-Markierung: kursives Zitat + Verlinkung auf die PDF-Seite (bzw. Quelle als Text). */
function zitatInhalt(z: Zitat) {
  const einzeilig = (t: string) => t.replace(/\s+/g, " ").trim();
  const quelle = istPdfName(z.quelle)
    ? { type: "wikilink", attrs: { ziel: zielText(z.quelle, z.seite), label: null } }
    : { type: "text", text: quellenAngabe(z) };
  const absaetze: object[] = [
    {
      type: "paragraph",
      content: [{ type: "text", marks: [{ type: "italic" }], text: `„${einzeilig(z.text)}“ ` }, { type: "text", text: "(" }, quelle, { type: "text", text: ")" }],
    },
  ];
  if (z.notiz) {
    absaetze.push({
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "bold" }], text: "Notiz:" },
        { type: "text", text: ` ${einzeilig(z.notiz)}` },
      ],
    });
  }
  return absaetze;
}

/**
 * Notiz-Editor mit Word-artiger Leiste. Speichert Markdown (Obsidian-kompatibel):
 * Verlinkungen als [[…]], Callouts als > [!typ], Farben/Ausrichtung als HTML-Schnipsel.
 */
export function NotizEditorFlaeche({
  notizId,
  wert,
  onAendern,
  ziele,
  aufloesen,
  onLinkOeffnen,
  onEditor,
  platzhalter,
  label,
  werkzeugExtra,
}: {
  /** ID der Notiz – UniVerse Studio kann Text hineinschreiben, solange sie offen ist */
  notizId?: string;
  /** Startinhalt; spätere Änderungen von außen → per key neu mounten */
  wert: string;
  onAendern: (markdown: string) => void;
  ziele: LinkZiel[];
  aufloesen: (ziel: string) => LinkAufloesung;
  /** Verlinkung angeklickt; `daneben` bei Strg/⌘+Klick */
  onLinkOeffnen: (ziel: string, daneben: boolean) => void;
  onEditor?: (editor: Editor | null) => void;
  platzhalter?: string;
  label?: string;
  werkzeugExtra?: (editor: Editor) => ReactNode;
}) {
  const onAendernRef = useRef(onAendern);
  const aufloesenRef = useRef(aufloesen);
  const oeffnenRef = useRef(onLinkOeffnen);
  const editorRef = useRef<Editor | null>(null);
  const [zitatZiel, setZitatZiel] = useState(false);
  useEffect(() => {
    onAendernRef.current = onAendern;
    aufloesenRef.current = aufloesen;
    oeffnenRef.current = onLinkOeffnen;
  }, [onAendern, aufloesen, onLinkOeffnen]);

  const editor = useEditor({
    // Die Refs werden nur in Klick-/Darstellungs-Rückrufen gelesen, nie beim Rendern
    // eslint-disable-next-line react-hooks/refs
    extensions: editorErweiterungen({
      voll: true,
      platzhalter,
      aufloesen: (ziel) => aufloesenRef.current(ziel),
      onFormelKlick: (art, latex, pos) => {
        const neu = window.prompt("Formel (LaTeX) bearbeiten – leer lassen zum Löschen:", latex);
        const e = editorRef.current;
        if (neu === null || !e) return;
        if (!neu.trim()) {
          e.chain().focus().setNodeSelection(pos).deleteSelection().run();
          return;
        }
        if (art === "inline") e.chain().focus().updateInlineMath({ latex: neu.trim(), pos }).run();
        else e.chain().focus().updateBlockMath({ latex: neu.trim(), pos }).run();
      },
    }),
    content: wert,
    contentType: "markdown",
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "md-inhalt md-notiz", spellcheck: "true", ...(label ? { "aria-label": label } : {}) },
      handleDOMEvents: {
        click: (_view, event) => {
          const ziel = (event.target as HTMLElement | null)?.closest?.("a[data-wikilink]");
          if (ziel) {
            event.preventDefault();
            oeffnenRef.current(ziel.getAttribute("data-ziel") ?? "", event.ctrlKey || event.metaKey);
            return true;
          }
          // Weblinks mit Strg/⌘+Klick öffnen (normaler Klick = Text bearbeiten)
          const weblink = (event.target as HTMLElement | null)?.closest?.("a[href]");
          if (weblink && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            window.open(weblink.getAttribute("href") ?? "", "_blank", "noopener,noreferrer");
            return true;
          }
          return false;
        },
      },
      // Markierung aus dem PDF Reader hier ablegen → Zitat mit Link auf die Seite
      handleDrop: (view, event) => {
        const roh = event.dataTransfer?.getData(ZITAT_DRAG_TYP);
        const zitat = roh ? zitatLesen(roh) : null;
        const e = editorRef.current;
        if (!zitat || !e) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.doc.content.size;
        const $pos = view.state.doc.resolve(pos);
        const ziel = $pos.depth > 0 ? $pos.after(1) : pos;
        e.chain().focus().insertContentAt(ziel, zitatInhalt(zitat)).run();
        track("zitat_eingefuegt", { mit_notiz: Boolean(zitat.notiz) });
        return true;
      },
    },
    onUpdate: ({ editor: e }) => onAendernRef.current(e.getMarkdown()),
  });

  useEffect(() => {
    editorRef.current = editor;
    onEditor?.(editor);
    return () => onEditor?.(null);
  }, [editor, onEditor]);

  // UniVerse Studio schreibt in die offene Notiz (Markdown, an der Cursorposition bzw. am Ende)
  useEffect(() => {
    if (!editor || !notizId) return;
    const einfuegen = (e: Event) => {
      const d = (e as CustomEvent<{ notizId: string; text: string; erledigt: boolean }>).detail;
      if (!d || d.notizId !== notizId) return;
      d.erledigt = true;
      const kette = editor.chain().focus(editor.isFocused ? undefined : "end");
      kette.insertContent(`\n\n${d.text}\n`, { contentType: "markdown" } as never).run();
    };
    window.addEventListener(NOTIZ_EINFUEGEN, einfuegen);
    return () => window.removeEventListener(NOTIZ_EINFUEGEN, einfuegen);
  }, [editor, notizId]);

  return (
    <div
      className={`md-editor md-editor-voll ${zitatZiel ? "zitat-ziel" : ""}`}
      onDragOver={(e) => {
        if (!zitatZiel && e.dataTransfer.types.includes(ZITAT_DRAG_TYP)) setZitatZiel(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as globalThis.Node | null)) setZitatZiel(false);
      }}
      onDrop={() => setZitatZiel(false)}
    >
      {editor && <Werkzeugleiste editor={editor} ziele={ziele} extra={werkzeugExtra?.(editor)} />}
      <EditorContent editor={editor} className="md-flaeche" />
    </div>
  );
}
