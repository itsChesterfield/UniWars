"use client";

import { useRef, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";
import { hubVonId } from "@/lib/hubs/navigation";
import { ALLE_BEREICHE } from "@/lib/personalisierung";
import { BUCKET, FLAECHEN, FLAECHEN_NAMEN, MAX_BILDER, leererHintergrund, type Abdunkeln, type Groesse, type Hintergrund, type Mitte, type Wahl } from "@/lib/hintergrund";
import { BildFehler, bildVorbereiten, eingabePruefen } from "@/lib/bild-verkleinern";
import { bildAufnehmen, bildLoeschen, hintergrundSpeichern, uploadVerwerfen } from "@/app/settings/hintergrund-actions";
import { rueckfrage } from "@/components/rueckfrage";
import { Abschnitt, Segment, Zeile } from "@/components/einstellungen/personalisierung";

const FEHLER = "Das hat nicht geklappt. Deine vorige Einstellung gilt weiter, versuch es bitte noch einmal.";

/**
 * Personalisierung › Eigene Bilder: hochladen, ein Standardbild, je Fläche ersetzbar (Symbolleiste, Studio, Bereiche,
 * einzelne Bereiche). Dieselben Bilder in beiden Designs; die Lesbarkeit sichert der Schleier (lib/hintergrund.ts).
 */
export function EigeneBilder({ hintergrund, vorschau, userId }: { hintergrund: Hintergrund; vorschau: Record<string, string>; userId: string }) {
  const router = useRouter();
  const [h, setH] = useState(hintergrund);
  const [basis, setBasis] = useState(hintergrund);
  // Neuer Stand vom Server (nach Hochladen oder Löschen): übernehmen
  if (basis !== hintergrund) {
    setBasis(hintergrund);
    setH(hintergrund);
  }
  const [auswahl, setAuswahl] = useState<string | null>(hintergrund.standard);
  const [status, setStatus] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [, starte] = useTransition();
  const eingabe = useRef<HTMLInputElement>(null);

  const nummer = (id: string) => h.bilder.findIndex((b) => b.id === id) + 1;
  const bildName = (id: string) => `Bild ${nummer(id)}`;
  const gewaehlt = h.bilder.find((b) => b.id === auswahl) ?? h.bilder.find((b) => b.id === h.standard) ?? null;

  function speichern(neu: Hintergrund, was: string) {
    const vorher = h;
    setH(neu);
    setFehler(null);
    track("bilder_geaendert", { was });
    starte(async () => {
      const { ok } = await hintergrundSpeichern(neu).catch(() => ({ ok: false }));
      if (!ok) {
        setH(vorher);
        setFehler(FEHLER);
      } else router.refresh();
    });
  }

  const bildSetzen = (id: string, teil: { mitte?: Mitte; abdunkeln?: Abdunkeln; unschaerfe?: boolean }, was: string) =>
    speichern({ ...h, bilder: h.bilder.map((b) => (b.id === id ? { ...b, ...teil } : b)) }, was);

  async function hochladen(datei: File) {
    setFehler(null);
    const problem = eingabePruefen(datei);
    if (problem) return setFehler(problem);
    const id = crypto.randomUUID();
    setLaedt(true);
    try {
      setStatus("Bild wird vorbereitet …");
      const f = await bildVorbereiten(datei);
      setStatus("Bild wird hochgeladen …");
      const supabase = createClient();
      const typ = f.endung === "webp" ? "image/webp" : "image/jpeg";
      const teile: [string, Blob][] = [
        [`${userId}/${id}.${f.endung}`, f.gross],
        [`${userId}/${id}-m.${f.endung}`, f.mittel],
        [`${userId}/${id}-w.${f.endung}`, f.weich],
      ];
      for (const [pfad, blob] of teile) {
        const { error } = await supabase.storage.from(BUCKET).upload(pfad, blob, { contentType: typ, upsert: false, cacheControl: "31536000" });
        if (error) throw new BildFehler("Hochladen");
      }
      const r = await bildAufnehmen({ id, endung: f.endung, tief: f.tief, hoch: f.hoch });
      if (!r.ok) {
        await uploadVerwerfen(id);
        setFehler(r.fehler ?? FEHLER);
        return;
      }
      track("bild_hochgeladen");
      setAuswahl(id);
      setStatus("Bild hinzugefügt.");
      router.refresh();
    } catch (e) {
      await uploadVerwerfen(id).catch(() => undefined);
      setStatus("");
      setFehler(e instanceof BildFehler && e.message === "Lesen" ? "Dieses Bild kann der Browser nicht öffnen. Versuch es mit einem JPEG oder PNG." : FEHLER);
    } finally {
      setLaedt(false);
      if (eingabe.current) eingabe.current.value = "";
    }
  }

  async function loeschen(id: string) {
    if (!(await rueckfrage({ titel: "Bild löschen?", text: `${bildName(id)} wird endgültig gelöscht. Wo es zu sehen war, gilt wieder dein Standardbild.`, ja: "Löschen", gefahr: true }))) return;
    const { ok } = await bildLoeschen(id).catch(() => ({ ok: false }));
    if (!ok) return setFehler(FEHLER);
    track("bild_geloescht");
    setStatus(`${bildName(id)} gelöscht.`);
    setAuswahl(null);
    router.refresh();
  }

  const wahlOptionen = (ersteZeile: string) => (
    <>
      <option value="standard">{ersteZeile}</option>
      {h.bilder.map((b) => (
        <option key={b.id} value={b.id}>
          {bildName(b.id)}
        </option>
      ))}
      <option value="aus">Kein Bild</option>
    </>
  );

  const voll = h.bilder.length >= MAX_BILDER;

  return (
    <Abschnitt
      id="bilder"
      titel="Eigene Bilder"
      text="Ein Bild für Symbolleiste, Studio und Bereiche, jede Stelle kann auch ein anderes zeigen. Schrift bleibt immer lesbar: UniVerse dunkelt das Bild so weit ab, oder hellt es im hellen Design so weit auf, wie nötig."
    >
      <p className="vh" aria-live="polite">
        {status}
      </p>

      <div className="eb-reihe" role="group" aria-label="Meine Bilder">
        {h.bilder.map((b) => (
          <button
            key={b.id}
            type="button"
            className="eb-bild"
            aria-pressed={gewaehlt?.id === b.id}
            aria-label={`${bildName(b.id)}${b.id === h.standard ? ", Standard" : ""}`}
            onClick={() => setAuswahl(b.id)}
          >
            <span className="eb-vorschau" data-mitte={b.mitte} style={vorschau[b.id] ? ({ "--vorschau": `url(${JSON.stringify(vorschau[b.id])})` } as CSSProperties) : undefined} />
            {b.id === h.standard && <span className="eb-marke">Standard</span>}
          </button>
        ))}
        <label className={`eb-neu${laedt || voll ? " aus" : ""}`}>
          <input
            ref={eingabe}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="eb-datei"
            disabled={laedt || voll}
            onChange={(e) => {
              const d = e.target.files?.[0];
              if (d) void hochladen(d);
            }}
          />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>{laedt ? "Lädt …" : voll ? "Voll" : "Bild hinzufügen"}</span>
        </label>
      </div>
      <p className="p-info eb-hinweis">
        {h.bilder.length} von {MAX_BILDER}. JPEG, PNG oder WebP bis 20 MB. UniVerse verkleinert das Bild und entfernt Ort und Kameradaten, bevor es gespeichert wird. Nur du siehst deine Bilder.
      </p>

      {gewaehlt && (
        <div className="eb-regler" aria-label={`Einstellungen für ${bildName(gewaehlt.id)}`} role="group">
          <Zeile label={bildName(gewaehlt.id)} info={gewaehlt.id === h.standard ? "Dein Standardbild" : "Zeigt sich überall dort, wo du es unten auswählst."}>
            {gewaehlt.id !== h.standard ? (
              <button type="button" className="knopf leise klein" onClick={() => speichern({ ...h, standard: gewaehlt.id }, "standard")}>
                Als Standard nehmen
              </button>
            ) : (
              <span />
            )}
          </Zeile>
          <Zeile label="Ausschnitt" info="Welcher Teil des Bildes sichtbar bleibt, wenn die Fläche schmaler ist als das Bild.">
            <Segment label="Ausschnitt" wert={gewaehlt.mitte} optionen={[["oben", "Oben"], ["mitte", "Mitte"], ["unten", "Unten"]]} onWahl={(w) => bildSetzen(gewaehlt.id, { mitte: w }, "ausschnitt")} />
          </Zeile>
          <Zeile label="Schleier" info="Wie stark das Bild hinter der Schrift zurücktritt. Normal reicht immer zum Lesen.">
            <Segment
              label="Schleier"
              wert={String(gewaehlt.abdunkeln) as "0" | "1" | "2"}
              optionen={[["0", "Normal"], ["1", "Mehr"], ["2", "Viel"]]}
              onWahl={(w) => bildSetzen(gewaehlt.id, { abdunkeln: Number(w) as Abdunkeln }, "schleier")}
            />
          </Zeile>
          <Zeile label="Unscharf" info="Ruhiger hinter Text. Symbolleiste und Studio zeigen das Bild immer unscharf.">
            <button
              type="button"
              className="schalter"
              role="switch"
              aria-checked={gewaehlt.unschaerfe}
              aria-label="Bild unscharf zeigen"
              onClick={() => bildSetzen(gewaehlt.id, { unschaerfe: !gewaehlt.unschaerfe }, "unschaerfe")}
            />
          </Zeile>
          <Zeile label="Bild löschen" info="Endgültig, auch aus allen Stellen, an denen es zu sehen ist.">
            <button type="button" className="knopf gefahr klein" onClick={() => void loeschen(gewaehlt.id)}>
              Löschen
            </button>
          </Zeile>
        </div>
      )}

      {h.bilder.length > 0 && (
        <>
          <h3 className="p-gruppe-t">Wo es zu sehen ist</h3>
          {FLAECHEN.map((f) => (
            <Zeile key={f} label={FLAECHEN_NAMEN[f]} info={f === "bereiche" ? "Kopf jeder Übersichtsseite und der Hub." : undefined}>
              <select className="field eb-wahl" aria-label={`Bild für ${FLAECHEN_NAMEN[f]}`} value={h.flaechen[f]} onChange={(e) => speichern({ ...h, flaechen: { ...h.flaechen, [f]: e.target.value as Wahl } }, `flaeche_${f}`)}>
                {wahlOptionen("Standardbild")}
              </select>
            </Zeile>
          ))}
          <Zeile label="Größe in den Bereichen" info="Kopf: nur oben. Groß: bis weit in die Seite. Ganze Seite: hinter allem, ruhig abgedunkelt.">
            <Segment label="Größe in den Bereichen" wert={h.groesse} optionen={[["kopf", "Kopf"], ["gross", "Groß"], ["seite", "Ganze Seite"]]} onWahl={(w: Groesse) => speichern({ ...h, groesse: w }, "groesse")} />
          </Zeile>
          <details className="eb-einzeln">
            <summary>Einzelne Bereiche anders</summary>
            {ALLE_BEREICHE.map((id) => {
              const name = hubVonId(id)?.name ?? id;
              return (
                <Zeile key={id} label={name}>
                  <select
                    className="field eb-wahl"
                    aria-label={`Bild für ${name}`}
                    value={h.bereich[id] ?? "standard"}
                    onChange={(e) => {
                      const bereich = { ...h.bereich };
                      if (e.target.value === "standard") delete bereich[id];
                      else bereich[id] = e.target.value as Wahl;
                      speichern({ ...h, bereich }, "bereich");
                    }}
                  >
                    {wahlOptionen("Wie alle Bereiche")}
                  </select>
                </Zeile>
              );
            })}
          </details>
          <Zeile label="Beim Lernen ausblenden" info="Im Lernmodus, im PDF Reader und in den Editoren ohne Bild.">
            <button type="button" className="schalter" role="switch" aria-checked={h.lernen_aus} aria-label="Bilder beim Lernen ausblenden" onClick={() => speichern({ ...h, lernen_aus: !h.lernen_aus }, "lernen_aus")} />
          </Zeile>
          <Zeile label="Zuordnung zurücksetzen" info="Alle Stellen zeigen wieder das Standardbild. Deine Bilder bleiben.">
            <button
              type="button"
              className="knopf leise klein"
              onClick={() => {
                const leer = leererHintergrund();
                speichern({ ...h, flaechen: leer.flaechen, bereich: {}, groesse: leer.groesse, lernen_aus: leer.lernen_aus }, "zuruecksetzen");
              }}
            >
              Zurücksetzen
            </button>
          </Zeile>
        </>
      )}

      {fehler && (
        <p className="p-meldung" role="alert">
          <span>{fehler}</span>
          <button type="button" className="knopf leise klein" onClick={() => setFehler(null)}>
            Schließen
          </button>
        </p>
      )}
    </Abschnitt>
  );
}
