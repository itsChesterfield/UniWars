"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { karteUebernehmen, karteVerwerfen, type KartenAenderung } from "@/app/(hubs)/assistent/actions";
import { datumText, PRIORITAETEN, type Aktionskarte } from "@/lib/ki/assistent";
import type { KiErgebnis } from "@/lib/ki/ergebnis";
import { kiVorschauUebernommen, type KiFunktionsId } from "@/lib/ki/tracking";
import { berlinDatum, berlinUhrzeit } from "@/lib/zeit";
import { track } from "@/lib/analytics";

type Fach = { id: string; name: string };

/** Woher die Karte stammt: Antwort im Assistenten (Standard) oder z. B. Tagesvorschläge */
export type KartenAktionen = {
  uebernehmen: (karteId: string, aenderung: KartenAenderung | null) => Promise<KiErgebnis<{ karte: Aktionskarte; link: string | null }>>;
  verwerfen: (karteId: string) => Promise<KiErgebnis<null>>;
  verwerfenText: string;
  funktion: KiFunktionsId;
};

const KOPF: Record<Aktionskarte["typ"], string> = {
  deadline: "📅 Deadline",
  todo: "✅ To-do",
  notiz: "📝 Notiz",
  karteikarten: "🗂 Karteikarten",
  lernsession: "⏱ Fokus-Session",
  stapel_lernen: "🧠 Karten lernen",
};

const PRIO_TEXT: Record<string, string> = { HOCH: "hoch", MITTEL: "mittel", NIEDRIG: "niedrig" };

/** ISO → Wert für <input type="datetime-local"> in Berliner Zeit */
function lokal(iso: string) {
  const d = new Date(iso);
  return `${berlinDatum(d)}T${berlinUhrzeit(d)}`;
}

/**
 * KI-12 (8.4): Aktionskarte in einer Antwort des Assistenten. Erst „Übernehmen“ speichert –
 * über die bestehenden Actions. Der Status bleibt an der Nachricht gespeichert.
 */
