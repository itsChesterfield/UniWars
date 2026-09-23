"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createUnterpunkte } from "@/app/todo/actions";
import { createDeadline } from "@/app/deadline/actions";
import {
  todoMitgliederLaden,
  deadlineMitgliederLaden,
  pruefungMitgliederLaden,
} from "@/app/einladung/actions";
import {
  UnteraufgabenEditor,
  type EditorMitglied,
  type UnteraufgabeEingabe,
} from "@/components/unteraufgaben-editor";

export type UnteraufgabenParentTyp = "todo" | "deadline" | "pruefung";

const MITGLIEDER_LADEN: Record<UnteraufgabenParentTyp, (id: string) => Promise<EditorMitglied[]>> = {
  todo: todoMitgliederLaden,
  deadline: deadlineMitgliederLaden,
  pruefung: pruefungMitgliederLaden,
};

export function UnteraufgabenDialog({
  parentTyp,
  parentId,
  parentTitel,
  fachId,
  onClose,
}: {
  parentTyp: UnteraufgabenParentTyp;
  parentId: string;
  parentTitel: string;
  fachId: string | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [mitglieder, setMitglieder] = useState<EditorMitglied[]>([]);

  useEffect(() => {
    dialogRef.current?.showModal();
    MITGLIEDER_LADEN[parentTyp](parentId)
      .then(setMitglieder)
      .catch(() => setMitglieder([]));
  }, [parentTyp, parentId]);

  function schliessen() {
    dialogRef.current?.close();
    onClose();
  }

  async function speichern(eintraege: UnteraufgabeEingabe[]) {
    if (parentTyp === "todo") {
      await createUnterpunkte(
        parentId,
        fachId,
        eintraege.map((e) => ({
          titel: e.titel,
          faelligAm: e.faelligAm ? new Date(e.faelligAm).toISOString() : undefined,
          zugewiesenAn: e.zugewiesenAn || undefined,
        })),
      );
    } else {
      for (const e of eintraege) {
        await createDeadline({
          titel: e.titel,
          fach_id: fachId,
          faellig_am: new Date(e.faelligAm).toISOString(),
          typ: "ABGABE",
          kategorie: "NORMAL",
          pruefungId: parentTyp === "pruefung" ? parentId : undefined,
          parentDeadlineId: parentTyp === "deadline" ? parentId : undefined,
          zugewiesenAn: e.zugewiesenAn || undefined,
        });
      }
    }
    router.refresh();
    schliessen();
  }

  return (
    <dialog
      ref={dialogRef}
      className="quick-add-modal"
      onCancel={(e) => {
        e.preventDefault();
        schliessen();
      }}
    >
      <h3>Unteraufgaben hinzufügen?</h3>
      <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
        Für „{parentTitel}“ — optional.
      </p>

      <UnteraufgabenEditor
        mitglieder={mitglieder}
        terminPflicht={parentTyp !== "todo"}
        speichernLabel="Fertig"
        abbrechenLabel="Überspringen"
        onSpeichern={speichern}
        onAbbrechen={schliessen}
      />
    </dialog>
  );
}
