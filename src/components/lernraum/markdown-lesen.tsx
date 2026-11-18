"use client";

import "katex/dist/katex.min.css";
import { EditorContent, useEditor } from "@tiptap/react";
import { editorErweiterungen } from "@/components/notizen/editor-erweiterungen";

/**
 * Markdown nur anzeigen (Tabellen, Hinweisboxen, Formeln …) – für KI-Antworten.
 * Links auf "#beleg-Q-S" werden als Beleg-Chips dargestellt und melden Klicks.
 */
export function MarkdownLesen({ wert, onBeleg }: { wert: string; onBeleg?: (quelle: number, seite: number | null) => void }) {
  const editor = useEditor(
    {
      extensions: editorErweiterungen({ voll: true }),
      content: wert,
      contentType: "markdown",
      editable: false,
      immediatelyRender: false,
      // Nur lesen: Tiptap setzt trotzdem role="textbox", deshalb ein Name (axe: aria-input-field-name)
      editorProps: { attributes: { class: "md-inhalt md-notiz md-lesen", "aria-label": "Antwort von Studio" } },
    },
    [wert],
  );
  return (
    <div
      className="md-lesen-rahmen"
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest("a[href]");
        const href = a?.getAttribute("href") ?? "";
        if (href.startsWith("#beleg-")) {
          e.preventDefault();
          const [, q, s] = href.match(/^#beleg-(\d+)-(\d+)$/) ?? [];
          if (q) onBeleg?.(Number(q), Number(s) || null);
        } else if (href === "#ergaenzt" || href === "#web") {
          e.preventDefault();
        } else if (a && /^https?:/i.test(href)) {
          e.preventDefault();
          window.open(href, "_blank", "noopener,noreferrer");
        }
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
