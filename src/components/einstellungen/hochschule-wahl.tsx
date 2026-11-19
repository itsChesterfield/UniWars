"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  anmeldeMailUebernehmen,
  hochschuleSetzen,
  hochschulenLaden,
  uniMailBestaetigen,
  uniMailCodeSenden,
  uniMailEntfernen,
} from "@/app/(hubs)/einstellungen/hochschule-actions";
import type { Ergebnis } from "@/app/settings/actions";
import { hochschuleSuchen, type HochschuleKurz } from "@/lib/hochschulen";
import { track } from "@/lib/analytics";
import { Icon } from "@/components/nav-icon";

const FLAGGE: Record<string, string> = { DE: "🇩🇪", AT: "🇦🇹", CH: "🇨🇭" };

// Liste nur einmal pro Sitzung laden (ca. 1.000 Einträge)
let listeLaden: Promise<HochschuleKurz[]> | null = null;
function liste() {
  listeLaden ??= hochschulenLaden().catch((e) => {
    listeLaden = null;
    throw e;
  });
  return listeLaden;
}

export type Verifizierung = {
  email: string;
  bestaetigt: boolean;
  gueltigBis: string | null;
  hochschule: string | null;
  codeOffen: boolean;
};

function Meldung({ e }: { e: Ergebnis | null }) {
  if (!e) return null;
  if (!e.ok) return <p className="auth-error">{e.fehler}</p>;
  return <p className="einst-ok">{e.hinweis ?? "Gespeichert."}</p>;
}

