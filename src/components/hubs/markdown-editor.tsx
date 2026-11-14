"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";

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
    label: "☑",
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
          aria-label={k.titel}
          aria-pressed={aktiv[i]}
          className={`md-knopf ${aktiv[i] ? "an" : ""} ${k.label === "B" ? "md-fett" : ""} ${k.label === "I" ? "md-kursiv" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => k.ausfuehren(editor)}
        >
          {k.label}
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

  const editor = useEditor({
    extensions: erweiterungen(platzhalter),
    content: wert,
    contentType: "markdown",
    immediatelyRender: false,
    autofocus: autoFokus ? "end" : false,
    editorProps: { attributes: { class: "md-inhalt", ...(label ? { "aria-label": label } : {}) } },
    onUpdate: ({ editor: e }) => onAendernRef.current(e.getMarkdown()),
  });

  return (
    <div className={`md-editor ${kompakt ? "md-kompakt" : ""}`}>
      {editor && <Werkzeugleiste editor={editor} extra={werkzeugExtra} />}
      <EditorContent editor={editor} className="md-flaeche" />
    </div>
  );
}

/** Nur anzeigen (z. B. Karteikarte im Lernmodus). */
export function MarkdownAnzeige({ wert, className }: { wert: string; className?: string }) {
  const editor = useEditor(
    {
      extensions: erweiterungen(),
      content: wert,
      contentType: "markdown",
      editable: false,
      immediatelyRender: false,
      editorProps: { attributes: { class: "md-inhalt" } },
    },
    [wert],
  );
  return <EditorContent editor={editor} className={`md-anzeige ${className ?? ""}`} />;
}

/** Markdown grob zu Klartext – für Vorschauen in Listen (NOT-03). */
export function markdownAlsText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, "")
    .replace(/^\s*([-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
