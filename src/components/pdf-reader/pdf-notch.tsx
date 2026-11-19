"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "@/components/nav-icon";
import { browserWertSchreiben, useBrowserWert } from "@/lib/browser-wert";
import { pdfPfad } from "@/lib/pdf-reader/fundstelle";

type Pdf = { id: string; name: string };
const LEER = "[]";

function idsLesen(roh: string): string[] {
  try {
    const wert: unknown = JSON.parse(roh);
    return Array.isArray(wert) ? wert.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function PdfNotch({ userId, aktuell, verfuegbar }: { userId: string; aktuell: Pdf; verfuegbar: Pdf[] }) {
  const schluessel = `uniwars-offene-pdfs-v1:${userId}`;
  const roh = useBrowserWert(schluessel, LEER);
  useEffect(() => {
    const ids = idsLesen(roh);
    if (!ids.includes(aktuell.id)) {
      browserWertSchreiben(schluessel, JSON.stringify([...ids.slice(-9), aktuell.id]));
    }
  }, [schluessel, aktuell.id, roh]);

  const nachId = new Map(verfuegbar.map((pdf) => [pdf.id, pdf]));
  const pdfs = idsLesen(roh).flatMap((id) => {
    const pdf = nachId.get(id);
    return pdf ? [pdf] : [];
  });
  if (pdfs.length < 2) return null;

  return (
    <nav className="haupt-notch pdf-notch" aria-label="Offene PDFs">
      {pdfs.map((pdf) => (
        <div className="pdf-notch-eintrag" key={pdf.id}>
          <Link href={pdfPfad(pdf.id)} className={pdf.id === aktuell.id ? "an" : undefined}
            aria-current={pdf.id === aktuell.id ? "page" : undefined} title={pdf.name} prefetch={false}>
            {pdf.name}
          </Link>
          {pdf.id !== aktuell.id && (
            <button type="button" className="knopf leise klein nur-symbol" aria-label={`${pdf.name} schließen`}
              onClick={() => browserWertSchreiben(schluessel, JSON.stringify(idsLesen(roh).filter((id) => id !== pdf.id)))}>
              <Icon name="schliessen" groesse={14} />
            </button>
          )}
        </div>
      ))}
    </nav>
  );
}
