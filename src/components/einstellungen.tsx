"use client";

import { PfeilText } from "@/components/bewegung/pfeil-text";
import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  emailAendern,
  nutzernameAendern,
  passwortAendern,
  profilbildEntfernen,
  profilbildSpeichern,
  type Ergebnis,
} from "@/app/settings/actions";
import { AbmeldenButton } from "@/components/sidebar-aktionen";
import { AnalyticsEinstellung } from "@/components/analytics-einstellung";
import { KiEinstellung } from "@/components/ki/ki-einstellung";
import { PersoenlichkeitWahl } from "@/components/ki/persoenlichkeit-wahl";
import type { Lernprofil } from "@/lib/ki/lernraum";
import { KiVerlaufLoeschen } from "@/components/assistent/ki-verlauf-loeschen";
import { KiKontingentAnzeige } from "@/components/ki/ki-kontingent-anzeige";
import { ProfilAvatar } from "@/components/profil-avatar";
import { fehlerMelden, track } from "@/lib/analytics";

/** Bild im Browser quadratisch zuschneiden (Mitte) und auf 512 px verkleinern. */
async function profilbildVorbereiten(datei: File): Promise<string> {
  const bitmap = await createImageBitmap(datei);
  const seite = Math.min(bitmap.width, bitmap.height);
  const ziel = Math.min(512, seite);
  const canvas = document.createElement("canvas");
  canvas.width = ziel;
  canvas.height = ziel;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, ziel, ziel);
  ctx.drawImage(bitmap, (bitmap.width - seite) / 2, (bitmap.height - seite) / 2, seite, seite, 0, 0, ziel, ziel);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.88);
}

/** Abschnitt der Einstellungen: links Titel und Erklärung, rechts der Inhalt, getrennt durch Linien statt Karten. */
function Abschnitt({ titel, untertitel, children }: { titel: string; untertitel?: string; children: ReactNode }) {
  return (
    <section className="einst-abschnitt">
      <div className="einst-kopf">
        <h2>{titel}</h2>
        {untertitel && <p>{untertitel}</p>}
      </div>
      <div className="einst-inhalt">{children}</div>
    </section>
  );
}

function Meldung({ ergebnis }: { ergebnis: Ergebnis | null }) {
  if (!ergebnis) return null;
  if (!ergebnis.ok) return <p className="formular-fehler" role="alert">{ergebnis.fehler}</p>;
  return ergebnis.hinweis ? <p className="einst-ok">{ergebnis.hinweis}</p> : <p className="einst-ok">Gespeichert.</p>;
}

