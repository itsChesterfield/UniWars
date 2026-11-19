"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "@/components/nav-icon";

export function MaterialDialog({ titel, schliessen, children }: { titel: string; schliessen: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const ausloeser = document.activeElement;
    dialog.current?.showModal();
    return () => { if (ausloeser instanceof HTMLElement) ausloeser.focus(); };
  }, []);
  return (
    <dialog ref={dialog} className="dat-vorschau dat-workflow-dialog" aria-label={titel} onClose={schliessen}>
      <div className="dat-vorschau-kopf">
        <h2 className="dat-vorschau-titel">{titel}</h2>
        <button type="button" className="knopf leise klein nur-symbol" aria-label="Dialog schließen" onClick={schliessen}><Icon name="schliessen" /></button>
      </div>
      {children}
    </dialog>
  );
}
