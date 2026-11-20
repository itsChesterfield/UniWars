import Link from "next/link";
import { signup } from "./actions";
import { TrackEvent } from "@/components/track-event";
import { AnmeldeMeldung, AnmeldeRahmen } from "@/components/anmeldung/anmelde-rahmen";
import { AnmeldeKnopf } from "@/components/anmeldung/anmelde-knopf";
import { Icon } from "@/components/nav-icon";

type Feld = "nutzername" | "email" | "passwort";

function FeldFehler({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="anm-feld-fehler">
      <Icon name="warnung" groesse={14} />
      <span>{children}</span>
    </p>
  );
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; error?: string; feld?: string; nutzername?: string; email?: string }>;
}) {
  const p = await searchParams;
  const fehler = p.fehler ?? p.error;
  const feld = (["nutzername", "email", "passwort"].includes(p.feld ?? "") ? p.feld : null) as Feld | null;
  const an = (f: Feld) => (fehler && feld === f ? { "aria-invalid": true as const, "aria-describedby": `fehler-${f}` } : {});

  return (
    <AnmeldeRahmen>
      <div className="anm-form">
        <h1>Konto erstellen</h1>

        {fehler && !feld && <AnmeldeMeldung art="fehler">{fehler}</AnmeldeMeldung>}
        {fehler && <TrackEvent event="registrierung_fehlgeschlagen" properties={{ grund: fehler }} />}

        <form action={signup} className="anm-felder">
          <div className="anm-feld">
            <label htmlFor="username">Nutzername</label>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="nickname"
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_]{3,20}"
              defaultValue={p.nutzername}
              {...an("nutzername")}
            />
            {feld === "nutzername" && fehler ? (
              <FeldFehler id="fehler-nutzername">{fehler}</FeldFehler>
            ) : (
              <p className="anm-feld-hilfe">3 bis 20 Zeichen: a bis z, Ziffern und Unterstrich. Großbuchstaben werden klein geschrieben.</p>
            )}
          </div>

          <div className="anm-feld">
            <label htmlFor="email">E-Mail</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="name@hochschule.de"
              required
              autoComplete="email"
              defaultValue={p.email}
              {...an("email")}
            />
            {feld === "email" && fehler && (
              <FeldFehler id="fehler-email">{fehler}</FeldFehler>
            )}
          </div>

          <div className="anm-feld">
            <label htmlFor="password">Passwort</label>
            <input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" {...an("passwort")} />
            {feld === "passwort" && fehler ? (
              <FeldFehler id="fehler-passwort">{fehler}</FeldFehler>
            ) : (
              <p className="anm-feld-hilfe">Mindestens 6 Zeichen</p>
            )}
          </div>

          <AnmeldeKnopf laedtText="Konto wird erstellt">
            Konto erstellen
          </AnmeldeKnopf>
        </form>

        <p className="anm-wechsel">
          Schon registriert? <Link className="link" href="/login">Anmelden</Link>
        </p>
      </div>
    </AnmeldeRahmen>
  );
}
