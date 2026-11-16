// UniVerse Studio: Werkzeuge, mit denen die KI selbst HANDELT – öffnen, anlegen, abhaken,
// verschieben, in die Notiz schreiben, recherchieren, Lernmaterial erstellen.
// Anlegen/Ändern wird sofort ausgeführt und ist im Chat rückgängig zu machen.
// Mehr als MAX_DIREKT Einträge in einer Antwort werden zu Vorschlägen (Bestätigung nötig).
import "server-only";
import type { Werkzeug } from "@/lib/ki/agent";
import type { Supabase } from "@/lib/ki/server";
import { kiAnfrage, kiWebsuche } from "@/lib/ki/anbieter";
import { karteAusfuehren } from "@/lib/ki/aktionskarten-server";
import { DEADLINE_TYPEN, PRIORITAETEN, datumAufloesen, datumText, fachFinden, karteBauen, type Aktionskarte, type FachRef, type KarteInhalt, type StapelRef } from "@/lib/ki/assistent";
import { KiEingabe } from "@/lib/ki/fehler";
import { kartenLesen, kontextBauen, MAX_KONTEXT_GANZ, quizLesen, STUDIO, studioPrompt, istStudioArt, type Lernprofil, type LernQuelle } from "@/lib/ki/lernraum";
import { quellenListe, quellenTexte } from "@/lib/ki/lernraum-server";
import { bereichPfad, type Aktion, type Block, type Erledigt } from "@/lib/ki/studio";
import { createPruefung } from "@/app/pruefung/actions";

/** Höchstens so viele Einträge legt die KI pro Antwort direkt an – darüber nur als Vorschlag */
export const MAX_DIREKT = 5;

export type Sammlung = { erledigt: Erledigt[]; bloecke: Block[]; aktionen: Aktion[]; karten: Aktionskarte[] };

type Umfeld = {
  supabase: Supabase;
  faecher: FachRef[];
  stapel: StapelRef[];
  jetzt: Date;
  /** offene Notiz (Haupt- oder zweite Ansicht) – für "in die Notiz einfügen" */
  offeneNotiz: string | null;
  /** Fach des Kontexts (Lernraum, Fach der offenen Notiz/PDF) */
  fachId: string | null;
  /** Quellen des aktuellen Kontexts (für Lernmaterial ohne Fachangabe) */
  quellen: LernQuelle[];
  profil: Lernprofil;
};

