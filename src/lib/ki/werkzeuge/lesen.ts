// KI-12 (8.3): Werkzeuge zum LESEN der eigenen Daten. Laufen immer mit dem Supabase-Client
// des Nutzers (RLS, KI-ALL-05) und geben kompakte Daten zurück (keine ganzen Notizen in Listen).
import "server-only";
import type { Werkzeug } from "@/lib/ki/agent";
import type { Supabase } from "@/lib/ki/server";
import { KiEingabe } from "@/lib/ki/fehler";
import { datumText, stundenplanTermine, zeitraum } from "@/lib/ki/assistent";
import { anzahlFaellig, reife, REIFE_TEXT } from "@/lib/karteikarten/wiederholung";

const ZEITRAUM_PARAMETER = {
  von: { type: "string", description: "Beginn, z. B. 'heute', 'Montag' oder ISO-Datum YYYY-MM-DD (Standard: heute)" },
  bis: { type: "string", description: "Ende einschließlich, z. B. 'Sonntag', 'in 2 Wochen' oder YYYY-MM-DD (Standard: heute + 7 Tage)" },
};
const FACH_PARAMETER = { fach_id: { type: "string", description: "Optional: nur dieses Fach (ID aus faecher_auflisten)" } };

const kurz = (t: string, max: number) => (t.length > max ? `${t.slice(0, max)} …` : t);
const fachFilter = (args: Record<string, unknown>) => (typeof args.fach_id === "string" && args.fach_id ? args.fach_id : null);

