"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { ZITAT_DRAG_TYP, quellenAngabe, zitatLesen, type Zitat } from "@/lib/geteilte-ansicht";
import { track } from "@/lib/analytics";

// NOT-02 (Version 1): Überschrift, fett, kursiv, Aufzählung, Nummerierung, Checkliste, Code-Block.
// Gespeichert wird Markdown. Kürzel wie Strg+B, "# " oder "- " funktionieren direkt.
function erweiterungen(platzhalter?: string) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      blockquote: false,
      horizontalRule: false,
      strike: false,
      underline: false,
      link: { openOnClick: false, autolink: true },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown,
    ...(platzhalter ? [Placeholder.configure({ placeholder: platzhalter })] : []),
  ];
}

/** Gezogene Markierung (z. B. aus dem PDF Reader) als eigener Absatz: kursives Zitat + Quelle. */
function zitatInhalt(z: Zitat) {
  const einzeilig = (t: string) => t.replace(/\s+/g, " ").trim();
  const absaetze: object[] = [
    {
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "italic" }], text: `„${einzeilig(z.text)}“` },
        { type: "text", text: ` (${quellenAngabe(z)})` },
      ],
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

type Knopf = {
  label: string;
  titel: string;
  aktiv: (e: Editor) => boolean;
  ausfuehren: (e: Editor) => void;
};

const KNOEPFE: Knopf[] = [
  {
    label: "H",
    titel: "Überschrift",
    aktiv: (e) => e.isActive("heading", { level: 2 }),
    ausfuehren: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  { label: "B", titel: "Fett (Strg+B)", aktiv: (e) => e.isActive("bold"), ausfuehren: (e) => e.chain().focus().toggleBold().run() },
  { label: "I", titel: "Kursiv (Strg+I)", aktiv: (e) => e.isActive("italic"), ausfuehren: (e) => e.chain().focus().toggleItalic().run() },
  {
    label: "•",
    titel: "Aufzählung",
    aktiv: (e) => e.isActive("bulletList"),
    ausfuehren: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    label: "1.",
    titel: "Nummerierte Liste",
    aktiv: (e) => e.isActive("orderedList"),
    ausfuehren: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    label: "✓",
    titel: "Checkliste",
    aktiv: (e) => e.isActive("taskList"),
    ausfuehren: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    label: "</>",
    titel: "Code-Block",
    aktiv: (e) => e.isActive("codeBlock"),
    ausfuehren: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
];

function Werkzeugleiste({ editor, extra }: { editor: Editor; extra?: (editor: Editor) => ReactNode }) {
  const aktiv = useEditorState({
    editor,
    selector: ({ editor: e }) => KNOEPFE.map((k) => k.aktiv(e)),
  });
  return (
    <div className="md-werkzeuge" role="toolbar" aria-label="Formatierung">
      {KNOEPFE.map((k, i) => (
        <button
          key={k.titel}
          type="button"
          title={k.titel}
          aria-pressed={aktiv[i]}
          className={`md-knopf ${aktiv[i] ? "an" : ""} ${k.label === "B" ? "md-fett" : ""} ${k.label === "I" ? "md-kursiv" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => k.ausfuehren(editor)}
        >
          <span aria-hidden>{k.label}</span>
          <span className="sr-only">{k.titel}</span>
        </button>
      ))}
      {extra?.(editor)}
    </div>
  );
}

export function MarkdownEditor({
  wert,
  onAendern,
  platzhalter,
  autoFokus = false,
  kompakt = false,
  label,
  werkzeugExtra,
}: {
  /** Startinhalt; spätere Änderungen von außen werden ignoriert (Editor per key neu mounten). */
  wert: string;
  onAendern: (markdown: string) => void;
  platzhalter?: string;
  autoFokus?: boolean;
  kompakt?: boolean;
  label?: string;
  /** Zusätzliche Knöpfe am Ende der Formatierungsleiste (z. B. KI-13 Diktieren) */
  werkzeugExtra?: (editor: Editor) => ReactNode;
}) {
  const onAendernRef = useRef(onAendern);
  useEffect(() => {
    onAendernRef.current = onAendern;
  }, [onAendern]);

  const editorRef = useRef<Editor | null>(null);
  const [zitatZiel, setZitatZiel] = useState(false);

  const editor = useEditor({
    extensions: erweiterungen(platzhalter),
    content: wert,
    contentType: "markdown",
    immediatelyRender: false,
    autofocus: autoFokus ? "end" : false,
    editorProps: {
      attributes: { class: "md-inhalt", ...(label ? { "aria-label": label } : {}) },
      // Geteilte Ansicht: Markierung aus dem PDF Reader hier ablegen
      handleDrop: (view, event) => {
        const roh = event.dataTransfer?.getData(ZITAT_DRAG_TYP);
        const zitat = roh ? zitatLesen(roh) : null;
        const e = editorRef.current;
        if (!zitat || !e) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.doc.content.size;
        const $pos = view.state.doc.resolve(pos);
        // hinter den Absatz, auf den gezogen wurde – nicht mitten hinein
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
  }, [editor]);

  return (
    <div
      className={`md-editor ${kompakt ? "md-kompakt" : ""} ${zitatZiel ? "zitat-ziel" : ""}`}
      onDragOver={(e) => {
        if (!zitatZiel && e.dataTransfer.types.includes(ZITAT_DRAG_TYP)) setZitatZiel(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setZitatZiel(false);
      }}
      onDrop={() => setZitatZiel(false)}
    >
      {editor && <Werkzeugleiste editor={editor} extra={werkzeugExtra} />}
      <EditorContent editor={editor} className="md-flaeche" />
    </div>
  );
}

/** Nur anzeigen (z. B. Karteikarte im Lernmodus). */
export function MarkdownAnzeige({ wert, className, label }: { wert: string; className?: string; label?: string }) {
  const editor = useEditor(
    {
      extensions: erweiterungen(),
      content: wert,
      contentType: "markdown",
      editable: false,
      immediatelyRender: false,
      editorProps: { attributes: label ? { class: "md-inhalt", "aria-label": label } : { class: "md-inhalt" } },
    },
    [wert],
  );
  return <EditorContent editor={editor} className={`md-anzeige ${className ?? ""}`} />;
}

export { markdownAlsText } from "@/lib/markdown-text";
