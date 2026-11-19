"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";
import { pdfjsLaden } from "@/lib/pdf-reader/pdfjs-browser";

export function PdfVorschau({ url, titel }: { url: string; titel: string }) {
  const flaeche = useRef<HTMLCanvasElement>(null);
  const [zustand, setZustand] = useState<"laedt" | "fertig" | "fehler">("laedt");

  useEffect(() => {
    let aktiv = true;
    let laden: PDFDocumentLoadingTask | undefined;
    let zeichnen: RenderTask | undefined;
    async function ersteSeite() {
      const pdfjs = await pdfjsLaden();
      if (!aktiv) return;
      laden = pdfjs.getDocument({ url, isOffscreenCanvasSupported: false });
      const doc = await laden.promise;
      const seite = await doc.getPage(1);
      const canvas = flaeche.current;
      if (!aktiv || !canvas) return;
      const original = seite.getViewport({ scale: 1 });
      const viewport = seite.getViewport({ scale: Math.min(1_800 / original.width, 1_600 / original.height) });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.style.setProperty("--pdf-vorschau-format", String(original.width / original.height));
      zeichnen = seite.render({ canvas, viewport });
      await zeichnen.promise;
      if (aktiv) setZustand("fertig");
    }
    void ersteSeite().catch(() => { if (aktiv) setZustand("fehler"); });
    return () => {
      aktiv = false;
      zeichnen?.cancel();
      void laden?.destroy().catch(() => undefined);
    };
  }, [url]);

  return (
    <>
      {zustand === "laedt" && <p role="status">PDF-Seite wird geladen</p>}
      {zustand === "fehler" && <p role="status">Die erste PDF-Seite konnte nicht angezeigt werden.</p>}
      <canvas className="dat-material-pdf" ref={flaeche} hidden={zustand !== "fertig"} role="img" aria-label={`${titel}, erste Seite`} />
    </>
  );
}