export function AktionskarteAnzeige({
  karte: start,
  nachrichtId = null,
  faecher,
  aktionen,
  onGeaendert,
}: {
  karte: Aktionskarte;
  /** null, solange die Antwort noch läuft (dann sind die Knöpfe gesperrt) */
  nachrichtId?: string | null;
  faecher: Fach[];
  /** statt der Assistent-Actions (dann ist nachrichtId egal) */
  aktionen?: KartenAktionen;
  onGeaendert?: (karte: Aktionskarte) => void;
}) {
  const router = useRouter();
  const [karte, setKarte] = useState(start);
  const [link, setLink] = useState<string | null>(null);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [entwurf, setEntwurf] = useState<KartenAenderung>({});
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const navigation = karte.typ === "lernsession" || karte.typ === "stapel_lernen";
  const bereit = Boolean(aktionen || nachrichtId);
  const funktion = aktionen?.funktion ?? "ki12";

  async function uebernehmen(aenderung: KartenAenderung | null) {
    if (!bereit) return;
    setFehler(null);
    setLaeuft(true);
    const a = await (aktionen ? aktionen.uebernehmen(karte.id, aenderung) : karteUebernehmen(nachrichtId as string, karte.id, aenderung)).catch(() => null);
    setLaeuft(false);
    if (!a?.ok) {
      setFehler(a && !a.ok ? a.fehler : "Das hat nicht geklappt. Bitte versuch es noch einmal.");
      return;
    }
    setKarte(a.daten.karte);
    onGeaendert?.(a.daten.karte);
    setLink(a.daten.link);
    setBearbeiten(false);
    track("ki_aktionskarte", { typ: karte.typ, ergebnis: aenderung ? "bearbeitet" : "uebernommen", funktion });
    kiVorschauUebernommen(funktion, 1, aenderung ? 1 : 0);
    if (navigation && a.daten.link) router.push(a.daten.link);
    else router.refresh();
  }

  async function verwerfen() {
    if (!bereit) return;
    setLaeuft(true);
    const a = await (aktionen ? aktionen.verwerfen(karte.id) : karteVerwerfen(nachrichtId as string, karte.id)).catch(() => null);
    setLaeuft(false);
    if (a?.ok) {
      setKarte({ ...karte, status: "verworfen" });
      onGeaendert?.({ ...karte, status: "verworfen" });
      track("ki_aktionskarte", { typ: karte.typ, ergebnis: "verworfen", funktion });
    } else setFehler("Das hat nicht geklappt.");
  }

  function bearbeitenStarten() {
    setFehler(null);
    if (karte.typ === "deadline") setEntwurf({ titel: karte.titel, faellig_am: lokal(karte.faellig_am), fach_id: karte.fach_id });
    else if (karte.typ === "todo") setEntwurf({ titel: karte.titel, fach_id: karte.fach_id, prioritaet: karte.prioritaet });
    else if (karte.typ === "notiz") setEntwurf({ titel: karte.titel, inhalt: karte.inhalt, fach_id: karte.fach_id });
    else if (karte.typ === "karteikarten") setEntwurf({ karten: karte.karten.map((k) => ({ ...k })) });
    setBearbeiten(true);
  }

  const fachName = (id: string | null | undefined) => faecher.find((f) => f.id === id)?.name ?? null;
  const fachWahl = (
    <label className="ki-feld">
      <span>Fach</span>
      <select className="field" value={entwurf.fach_id ?? ""} onChange={(e) => setEntwurf({ ...entwurf, fach_id: e.target.value || null })}>
        <option value="">Ohne Fach</option>
        {faecher.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className={`ki-karte ki-karte-${karte.status}`} role="group" aria-label={`Vorschlag: ${KOPF[karte.typ]}`}>
      <div className="ki-karte-kopf">
        <span>{KOPF[karte.typ]}</span>
        {karte.status === "uebernommen" && <span className="ki-karte-status">✓ Übernommen</span>}
        {karte.status === "verworfen" && <span className="ki-karte-status muted">{aktionen ? "Ausgeblendet" : "Verworfen"}</span>}
      </div>

      {!bearbeiten ? (
        <div className="ki-karte-inhalt">
          {karte.typ === "deadline" && (
            <>
              <strong>{karte.titel}</strong>
              <span className="muted">
                {datumText(karte.faellig_am)}
                {karte.fach_name ? ` · ${karte.fach_name}` : ""}
              </span>
            </>
          )}
          {karte.typ === "todo" && (
            <>
              <strong>{karte.titel}</strong>
              <span className="muted">
                Priorität {PRIO_TEXT[karte.prioritaet]}
                {karte.fach_name ? ` · ${karte.fach_name}` : ""}
              </span>
            </>
          )}
          {karte.typ === "notiz" && (
            <>
              <strong>{karte.titel}</strong>
              <span className="muted ki-karte-auszug">{karte.inhalt.slice(0, 220)}{karte.inhalt.length > 220 ? " …" : ""}</span>
            </>
          )}
          {karte.typ === "karteikarten" && (
            <>
              <strong>
                {karte.karten.length} {karte.karten.length === 1 ? "Karte" : "Karten"} für „{karte.stapel_name}“{karte.stapel_id ? "" : " (neuer Stapel)"}
              </strong>
              <ul className="ki-karte-liste">
                {karte.karten.slice(0, 4).map((k, i) => (
                  <li key={i}>
                    <span>{k.vorderseite}</span> → <span className="muted">{k.rueckseite}</span>
                  </li>
                ))}
                {karte.karten.length > 4 && <li className="muted">… und {karte.karten.length - 4} weitere</li>}
              </ul>
            </>
          )}
          {karte.typ === "lernsession" && (
            <strong>
              Fokus-Session{karte.fach_name ? ` · ${karte.fach_name}` : ""}
              {karte.minuten ? ` · ${karte.minuten} Min` : ""}
            </strong>
          )}
          {karte.typ === "stapel_lernen" && (
            <strong>
              {karte.faellig} fällige {karte.faellig === 1 ? "Karte" : "Karten"} in „{karte.stapel_name}“
            </strong>
          )}
        </div>
      ) : (
        <div className="ki-karte-form">
          {"titel" in entwurf && (
            <label className="ki-feld">
              <span>Titel</span>
              <input className="field" value={entwurf.titel ?? ""} maxLength={200} onChange={(e) => setEntwurf({ ...entwurf, titel: e.target.value })} />
            </label>
          )}
          {karte.typ === "deadline" && (
            <label className="ki-feld">
              <span>Fällig am</span>
              <input className="field" type="datetime-local" value={entwurf.faellig_am ?? ""} onChange={(e) => setEntwurf({ ...entwurf, faellig_am: e.target.value })} />
            </label>
          )}
          {karte.typ === "todo" && (
            <label className="ki-feld">
              <span>Priorität</span>
              <select className="field" value={entwurf.prioritaet ?? "MITTEL"} onChange={(e) => setEntwurf({ ...entwurf, prioritaet: e.target.value })}>
                {PRIORITAETEN.map((p) => (
                  <option key={p} value={p}>
                    {PRIO_TEXT[p]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(karte.typ === "deadline" || karte.typ === "todo" || karte.typ === "notiz") && fachWahl}
          {karte.typ === "notiz" && (
            <label className="ki-feld">
              <span>Inhalt</span>
              <textarea className="field" rows={6} value={entwurf.inhalt ?? ""} onChange={(e) => setEntwurf({ ...entwurf, inhalt: e.target.value })} />
            </label>
          )}
          {karte.typ === "karteikarten" &&
            (entwurf.karten ?? []).map((k, i) => (
              <div key={i} className="ki-karte-kk">
                <input
                  className="field"
                  aria-label={`Karte ${i + 1}: Vorderseite`}
                  value={k.vorderseite}
                  onChange={(e) => setEntwurf({ ...entwurf, karten: entwurf.karten?.map((x, j) => (j === i ? { ...x, vorderseite: e.target.value } : x)) })}
                />
                <input
                  className="field"
                  aria-label={`Karte ${i + 1}: Rückseite`}
                  value={k.rueckseite}
                  onChange={(e) => setEntwurf({ ...entwurf, karten: entwurf.karten?.map((x, j) => (j === i ? { ...x, rueckseite: e.target.value } : x)) })}
                />
                <button
                  type="button"
                  className="icon-knopf"
                  aria-label={`Karte ${i + 1} entfernen`}
                  onClick={() => setEntwurf({ ...entwurf, karten: entwurf.karten?.filter((_, j) => j !== i) })}
                >
                  🗑
                </button>
              </div>
            ))}
          {karte.typ !== "karteikarten" && entwurf.fach_id !== undefined && fachName(entwurf.fach_id) === null && entwurf.fach_id && (
            <p className="muted">Fach nicht mehr vorhanden.</p>
          )}
        </div>
      )}

      {fehler && <p className="auth-error ki-karte-fehler">{fehler}</p>}

      {karte.status === "offen" ? (
        <div className="ki-karte-knoepfe">
          {bearbeiten ? (
            <>
              <button type="button" className="btng" disabled={laeuft} onClick={() => setBearbeiten(false)}>
                Abbrechen
              </button>
              <button type="button" className="btnp" disabled={laeuft || !bereit} onClick={() => void uebernehmen(entwurf)}>
                {laeuft ? "Speichert …" : "Speichern"}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="link-knopf" disabled={laeuft || !bereit} onClick={() => void verwerfen()}>
                {aktionen?.verwerfenText ?? "Verwerfen"}
              </button>
              {!navigation && (
                <button type="button" className="btng" disabled={laeuft || !bereit} onClick={bearbeitenStarten}>
                  Bearbeiten
                </button>
              )}
              <button type="button" className="btnp" disabled={laeuft || !bereit} onClick={() => void uebernehmen(null)}>
                {laeuft ? "…" : navigation ? (karte.typ === "lernsession" ? "Starten" : "Jetzt lernen") : "Übernehmen"}
              </button>
            </>
          )}
        </div>
      ) : (
        karte.status === "uebernommen" &&
        (link ?? standardLink(karte)) && (
          <div className="ki-karte-knoepfe">
            <Link href={(link ?? standardLink(karte)) as string} className="link-knopf">
              Öffnen
            </Link>
          </div>
        )
      )}
    </div>
  );
}

/** Link zu einem übernommenen Vorschlag (nach dem Neuladen) */
function standardLink(k: Aktionskarte): string | null {
  if (!k.ergebnisId) return k.typ === "lernsession" ? "/work-station" : null;
  if (k.typ === "deadline") return `/?detail=deadline:${k.ergebnisId}`;
  if (k.typ === "todo") return `/?detail=todo:${k.ergebnisId}`;
  if (k.typ === "notiz") return `/notizen?id=${k.ergebnisId}`;
  if (k.typ === "karteikarten") return `/karteikarten/${k.ergebnisId}`;
  if (k.typ === "stapel_lernen") return `/karteikarten/${k.ergebnisId}/lernen`;
  return null;
}