export function lesewerkzeuge(supabase: Supabase, jetzt: Date): Werkzeug[] {
  const fachNamen = async () => {
    const { data } = await supabase.from("fach").select("id, name");
    return new Map((data ?? []).map((f) => [f.id, f.name]));
  };

  return [
    {
      name: "faecher_auflisten",
      beschreibung: "Listet die Fächer des Nutzers mit ID und Name (aktive Fächer).",
      parameter: { type: "object", properties: {} },
      statusText: "Schaue in deine Fächer …",
      ausfuehren: async () => {
        const { data } = await supabase.from("fach").select("id, name, semester, ects").eq("aktiv", true).order("name");
        return { faecher: data ?? [] };
      },
    },
    {
      name: "stundenplan_lesen",
      beschreibung: "Termine aus dem wöchentlichen Stundenplan im Zeitraum (Vorlesungen, Übungen).",
      parameter: { type: "object", properties: { ...ZEITRAUM_PARAMETER } },
      statusText: "Schaue in deinen Stundenplan …",
      ausfuehren: async (args) => {
        const { von, bis } = zeitraum(args.von, args.bis, jetzt);
        const [{ data }, namen] = await Promise.all([supabase.from("stundenplan_eintrag").select("id, fach_id, tag, start_zeit, end_zeit, raum, dozent"), fachNamen()]);
        const termine = stundenplanTermine(data ?? [], von, bis).map((t) => ({
          fach: namen.get(t.eintrag.fach_id) ?? "?",
          beginn: datumText(t.start),
          ende: t.eintrag.end_zeit.slice(0, 5),
          raum: t.eintrag.raum,
        }));
        return { zeitraum: `${datumText(von, false)} bis ${datumText(new Date(new Date(bis).getTime() - 1).toISOString(), false)}`, termine };
      },
    },
    {
      name: "pruefungen_lesen",
      beschreibung: "Prüfungen (Klausuren) im Zeitraum mit Datum, Fach und Raum.",
      parameter: { type: "object", properties: { ...ZEITRAUM_PARAMETER, ...FACH_PARAMETER } },
      statusText: "Schaue nach deinen Prüfungen …",
      ausfuehren: async (args) => {
        const { von, bis } = zeitraum(args.von, args.bis, jetzt, 60);
        let q = supabase.from("pruefung").select("id, titel, datum, fach_id, raum, status").gte("datum", von).lt("datum", bis).order("datum").limit(30);
        if (fachFilter(args)) q = q.eq("fach_id", fachFilter(args) as string);
        const [{ data }, namen] = await Promise.all([q, fachNamen()]);
        return { pruefungen: (data ?? []).map((p) => ({ id: p.id, titel: p.titel, datum: datumText(p.datum), fach: namen.get(p.fach_id) ?? null, raum: p.raum, status: p.status })) };
      },
    },
    {
      name: "deadlines_lesen",
      beschreibung: "Deadlines (Abgaben, Fristen, Termine) im Zeitraum.",
      parameter: {
        type: "object",
        properties: { ...ZEITRAUM_PARAMETER, ...FACH_PARAMETER, nur_offen: { type: "boolean", description: "Nur nicht erledigte (Standard: true)" } },
      },
      statusText: "Schaue nach deinen Deadlines …",
      ausfuehren: async (args) => {
        const { von, bis } = zeitraum(args.von, args.bis, jetzt, 14);
        let q = supabase.from("deadline").select("id, titel, faellig_am, fach_id, typ, erledigt").gte("faellig_am", von).lt("faellig_am", bis).order("faellig_am").limit(40);
        if (args.nur_offen !== false) q = q.eq("erledigt", false);
        if (fachFilter(args)) q = q.eq("fach_id", fachFilter(args) as string);
        const [{ data }, namen] = await Promise.all([q, fachNamen()]);
        return {
          deadlines: (data ?? []).map((d) => ({ id: d.id, titel: d.titel, faellig: datumText(d.faellig_am), fach: d.fach_id ? namen.get(d.fach_id) ?? null : null, typ: d.typ, erledigt: d.erledigt })),
        };
      },
    },
    {
      name: "todos_lesen",
      beschreibung: "To-dos des Nutzers.",
      parameter: { type: "object", properties: { ...FACH_PARAMETER, nur_offen: { type: "boolean", description: "Nur offene (Standard: true)" } } },
      statusText: "Schaue in deine To-dos …",
      ausfuehren: async (args) => {
        let q = supabase.from("todo").select("id, titel, fach_id, prioritaet, faellig_am, erledigt").is("parent_id", null).order("erstellt_am", { ascending: false }).limit(40);
        if (args.nur_offen !== false) q = q.eq("erledigt", false);
        if (fachFilter(args)) q = q.eq("fach_id", fachFilter(args) as string);
        const [{ data }, namen] = await Promise.all([q, fachNamen()]);
        return {
          todos: (data ?? []).map((t) => ({ id: t.id, titel: t.titel, fach: t.fach_id ? namen.get(t.fach_id) ?? null : null, prioritaet: t.prioritaet, faellig: t.faellig_am ? datumText(t.faellig_am, false) : null, erledigt: t.erledigt })),
        };
      },
    },
    {
      name: "karteikarten_status",
      beschreibung: "Karteikarten-Stapel mit Kartenzahl, heute fälligen Karten und Lernstand (neu/lernen/jung/sicher).",
      parameter: { type: "object", properties: { ...FACH_PARAMETER } },
      statusText: "Schaue in deine Karteikarten …",
      ausfuehren: async (args) => {
        let sq = supabase.from("kk_stapel").select("id, name, fach_id");
        if (fachFilter(args)) sq = sq.eq("fach_id", fachFilter(args) as string);
        const [{ data: stapel }, namen] = await Promise.all([sq, fachNamen()]);
        const ids = (stapel ?? []).map((s) => s.id);
        const { data: karten } = ids.length
          ? await supabase.from("kk_karte").select("stapel_id, naechste_abfrage, intervall_tage, zuletzt_gelernt").in("stapel_id", ids)
          : { data: [] as { stapel_id: string; naechste_abfrage: string; intervall_tage: number; zuletzt_gelernt: string | null }[] };
        return {
          stapel: (stapel ?? []).map((s) => {
            const eigene = (karten ?? []).filter((k) => k.stapel_id === s.id);
            const verteilung: Record<string, number> = {};
            for (const k of eigene) {
              const r = REIFE_TEXT[reife(k)];
              verteilung[r] = (verteilung[r] ?? 0) + 1;
            }
            return { id: s.id, name: s.name, fach: s.fach_id ? namen.get(s.fach_id) ?? null : null, karten: eigene.length, heute_faellig: anzahlFaellig(eigene, jetzt), lernstand: verteilung };
          }),
        };
      },
    },
    {
      name: "notizen_suchen",
      beschreibung: "Sucht in den Notizen (Titel und Text). Liefert höchstens 5 Treffer mit Auszug.",
      parameter: { type: "object", properties: { suchbegriff: { type: "string", description: "Wort oder Begriff" }, ...FACH_PARAMETER }, required: ["suchbegriff"] },
      statusText: "Suche in deinen Notizen …",
      ausfuehren: async (args) => {
        const begriff = typeof args.suchbegriff === "string" ? args.suchbegriff.trim().slice(0, 80) : "";
        if (begriff.length < 2) throw new KiEingabe("Suchbegriff fehlt.");
        const muster = `%${begriff.replace(/[%_\\,()]/g, " ")}%`;
        let q = supabase.from("notiz").select("id, titel, inhalt, fach_id, geaendert_am").or(`titel.ilike.${muster},inhalt.ilike.${muster}`).order("geaendert_am", { ascending: false }).limit(5);
        if (fachFilter(args)) q = q.eq("fach_id", fachFilter(args) as string);
        const { data } = await q;
        return {
          treffer: (data ?? []).map((n) => {
            const i = n.inhalt.toLocaleLowerCase("de-DE").indexOf(begriff.toLocaleLowerCase("de-DE"));
            const ab = Math.max(0, i - 100);
            return { id: n.id, titel: n.titel || "Unbenannte Notiz", auszug: kurz(n.inhalt.slice(ab, ab + 300), 300) };
          }),
        };
      },
    },
    {
      name: "notiz_lesen",
      beschreibung: "Liest den Inhalt einer Notiz (höchstens 12.000 Zeichen).",
      parameter: { type: "object", properties: { notiz_id: { type: "string" } }, required: ["notiz_id"] },
      statusText: "Lese deine Notiz …",
      ausfuehren: async (args) => {
        const { data } = await supabase.from("notiz").select("id, titel, inhalt, fach_id").eq("id", String(args.notiz_id ?? "")).maybeSingle();
        if (!data) throw new KiEingabe("Notiz nicht gefunden.");
        return { id: data.id, titel: data.titel, inhalt: kurz(data.inhalt, 12_000) };
      },
    },
    {
      name: "lernzeit_lesen",
      beschreibung: "Gelernte Minuten aus der Work Station im Zeitraum, pro Fach.",
      parameter: { type: "object", properties: { ...ZEITRAUM_PARAMETER, ...FACH_PARAMETER } },
      statusText: "Schaue in deine Lernzeit …",
      ausfuehren: async (args) => {
        const { von, bis } = zeitraum(args.von ?? "vor 7 Tagen", args.bis ?? "heute", jetzt);
        let q = supabase.from("lern_session").select("fach_id, dauer_minuten").gte("start", von).lt("start", bis).limit(2000);
        if (fachFilter(args)) q = q.eq("fach_id", fachFilter(args) as string);
        const [{ data }, namen] = await Promise.all([q, fachNamen()]);
        const proFach = new Map<string, number>();
        for (const s of data ?? []) {
          const name = s.fach_id ? namen.get(s.fach_id) ?? "?" : "Allgemein";
          proFach.set(name, (proFach.get(name) ?? 0) + s.dauer_minuten);
        }
        return { minuten_gesamt: [...proFach.values()].reduce((a, b) => a + b, 0), pro_fach: Object.fromEntries(proFach) };
      },
    },
    {
      name: "noten_lesen",
      beschreibung: "Noten des Nutzers und gewichteter Durchschnitt (gesamt und pro Fach).",
      parameter: { type: "object", properties: { ...FACH_PARAMETER } },
      statusText: "Schaue in deine Noten …",
      ausfuehren: async (args) => {
        let q = supabase.from("note").select("titel, wert, gewicht, datum, fach_id, bestanden").order("datum", { ascending: false }).limit(100);
        if (fachFilter(args)) q = q.eq("fach_id", fachFilter(args) as string);
        const [{ data }, namen] = await Promise.all([q, fachNamen()]);
        const liste = data ?? [];
        const schnitt = (n: typeof liste) => {
          const g = n.reduce((s, x) => s + Number(x.gewicht || 1), 0);
          return g ? Math.round((n.reduce((s, x) => s + Number(x.wert) * Number(x.gewicht || 1), 0) / g) * 100) / 100 : null;
        };
        const fachIds = [...new Set(liste.map((n) => n.fach_id))];
        return {
          durchschnitt: schnitt(liste),
          pro_fach: fachIds.map((id) => ({ fach: namen.get(id) ?? "?", durchschnitt: schnitt(liste.filter((n) => n.fach_id === id)) })),
          noten: liste.slice(0, 30).map((n) => ({ titel: n.titel, wert: n.wert, gewicht: n.gewicht, fach: namen.get(n.fach_id) ?? "?", datum: datumText(n.datum, false) })),
        };
      },
    },
  ];
}
