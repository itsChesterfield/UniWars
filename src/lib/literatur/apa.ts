// LIT-03 / LIT-04: Zitieren nach APA (7. Auflage, vereinfacht).

export type QuellenTyp = "BUCH" | "ARTIKEL" | "WEBSEITE";

export type QuelleDaten = {
  typ: QuellenTyp;
  autoren: string;
  titel: string;
  jahr: number;
  verlag?: string | null;
  url?: string | null;
  abgerufen_am?: string | null;
  seiten?: string | null;
};

export type Autor = { nachname: string; vornamen: string };

/** "Müller, Anna; Schmidt, Ben" -> [{Müller, Anna}, {Schmidt, Ben}] */
export function autorenLesen(eingabe: string): Autor[] {
  return eingabe
    .split(";")
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => {
      const [nachname, ...rest] = a.split(",");
      if (rest.length === 0) {
        // "Anna Müller" -> Nachname ist das letzte Wort
        const teile = a.split(/\s+/);
        if (teile.length > 1) return { nachname: teile[teile.length - 1], vornamen: teile.slice(0, -1).join(" ") };
        return { nachname: a, vornamen: "" };
      }
      return { nachname: nachname.trim(), vornamen: rest.join(",").trim() };
    });
}

function initialen(vornamen: string): string {
  return vornamen
    .split(/[\s]+/)
    .filter(Boolean)
    .map((v) =>
      v
        .split("-")
        .map((t) => `${t.charAt(0).toUpperCase()}.`)
        .join("-"),
    )
    .join(" ");
}

function autorVerzeichnis(a: Autor): string {
  const i = initialen(a.vornamen);
  return i ? `${a.nachname}, ${i}` : a.nachname;
}

/** Im Text: (Müller, 2023) · (Müller & Schmidt, 2023) · (Müller et al., 2023) */
export function zitatImText(q: Pick<QuelleDaten, "autoren" | "jahr" | "seiten">, mitSeite = false): string {
  const a = autorenLesen(q.autoren);
  let namen: string;
  if (a.length === 0) namen = "o. A.";
  else if (a.length === 1) namen = a[0].nachname;
  else if (a.length === 2) namen = `${a[0].nachname} & ${a[1].nachname}`;
  else namen = `${a[0].nachname} et al.`;
  const seite = mitSeite && q.seiten ? `, S. ${q.seiten}` : "";
  return `(${namen}, ${q.jahr}${seite})`;
}

function autorenVerzeichnis(a: Autor[]): string {
  if (a.length === 0) return "";
  const formatiert = a.map(autorVerzeichnis);
  if (formatiert.length === 1) return formatiert[0];
  if (formatiert.length <= 20) return `${formatiert.slice(0, -1).join(", ")}, & ${formatiert[formatiert.length - 1]}`;
  return `${formatiert.slice(0, 19).join(", ")}, … ${formatiert[formatiert.length - 1]}`;
}

function punkt(text: string): string {
  return /[.?!]$/.test(text) ? text : `${text}.`;
}

function datumLang(iso: string): string {
  const [j, m, t] = iso.split("-").map(Number);
  return new Date(Date.UTC(j, m - 1, t)).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Literaturverzeichnis-Eintrag (Klartext, Titel ohne Kursivschrift). */
export function verzeichnisEintrag(q: QuelleDaten): string {
  const autoren = autorenVerzeichnis(autorenLesen(q.autoren));
  const kopf = autoren ? `${punkt(autoren)} (${q.jahr}).` : `${q.titel} (${q.jahr}).`;
  const titel = autoren ? ` ${punkt(q.titel.trim())}` : "";
  const verlag = q.verlag?.trim();
  const seiten = q.seiten?.trim();

  if (q.typ === "ARTIKEL") {
    const zeitschrift = verlag ? ` ${verlag}${seiten ? `, ${seiten}` : ""}.` : seiten ? ` S. ${seiten}.` : "";
    const url = q.url ? ` ${q.url}` : "";
    return `${kopf}${titel}${zeitschrift}${url}`;
  }
  if (q.typ === "WEBSEITE") {
    const seite = verlag ? ` ${punkt(verlag)}` : "";
    const abruf = q.abgerufen_am ? ` Abgerufen am ${datumLang(q.abgerufen_am)}, von ${q.url ?? ""}` : q.url ? ` ${q.url}` : "";
    return `${kopf}${titel}${seite}${abruf}`;
  }
  const verlagTeil = verlag ? ` ${punkt(verlag)}` : "";
  return `${kopf}${titel}${verlagTeil}`;
}

function sortierSchluessel(q: QuelleDaten): string {
  const a = autorenLesen(q.autoren);
  return `${a.map((x) => `${x.nachname} ${x.vornamen}`).join(" ") || q.titel} ${q.jahr}`.toLocaleLowerCase("de-DE");
}

/** LIT-04: alphabetisch sortiertes Verzeichnis. */
export function literaturverzeichnis(quellen: QuelleDaten[]): string[] {
  return [...quellen].sort((x, y) => sortierSchluessel(x).localeCompare(sortierSchluessel(y), "de")).map(verzeichnisEintrag);
}

/** Erster Autor für Tabellen: "Müller, A." */
export function erstautorKurz(autoren: string): string {
  const a = autorenLesen(autoren);
  if (a.length === 0) return "–";
  const erster = autorVerzeichnis(a[0]);
  return a.length > 1 ? `${erster} u. a.` : erster;
}