/** Hochschule suchen und wählen (Kürzel, Name oder Ort), sonst frei eintragen */
/** Hochschule suchen; auch in der Einrichtung beim ersten Login */
export function Suche({
  onGewaehlt,
}: {
  onGewaehlt: (h: HochschuleKurz | null, frei?: string) => void;
}) {
  const [alle, setAlle] = useState<HochschuleKurz[] | null>(null);
  const [eingabe, setEingabe] = useState("");
  const [aktiv, setAktiv] = useState(0);
  const [frei, setFrei] = useState(false);
  const feld = useRef<HTMLInputElement>(null);
  const listeId = useId();

  useEffect(() => {
    feld.current?.focus();
    liste().then(setAlle, () => setAlle([]));
  }, []);

  const treffer = alle ? hochschuleSuchen(alle, eingabe, 8) : [];

  if (frei) {
    return (
      <form
        className="hs-frei"
        onSubmit={(e) => {
          e.preventDefault();
          if (eingabe.trim()) onGewaehlt(null, eingabe);
        }}
      >
        <input
          className="field"
          autoFocus
          value={eingabe}
          maxLength={160}
          placeholder="Name deiner Hochschule"
          onChange={(e) => setEingabe(e.target.value)}
        />
        <button type="submit" className="knopf haupt" disabled={!eingabe.trim()}>
          Speichern
        </button>
        <button type="button" className="knopf leise" onClick={() => setFrei(false)}>
          Zurück zur Suche
        </button>
      </form>
    );
  }

  return (
    <div className="hs-suche">
      <input
        ref={feld}
        className="field"
        role="combobox"
        aria-expanded={treffer.length > 0}
        aria-controls={listeId}
        aria-activedescendant={
          treffer[aktiv] ? `${listeId}-${aktiv}` : undefined
        }
        aria-label="Hochschule suchen"
        placeholder={
          alle
            ? "Name, Kürzel oder Ort, z. B. RWTH, LMU, Bochum"
            : "Liste wird geladen …"
        }
        value={eingabe}
        onChange={(e) => {
          setEingabe(e.target.value);
          setAktiv(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setAktiv((a) => Math.min(a + 1, treffer.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setAktiv((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && treffer[aktiv]) {
            e.preventDefault();
            onGewaehlt(treffer[aktiv]);
          }
        }}
      />
      {treffer.length > 0 && (
        <ul
          className="hs-treffer"
          id={listeId}
          role="listbox"
          aria-label="Hochschulen"
        >
          {treffer.map((h, i) => (
            <li
              key={h.id}
              id={`${listeId}-${i}`}
              role="option"
              aria-selected={i === aktiv}
              className={i === aktiv ? "an" : undefined}
              onMouseEnter={() => setAktiv(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                onGewaehlt(h);
              }}
            >
              <span className="hs-name">{h.name}</span>
              <span className="hs-meta">
                {FLAGGE[h.land]}{" "}
                {[h.ort, h.domains[0]].filter(Boolean).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      )}
      {alle && eingabe.trim().length >= 2 && treffer.length === 0 && (
        <p className="muted">Nichts gefunden.</p>
      )}
      <button
        type="button"
        className="link hs-nicht-dabei"
        onClick={() => setFrei(true)}
      >
        Meine Hochschule ist nicht dabei
      </button>
    </div>
  );
}

export function HochschuleWahl({
  hochschule,
  frei,
  verifizierung,
  verifizierbar,
  mailMoeglich = verifizierbar,
  vorschlag,
}: {
  /** Gewählte Hochschule (Name) */
  hochschule: string | null;
  frei: string | null;
  verifizierung: Verifizierung | null;
  /** Secret Key ist eingerichtet (Bestätigen möglich) */
  verifizierbar: boolean;
  /** Mail-Versand ist eingerichtet (Code per Mail möglich) */
  mailMoeglich?: boolean;
  /** Anmelde-Mail gehört zu dieser Hochschule und ist noch nicht als Uni-Mail bestätigt */
  vorschlag: string | null;
}) {
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  const [suchen, setSuchen] = useState(!hochschule && !frei);
  const [wahlErgebnis, setWahlErgebnis] = useState<Ergebnis | null>(null);
  const [mail, setMail] = useState("");
  const [code, setCode] = useState("");
  const [codeGesendet, setCodeGesendet] = useState(
    Boolean(verifizierung?.codeOffen),
  );
  const [mailErgebnis, setMailErgebnis] = useState<Ergebnis | null>(null);

  function ausfuehren(
    aktion: () => Promise<Ergebnis>,
    setzen: (e: Ergebnis) => void,
    ereignis: string,
    danach?: () => void,
  ) {
    starte(async () => {
      try {
        const e = await aktion();
        setzen(e);
        if (e.ok) {
          track(ereignis);
          danach?.();
          router.refresh();
        }
      } catch {
        setzen({
          ok: false,
          fehler: "Das hat nicht geklappt. Bitte versuch es noch einmal.",
        });
      }
    });
  }

  const bestaetigt = verifizierung?.bestaetigt;
  const gueltigBis = verifizierung?.gueltigBis
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(
        new Date(verifizierung.gueltigBis),
      )
    : null;

  return (
    <div className="hs-bereich">
      <div className="hs-zeile">
        {suchen ? (
          <Suche
            onGewaehlt={(h, freiText) =>
              ausfuehren(
                () => hochschuleSetzen(h?.id ?? null, freiText ?? null),
                setWahlErgebnis,
                "hochschule_gewaehlt",
                () => setSuchen(false),
              )
            }
          />
        ) : (
          <div className="hs-gewaehlt">
            <span className="hs-name">{hochschule ?? frei}</span>
            {bestaetigt && <span className="hs-abzeichen"><Icon name="haken" groesse={14} /> Bestätigt</span>}
            <button
              type="button"
              className="knopf leise klein"
              disabled={laeuft}
              onClick={() => setSuchen(true)}
            >
              Ändern
            </button>
          </div>
        )}
        <Meldung e={wahlErgebnis} />
      </div>

      <div className="hs-verif">
        <h3>Uni-Mail bestätigen</h3>
        <p className="muted">
          Damit ist klar, dass du wirklich an deiner Hochschule studierst, zum
          Beispiel für Kommilitonen und Studentenpreise. Die Bestätigung gilt ein
          Jahr.
        </p>

        {bestaetigt ? (
          <div className="hs-gewaehlt">
            <span>
              <b>{verifizierung?.email}</b>
              {verifizierung?.hochschule
                ? `, ${verifizierung.hochschule}`
                : ""}
              {gueltigBis ? `, gültig bis ${gueltigBis}` : ""}
            </span>
            <button
              type="button"
              className="knopf leise klein"
              disabled={laeuft}
              onClick={() =>
                ausfuehren(
                  uniMailEntfernen,
                  setMailErgebnis,
                  "uni_mail_entfernt",
                )
              }
            >
              Entfernen
            </button>
          </div>
        ) : !verifizierbar ? (
          <p className="faint">
            Die Bestätigung per Code wird gerade eingerichtet und ist bald
            verfügbar.
          </p>
        ) : (
          <>
            {vorschlag && (
              <div className="hs-vorschlag">
                <span>
                  Deine Anmelde-Adresse ist eine Uni-Mail der <b>{vorschlag}</b>{" "}
                  und schon bestätigt, ein Klick genügt.
                </span>
                <button
                  type="button"
                  className="knopf neben"
                  disabled={laeuft}
                  onClick={() =>
                    ausfuehren(
                      anmeldeMailUebernehmen,
                      setMailErgebnis,
                      "uni_mail_bestaetigt",
                    )
                  }
                >
                  Als Uni-Mail übernehmen
                </button>
              </div>
            )}
            {!mailMoeglich ? (
              !vorschlag && (
                <p className="faint">
                  Die Bestätigung per Code wird gerade eingerichtet und ist bald
                  verfügbar.
                </p>
              )
            ) : (
              <>
                <form
                  className="hs-mail"
                  onSubmit={(e) => {
                    e.preventDefault();
                    ausfuehren(
                      () => uniMailCodeSenden(mail),
                      setMailErgebnis,
                      "uni_mail_code_gesendet",
                      () => setCodeGesendet(true),
                    );
                  }}
                >
                  <input
                    className="field"
                    type="email"
                    autoComplete="email"
                    placeholder="name@stud.uni-xyz.de"
                    value={mail}
                    onChange={(e) => setMail(e.target.value)}
                    aria-label="Uni-Mail"
                  />
                  <button
                    type="submit"
                    className={codeGesendet ? "knopf neben" : "knopf haupt"}
                    disabled={laeuft || !mail.trim()}
                  >
                    {codeGesendet ? "Neuen Code senden" : "Code senden"}
                  </button>
                </form>
                {codeGesendet && (
                  <form
                    className="hs-mail"
                    onSubmit={(e) => {
                      e.preventDefault();
                      ausfuehren(
                        () => uniMailBestaetigen(code),
                        setMailErgebnis,
                        "uni_mail_bestaetigt",
                        () => setCode(""),
                      );
                    }}
                  >
                    <input
                      className="field hs-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={7}
                      placeholder="6-stelliger Code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      aria-label="Bestätigungscode"
                    />
                    <button
                      type="submit"
                      className="knopf haupt"
                      disabled={laeuft || code.replace(/\D/g, "").length !== 6}
                    >
                      Bestätigen
                    </button>
                  </form>
                )}
              </>
            )}
          </>
        )}
        <Meldung e={mailErgebnis} />
      </div>
    </div>
  );
}