const FACH = { fach: { type: "string", description: "Fach: Name oder ID (optional)" } };
const t = (w: unknown, max = 300) => (typeof w === "string" ? w.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Sucht einen Eintrag per ID oder (Teil-)Titel in einer Tabelle */
async function finden(supabase: Supabase, tabelle: "datei" | "notiz" | "kk_stapel" | "todo" | "deadline", spalte: string, eingabe: string, extra?: (q: never) => never) {
  const e = eingabe.trim();
  if (!e) return null;
  const UUID = /^[0-9a-f-]{36}$/i;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generische Suche über mehrere Tabellen
  let q: any = supabase.from(tabelle).select(`id, ${spalte}`);
  if (extra) q = extra(q as never);
  if (UUID.test(e)) {
    const { data } = await q.eq("id", e).maybeSingle();
    if (data) return data as Record<string, string>;
  }
  const { data: genau } = await q.ilike(spalte, e).limit(1);
  if (genau?.[0]) return genau[0] as Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q2: any = supabase.from(tabelle).select(`id, ${spalte}`);
  if (extra) q2 = extra(q2 as never);
  const { data: teil } = await q2.ilike(spalte, `%${e.replace(/[%_]/g, "")}%`).limit(1);
  return (teil?.[0] as Record<string, string> | undefined) ?? null;
}

export function handlungswerkzeuge(u: Umfeld, s: Sammlung): Werkzeug[] {
  const angelegt = () => s.erledigt.filter((e) => ["deadline", "todo", "notiz", "pruefung", "stapel"].includes(e.art)).length;

  /** Anlegen: direkt ausführen – oder (zu viele) als Vorschlag */
  async function anlegen(typ: KarteInhalt["typ"], args: Record<string, unknown>, art: Erledigt["art"]) {
    const inhalt = karteBauen(typ, args, u);
    if (angelegt() >= MAX_DIREKT) {
      const karte = { id: crypto.randomUUID(), status: "offen", ...inhalt } as Aktionskarte;
      s.karten.push(karte);
      return { vorschlag: true, hinweis: "Zu viele Einträge auf einmal – der Nutzer bestätigt diesen per Karte." };
    }
    const { ergebnisId, link } = await karteAusfuehren(u.supabase, { id: crypto.randomUUID(), status: "offen", ...inhalt } as Aktionskarte);
    const text =
      inhalt.typ === "deadline"
        ? `Deadline „${inhalt.titel}“ – ${datumText(inhalt.faellig_am)}`
        : inhalt.typ === "todo"
          ? `To-do „${inhalt.titel}“`
          : inhalt.typ === "notiz"
            ? `Notiz „${inhalt.titel}“`
            : inhalt.typ === "karteikarten"
              ? `${inhalt.karten.length} Karteikarten in „${inhalt.stapel_name}“`
              : "Erledigt";
    // Karteikarten in einen bestehenden Stapel lassen sich nicht einzeln zurücknehmen
    const rueckbar = !(inhalt.typ === "karteikarten" && inhalt.stapel_id);
    s.erledigt.push({ id: crypto.randomUUID(), art, text, link, status: "ok", ziel: rueckbar ? ergebnisId : null });
    return { erledigt: true, was: text, link };
  }

  return [
    {
      name: "oeffnen",
      beschreibung:
        "Öffnet etwas in der App: eine PDF (optional auf einer Seite), eine Notiz, einen Karteikarten-Stapel (zum Lernen), den Lernraum eines Fachs oder einen Bereich (Dashboard, Termine, Aufgaben, Noten, Notizen, Dateiablage …). Mit daneben=true in der geteilten Ansicht neben dem aktuellen Inhalt.",
      parameter: {
        type: "object",
        properties: {
          art: { type: "string", enum: ["pdf", "notiz", "stapel", "lernraum", "bereich"] },
          name: { type: "string", description: "Name/Titel oder ID; bei 'lernraum' das Fach, bei 'bereich' z. B. 'Noten'" },
          seite: { type: "integer", description: "nur PDF: Seite" },
          lernen: { type: "boolean", description: "nur Stapel: direkt den Lernmodus öffnen" },
          daneben: { type: "boolean" },
        },
        required: ["art", "name"],
      },
      statusText: "Öffne …",
      ausfuehren: async (a) => {
        const name = t(a.name, 200);
        const daneben = a.daneben === true;
        let href: string | null = null;
        let titel = name;
        if (a.art === "pdf") {
          const d = await finden(u.supabase, "datei", "name", name, ((q: { eq: (k: string, v: string) => unknown }) => q.eq("mime_typ", "application/pdf")) as never);
          if (!d) throw new KiEingabe(`Keine PDF „${name}“ gefunden.`);
          const seite = Number(a.seite);
          href = `/pdf-reader/${d.id}${Number.isInteger(seite) && seite > 0 ? `?seite=${seite}` : ""}`;
          titel = d.name;
        } else if (a.art === "notiz") {
          const n = await finden(u.supabase, "notiz", "titel", name);
          if (!n) throw new KiEingabe(`Keine Notiz „${name}“ gefunden.`);
          href = `/notizen?id=${n.id}`;
          titel = n.titel;
        } else if (a.art === "stapel") {
          const st = await finden(u.supabase, "kk_stapel", "name", name);
          if (!st) throw new KiEingabe(`Kein Stapel „${name}“ gefunden.`);
          href = `/karteikarten/${st.id}${a.lernen ? "/lernen" : ""}`;
          titel = st.name;
        } else if (a.art === "lernraum") {
          const f = fachFinden(u.faecher, name);
          if (!f) throw new KiEingabe(`Fach „${name}“ nicht gefunden.`);
          href = `/lernraum/${f.id}`;
          titel = `Lernraum ${f.name}`;
        } else {
          href = bereichPfad(name);
          if (!href) throw new KiEingabe(`Bereich „${name}“ gibt es nicht.`);
        }
        s.aktionen.push({ art: "oeffnen", href, daneben, titel });
        return { geoeffnet: titel, daneben };
      },
    },
    {
      name: "deadline_anlegen",
      beschreibung: "Legt eine Deadline an (Abgabe, Frist, Termin) – sofort, der Nutzer kann es rückgängig machen.",
      parameter: {
        type: "object",
        properties: {
          titel: { type: "string" },
          faellig_am: { type: "string", description: "Wie vom Nutzer gesagt, z. B. 'Freitag', 'morgen 14 Uhr', '24.12.' oder YYYY-MM-DD" },
          typ: { type: "string", enum: [...DEADLINE_TYPEN] },
          ...FACH,
        },
        required: ["titel", "faellig_am"],
      },
      statusText: "Lege die Deadline an …",
      ausfuehren: (a) => anlegen("deadline", { ...a, fach: a.fach ?? u.fachId ?? undefined }, "deadline"),
    },
    {
      name: "todo_anlegen",
      beschreibung: "Legt ein To-do an – sofort, rückgängig möglich.",
      parameter: { type: "object", properties: { titel: { type: "string" }, prioritaet: { type: "string", enum: [...PRIORITAETEN] }, ...FACH }, required: ["titel"] },
      statusText: "Lege das To-do an …",
      ausfuehren: (a) => anlegen("todo", a, "todo"),
    },
    {
      name: "notiz_anlegen",
      beschreibung: "Legt eine neue Notiz an (Titel und Inhalt in Markdown; Verlinkungen mit [[Name]] bzw. [[Skript.pdf#S12]]).",
      parameter: { type: "object", properties: { titel: { type: "string" }, inhalt: { type: "string" }, ...FACH }, required: ["titel", "inhalt"] },
      statusText: "Schreibe die Notiz …",
      ausfuehren: (a) => anlegen("notiz", { ...a, fach: a.fach ?? u.fachId ?? undefined }, "notiz"),
    },
    {
      name: "karteikarten_anlegen",
      beschreibung: "Legt Karteikarten an (höchstens 20) – in einem vorhandenen Stapel oder einem neuen.",
      parameter: {
        type: "object",
        properties: {
          karten: { type: "array", items: { type: "object", properties: { vorderseite: { type: "string" }, rueckseite: { type: "string" } }, required: ["vorderseite", "rueckseite"] } },
          stapel: { type: "string", description: "Vorhandener Stapel (Name oder ID) oder Name für einen neuen Stapel" },
          ...FACH,
        },
        required: ["karten"],
      },
      statusText: "Lege die Karteikarten an …",
      ausfuehren: (a) => anlegen("karteikarten", { ...a, fach: a.fach ?? u.fachId ?? undefined }, "stapel"),
    },
    {
      name: "pruefung_anlegen",
      beschreibung: "Trägt eine Prüfung ein (Fach ist Pflicht).",
      parameter: {
        type: "object",
        properties: {
          titel: { type: "string" },
          datum: { type: "string", description: "z. B. '12.2. 10 Uhr', 'nächsten Montag'" },
          raum: { type: "string" },
          dauer_minuten: { type: "integer" },
          ...FACH,
        },
        required: ["titel", "datum", "fach"],
      },
      statusText: "Trage die Prüfung ein …",
      ausfuehren: async (a) => {
        const fach = fachFinden(u.faecher, a.fach ?? u.fachId);
        if (!fach) throw new KiEingabe(`Für die Prüfung brauche ich ein Fach. Vorhanden: ${u.faecher.map((f) => f.name).join(", ") || "keine"}.`);
        const datum = datumAufloesen(t(a.datum, 80), u.jetzt, [9, 0]);
        if (!datum) throw new KiEingabe("Das Datum der Prüfung habe ich nicht verstanden.");
        if (angelegt() >= MAX_DIREKT) throw new KiEingabe("Zu viele Einträge auf einmal – bitte einzeln anlegen.");
        const titel = t(a.titel, 200) || `Prüfung ${fach.name}`;
        const neu = await createPruefung({
          titel,
          fach_id: fach.id,
          datum: datum.iso,
          raum: t(a.raum, 100) || null,
          status: "ANSTEHEND",
          dauer_minuten: Number.isInteger(a.dauer_minuten) ? Number(a.dauer_minuten) : null,
        });
        const text = `Prüfung „${titel}“ – ${datumText(datum.iso, datum.mitUhrzeit)}`;
        s.erledigt.push({ id: crypto.randomUUID(), art: "pruefung", text, link: `/?detail=pruefung:${neu.id}`, status: "ok", ziel: neu.id });
        return { erledigt: true, was: text };
      },
    },
    {
      name: "todo_abhaken",
      beschreibung: "Hakt ein offenes To-do als erledigt ab (per Titel oder ID).",
      parameter: { type: "object", properties: { todo: { type: "string" } }, required: ["todo"] },
      statusText: "Hake das To-do ab …",
      ausfuehren: async (a) => {
        const todo = await finden(u.supabase, "todo", "titel", t(a.todo), ((q: { eq: (k: string, v: boolean) => unknown }) => q.eq("erledigt", false)) as never);
        if (!todo) throw new KiEingabe(`Kein offenes To-do „${t(a.todo, 80)}“ gefunden.`);
        const { error } = await u.supabase.from("todo").update({ erledigt: true }).eq("id", todo.id);
        if (error) throw new Error(error.message);
        s.erledigt.push({ id: crypto.randomUUID(), art: "todo_erledigt", text: `To-do „${todo.titel}“ abgehakt`, link: "/aufgaben", status: "ok", ziel: todo.id });
        return { erledigt: true, was: `„${todo.titel}“ abgehakt` };
      },
    },
    {
      name: "deadline_verschieben",
      beschreibung: "Verschiebt eine Deadline auf ein neues Datum (per Titel oder ID).",
      parameter: { type: "object", properties: { deadline: { type: "string" }, neues_datum: { type: "string" } }, required: ["deadline", "neues_datum"] },
      statusText: "Verschiebe die Deadline …",
      ausfuehren: async (a) => {
        const d = await finden(u.supabase, "deadline", "titel", t(a.deadline));
        if (!d) throw new KiEingabe(`Keine Deadline „${t(a.deadline, 80)}“ gefunden.`);
        const { data: alt } = await u.supabase.from("deadline").select("faellig_am").eq("id", d.id).single();
        const datum = datumAufloesen(t(a.neues_datum, 80), u.jetzt);
        if (!datum) throw new KiEingabe("Das neue Datum habe ich nicht verstanden.");
        const { error } = await u.supabase.from("deadline").update({ faellig_am: datum.iso }).eq("id", d.id);
        if (error) throw new Error(error.message);
        const text = `Deadline „${d.titel}“ verschoben auf ${datumText(datum.iso, datum.mitUhrzeit)}`;
        s.erledigt.push({ id: crypto.randomUUID(), art: "deadline_verschoben", text, link: `/?detail=deadline:${d.id}`, status: "ok", ziel: d.id, vorher: alt?.faellig_am ?? null });
        return { erledigt: true, was: text };
      },
    },
    {
      name: "in_notiz_einfuegen",
      beschreibung: "Fügt Markdown-Text in die gerade offene Notiz ein (oder in eine genannte Notiz, ans Ende).",
      parameter: { type: "object", properties: { text: { type: "string" }, notiz: { type: "string", description: "nur nötig, wenn nicht die offene Notiz gemeint ist" } }, required: ["text"] },
      statusText: "Schreibe in die Notiz …",
      ausfuehren: async (a) => {
        const text = typeof a.text === "string" ? a.text.slice(0, 20_000) : "";
        if (!text.trim()) throw new KiEingabe("Kein Text zum Einfügen.");
        let notizId = u.offeneNotiz;
        let titel = "die offene Notiz";
        if (a.notiz) {
          const n = await finden(u.supabase, "notiz", "titel", t(a.notiz));
          if (!n) throw new KiEingabe(`Keine Notiz „${t(a.notiz, 80)}“ gefunden.`);
          notizId = n.id;
          titel = `„${n.titel}“`;
        }
        if (!notizId) throw new KiEingabe("Gerade ist keine Notiz offen – sag mir, in welche Notiz der Text soll, oder lege eine neue an.");
        // Ist die Notiz offen, fügt der Editor im Browser ein (sonst hängt der Browser es per Server an)
        s.aktionen.push({ art: "notiz_einfuegen", notizId, text });
        s.erledigt.push({ id: crypto.randomUUID(), art: "notiz_ergaenzt", text: `Text in ${titel} eingefügt`, link: `/notizen?id=${notizId}`, status: "ok", ziel: null });
        return { erledigt: true, was: `in ${titel} eingefügt` };
      },
    },
    {
      name: "web_recherchieren",
      beschreibung: "Recherchiert im Web (aktuelle Infos, Fakten außerhalb des Materials). Liefert eine Zusammenfassung mit Quellen-Links.",
      parameter: { type: "object", properties: { frage: { type: "string" } }, required: ["frage"] },
      statusText: "Recherchiere im Web …",
      ausfuehren: async (a) => {
        const frage = t(a.frage, 1000);
        if (!frage) throw new KiEingabe("Was soll ich recherchieren?");
        const w = await kiWebsuche({
          system: "Recherchiere im Web und fasse die Ergebnisse sachlich auf Deutsch zusammen (Stichpunkte). Nenne nur, was die Quellen hergeben.",
          nutzer: frage,
          temperatur: 0.2,
          maxTokens: 1200,
          timeoutMs: 60_000,
        });
        if (w.quellen.length) s.bloecke.push({ id: crypto.randomUUID(), typ: "web", quellen: w.quellen.slice(0, 8) });
        return { ergebnis: w.text.slice(0, 8000), quellen: w.quellen.slice(0, 8) };
      },
    },
    {
      name: "studio_erstellen",
      beschreibung:
        "Erstellt Lernmaterial aus den Quellen (offene PDF/Notiz, sonst das Fach): lernzettel, faq, briefing, zeitleiste, quiz (interaktiv) oder karteikarten (zum Speichern). Das Ergebnis erscheint direkt im Chat.",
      parameter: { type: "object", properties: { art: { type: "string", enum: Object.keys(STUDIO) }, ...FACH }, required: ["art"] },
      statusText: "Erstelle Lernmaterial …",
      ausfuehren: async (a) => {
        if (!istStudioArt(a.art)) throw new KiEingabe("Unbekannte Art.");
        const art = a.art;
        // Quellen: genanntes Fach > aktueller Kontext > Fach des Kontexts
        let fachId = a.fach ? (fachFinden(u.faecher, a.fach)?.id ?? null) : null;
        let quellen = fachId ? [] : u.quellen;
        if (!quellen.length) fachId ??= u.fachId;
        if (!quellen.length && fachId) {
          const { data: raum } = await u.supabase.from("lernraum").select("id").eq("fach_id", fachId).maybeSingle();
          const raumId = raum?.id ?? (await u.supabase.from("lernraum").insert({ fach_id: fachId }).select("id").single()).data?.id;
          if (raumId) quellen = await quellenTexte(u.supabase, await quellenListe(u.supabase, raumId, fachId));
        }
        if (!quellen.some((q) => q.abschnitte.length)) throw new KiEingabe("Dafür brauche ich Material: Öffne eine PDF oder Notiz oder nenn das Fach.");
        const fachName = u.faecher.find((f) => f.id === fachId)?.name ?? quellen[0]?.titel ?? "Lernstoff";
        const kontext = kontextBauen(quellen, fachName, MAX_KONTEXT_GANZ);
        const p = studioPrompt(art, fachName, quellen, kontext.text, u.profil);
        const antwort = await kiAnfrage(
          { system: p.system, nutzer: p.nutzer, json: STUDIO[art].json, temperatur: 0.3, maxTokens: 4000, timeoutMs: 110_000 },
          "stark",
        );
        const titel = `${STUDIO[art].name} – ${fachName}`;
        if (art === "quiz") {
          const fragen = quizLesen(antwort.text);
          if (!fragen.length) throw new KiEingabe("Das Quiz ist nicht gelungen – bitte noch einmal.");
          s.bloecke.push({ id: crypto.randomUUID(), typ: "quiz", titel, fragen });
          return { erstellt: titel, anzahl: fragen.length, hinweis: "Der Nutzer sieht das Quiz im Chat." };
        }
        if (art === "karteikarten") {
          const karten = kartenLesen(antwort.text);
          if (!karten.length) throw new KiEingabe("Die Karteikarten sind nicht gelungen – bitte noch einmal.");
          s.bloecke.push({ id: crypto.randomUUID(), typ: "karten", titel, karten, fachId });
          return { erstellt: titel, anzahl: karten.length, hinweis: "Der Nutzer sieht die Karten im Chat und kann sie als Stapel speichern." };
        }
        if (!antwort.text.trim()) throw new KiEingabe("Es kam keine Antwort – bitte noch einmal.");
        s.bloecke.push({ id: crypto.randomUUID(), typ: "markdown", titel, markdown: antwort.text.trim() });
        return { erstellt: titel, hinweis: "Der Nutzer sieht das Ergebnis im Chat. Wiederhole den Inhalt nicht." };
      },
    },
    {
      name: "quelle_lesen",
      beschreibung: "Liest Text aus einer PDF (eingelesene Seiten, optional Seitenbereich) oder einer Notiz, die nicht schon im Material steht.",
      parameter: {
        type: "object",
        properties: { name: { type: "string", description: "PDF-Dateiname oder Notiztitel" }, von: { type: "integer" }, bis: { type: "integer" } },
        required: ["name"],
      },
      statusText: "Lese in deinen Unterlagen …",
      ausfuehren: async (a) => {
        const name = t(a.name, 200);
        const pdf = await finden(u.supabase, "datei", "name", name, ((q: { eq: (k: string, v: string) => unknown }) => q.eq("mime_typ", "application/pdf")) as never);
        if (pdf) {
          const von = Number.isInteger(a.von) ? Number(a.von) : 1;
          const bis = Number.isInteger(a.bis) ? Number(a.bis) : von + 30;
          const { data } = await u.supabase.from("quelle_seite").select("seite, text").eq("datei_id", pdf.id).gte("seite", von).lte("seite", bis).order("seite");
          if (!data?.length) return { hinweis: `Die PDF „${pdf.name}“ ist noch nicht eingelesen. Bitte sie einmal im PDF Reader öffnen.` };
          return { pdf: pdf.name, seiten: data.map((x) => `[S. ${x.seite}] ${x.text}`).join("\n").slice(0, 40_000) };
        }
        const n = await finden(u.supabase, "notiz", "titel", name);
        if (n) {
          const { data } = await u.supabase.from("notiz").select("inhalt").eq("id", n.id).single();
          return { notiz: n.titel, inhalt: (data?.inhalt ?? "").slice(0, 40_000) };
        }
        throw new KiEingabe(`Keine PDF oder Notiz „${name}“ gefunden.`);
      },
    },
  ];
}