export function Einstellungen({
  name,
  email,
  neueEmail,
  avatarUrl,
  kiEingewilligt,
  audioEingewilligt,
  kiVerfuegbar,
  kiProfil,
  hochschule,
}: {
  name: string;
  email: string;
  /** E-Mail-Änderung wartet noch auf Bestätigung */
  neueEmail: string | null;
  avatarUrl: string | null;
  kiEingewilligt: boolean;
  audioEingewilligt: boolean;
  kiVerfuegbar: boolean;
  kiProfil: Lernprofil;
  /** Abschnitt „Hochschule“ (Suche + Uni-Mail), von der Seite vorbereitet */
  hochschule?: ReactNode;
}) {
  const router = useRouter();
  const [laeuft, startTransition] = useTransition();
  const bildEingabe = useRef<HTMLInputElement>(null);

  const [bildErgebnis, setBildErgebnis] = useState<Ergebnis | null>(null);
  const [nameWert, setNameWert] = useState(name);
  const [nameErgebnis, setNameErgebnis] = useState<Ergebnis | null>(null);
  const [emailWert, setEmailWert] = useState("");
  const [emailErgebnis, setEmailErgebnis] = useState<Ergebnis | null>(null);
  const [pw, setPw] = useState({ aktuell: "", neu: "", wiederholt: "" });
  const [pwErgebnis, setPwErgebnis] = useState<Ergebnis | null>(null);

  function ausfuehren(aktion: () => Promise<Ergebnis>, setzen: (e: Ergebnis) => void, ereignis: string, danach?: () => void) {
    startTransition(async () => {
      try {
        const e = await aktion();
        setzen(e);
        if (e.ok) {
          track(ereignis);
          danach?.();
          router.refresh();
        }
      } catch (err) {
        fehlerMelden(err, { ort: ereignis });
        setzen({ ok: false, fehler: "Das hat nicht geklappt. Bitte versuch es noch einmal." });
      }
    });
  }

  async function bildGewaehlt(datei: File) {
    setBildErgebnis(null);
    if (!datei.type.startsWith("image/")) {
      setBildErgebnis({ ok: false, fehler: "Bitte ein Bild auswählen." });
      return;
    }
    let dataUrl: string;
    try {
      dataUrl = await profilbildVorbereiten(datei);
    } catch {
      setBildErgebnis({ ok: false, fehler: "Das Bild konnte nicht gelesen werden. Versuch ein JPG oder PNG." });
      return;
    }
    ausfuehren(() => profilbildSpeichern(dataUrl), setBildErgebnis, "profilbild_geaendert");
  }

  function passwortSenden(e: FormEvent) {
    e.preventDefault();
    if (pw.neu !== pw.wiederholt) {
      setPwErgebnis({ ok: false, fehler: "Die beiden neuen Passwörter stimmen nicht überein." });
      return;
    }
    ausfuehren(() => passwortAendern(pw.aktuell, pw.neu), setPwErgebnis, "passwort_geaendert", () => setPw({ aktuell: "", neu: "", wiederholt: "" }));
  }

  return (
    <div className="einst-raster">
      <Abschnitt titel="Profil" untertitel="So sehen dich andere, z. B. beim Teilen von Deadlines und im Chat.">
        <div className="einst-profil">
          <ProfilAvatar name={nameWert || name} url={avatarUrl} groesse={84} />
          <div className="einst-profil-knoepfe">
            <input
              ref={bildEingabe}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const datei = e.target.files?.[0];
                e.target.value = "";
                if (datei) void bildGewaehlt(datei);
              }}
            />
            <button type="button" className="knopf neben klein" disabled={laeuft} onClick={() => bildEingabe.current?.click()}>
              {avatarUrl ? "Bild ändern" : "Bild hochladen"}
            </button>
            {avatarUrl && (
              <button type="button" className="knopf leise klein" disabled={laeuft} onClick={() => ausfuehren(profilbildEntfernen, setBildErgebnis, "profilbild_entfernt")}>
                Entfernen
              </button>
            )}
          </div>
        </div>
        <Meldung ergebnis={bildErgebnis} />

        <form
          className="einst-formular"
          onSubmit={(e) => {
            e.preventDefault();
            ausfuehren(() => nutzernameAendern(nameWert), setNameErgebnis, "nutzername_geaendert");
          }}
        >
          <label className="einst-feld">
            <span>Nutzername</span>
            <input
              value={nameWert}
              maxLength={20}
              autoComplete="username"
              onChange={(e) => {
                setNameWert(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                setNameErgebnis(null);
              }}
            />
            <small>3 bis 20 Zeichen: a bis z, Ziffern und Unterstrich</small>
          </label>
          <button type="submit" className="knopf neben" disabled={laeuft || nameWert === name || nameWert.length < 3}>
            Speichern
          </button>
        </form>
        <Meldung ergebnis={nameErgebnis} />
      </Abschnitt>

      {hochschule && (
        <Abschnitt titel="Hochschule" untertitel="Wo du studierst. Hilft der KI und schaltet Uni-Funktionen frei.">
          {hochschule}
        </Abschnitt>
      )}

      <Abschnitt titel="Konto" untertitel="E-Mail-Adresse und Passwort für die Anmeldung.">
        <form
          className="einst-formular"
          onSubmit={(e) => {
            e.preventDefault();
            ausfuehren(() => emailAendern(emailWert), setEmailErgebnis, "email_aenderung_angefragt", () => setEmailWert(""));
          }}
        >
          <label className="einst-feld">
            <span>E-Mail</span>
            <small>Aktuell: {email}</small>
            {neueEmail && <span className="einst-wartet">Wartet auf Bestätigung: {neueEmail}</span>}
            <input
              type="email"
              placeholder="Neue E-Mail-Adresse"
              value={emailWert}
              autoComplete="email"
              onChange={(e) => {
                setEmailWert(e.target.value);
                setEmailErgebnis(null);
              }}
            />
          </label>
          <button type="submit" className="knopf neben" disabled={laeuft || !emailWert.trim()}>
            Ändern
          </button>
        </form>
        <Meldung ergebnis={emailErgebnis} />

        <form className="einst-formular einst-passwort" onSubmit={passwortSenden}>
          <label className="einst-feld">
            <span>Aktuelles Passwort</span>
            <input
              type="password"
              autoComplete="current-password"
              value={pw.aktuell}
              onChange={(e) => setPw((p) => ({ ...p, aktuell: e.target.value }))}
            />
          </label>
          <label className="einst-feld">
            <span>Neues Passwort</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={pw.neu}
              onChange={(e) => setPw((p) => ({ ...p, neu: e.target.value }))}
            />
          </label>
          <label className="einst-feld">
            <span>Neues Passwort wiederholen</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={pw.wiederholt}
              onChange={(e) => setPw((p) => ({ ...p, wiederholt: e.target.value }))}
            />
          </label>
          <button type="submit" className="knopf neben" disabled={laeuft || !pw.aktuell || pw.neu.length < 6}>
            Passwort ändern
          </button>
        </form>
        <Meldung ergebnis={pwErgebnis} />
      </Abschnitt>

      <Abschnitt titel="Datenschutz und KI" untertitel="Was UniVerse nutzen darf. Du kannst alles jederzeit ändern.">
        <div className="einst-schalter">
          <AnalyticsEinstellung />
          <KiEinstellung startEingewilligt={kiEingewilligt} />
          <KiEinstellung art="audio" startEingewilligt={audioEingewilligt} />
          {kiEingewilligt && <KiKontingentAnzeige />}
          {kiVerfuegbar && <PersoenlichkeitWahl startProfil={kiProfil} />}
          {kiVerfuegbar && (
            <div className="einst-zeile">
              <span>
                Was Studio über dich weiß
                <small>Gedächtnis und Wissensstand ansehen, ändern oder löschen.</small>
              </span>
              <Link href="/einstellungen/gedaechtnis" className="knopf neben klein">
                <PfeilText>Ansehen</PfeilText>
              </Link>
            </div>
          )}
          {/* auch nach einem Widerruf: Löschen muss immer möglich sein */}
          {kiVerfuegbar && <KiVerlaufLoeschen />}
        </div>
      </Abschnitt>

      <Abschnitt titel="Abmelden" untertitel="Auf diesem Gerät abmelden. Deine Daten bleiben gespeichert.">
        <AbmeldenButton />
      </Abschnitt>
    </div>
  );
}
