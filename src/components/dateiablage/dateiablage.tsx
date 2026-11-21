"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  dateiLink,
  pdfIndexStatusLaden,
  dateiEndgueltigLoeschen,
  dateiUmbenennen,
  dateiVerschieben,
  dateiVerwendung,
  ausLinkImportieren,
  webLinkSpeichern,
  uploadAbschliessen,
  uploadVerwerfen,
  uploadVorbereiten,
  type Datei,
} from "@/app/(hubs)/dateiablage/actions";
import { fachZuordnungenSpeichern } from "@/app/(hubs)/dateiablage/zuordnung-actions";
import { materialPapierkorb } from "@/app/(hubs)/dateiablage/workflow-actions";
import { MaterialPakete, MaterialTeilen } from "./material-teilen";
import { MaterialFaecherDialog } from "./material-faecher";
import { PapierkorbDialog, ThemenDialog, TitelDialog, UnterlageEinsortieren } from "./material-ordnen";
import { rueckfrage } from "@/components/rueckfrage";
import { MaterialRueckverweise } from "./material-verknuepfungen";
import { MaterialVorschauFenster, useGedruecktHalten } from "./material-vorschau";
import { Zustand } from "@/components/zustand";
import { Icon } from "@/components/nav-icon";
import type { IconName } from "@/lib/icons";
import { UploadMarke } from "@/components/bewegung/upload-marke";
import { RollText } from "@/components/bewegung/roll-text";
import { bewegungReduziert } from "@/lib/personalisierung-store";
import { mitteVon, punktFlug, ziehbildSetzen } from "@/lib/bewegung/punkt";
import { DreiPunkteMenue } from "@/components/hubs/drei-punkte-menue";
import {
  ACCEPT_ATTRIBUT,
  dateiTyp,
  endung,
  groesseText,
  nameOhneEndung,
  uploadPruefen,
  type DateiArt,
} from "@/lib/dateiablage/dateien";
import { hochladenMitFortschritt } from "@/lib/dateiablage/upload";
import { studioOeffnen } from "@/lib/ki/studio-kontext";
import { inZweiterAnsichtOeffnen } from "@/lib/geteilte-ansicht";
import { useMaterialAktivitaet } from "@/lib/dateiablage/material-aktivitaet";
import { pdfPfad } from "@/lib/pdf-reader/fundstelle";
import { fachZuordnungen, MATERIAL_ARTEN, materialPfad, type HubMaterial, type MaterialFachZuordnung, type MaterialRef } from "@/lib/dateiablage/material";
import { linkNormalisieren } from "@/lib/dateiablage/link-import";
import { ablageDateiname, istWebLink, webLinkUrl } from "@/lib/dateiablage/weblink";
import { fehlerMelden, track } from "@/lib/analytics";
import { Bereichskopf } from "@/components/hubs/bereichskopf";
import { kopfListe } from "@/lib/bereichskopf";

export type Ordner = { id: string | null; name: string; farbe: string | null };

type Upload = {
  schluessel: string;
  name: string;
  anteil: number;
  fehler: string | null;
  vonLink?: boolean;
  fertig?: boolean;
  wiederholbar?: boolean;
  datei?: File;
  fachId?: string | null;
};
type Sortierung = { spalte: "name" | "datum" | "groesse"; absteigend: boolean };
type Vorschau = { art: "bild" | "audio"; url: string; name: string; id: string };

// Design B3: Symbole aus dem eigenen Satz statt Emojis
const ART_ICON: Record<DateiArt, IconName> = { pdf: "pdf", bild: "bild", office: "notizen", text: "notizen", audio: "kopfhoerer" };
const OFFICE_ICON: Record<string, IconName> = { docx: "text", pptx: "praesentation", xlsx: "tabelle" };

function icon(name: string): IconName {
  const typ = dateiTyp(name);
  if (!typ) return "notizen";
  return typ.art === "office" ? (OFFICE_ICON[endung(name)] ?? "notizen") : ART_ICON[typ.art];
}

/** Fachfarbe und Ordnersymbol für Lose Blätter. */
function OrdnerZeichen({ ordner }: { ordner: Ordner }) {
  return ordner.id ? (
    <span className="f" style={{ "--c": ordner.farbe ?? "var(--text-3)" } as CSSProperties} aria-hidden />
  ) : (
    <Icon name="dateiablage" groesse={14} className="i" />
  );
}

const DRAG_TYP = "application/x-uniwars-datei";

export function Dateiablage({ userId, initialDateien, material, ordner, speicherBelegt, limit, zuordnungen, mehrfachVerfuegbar, themen, info, workflow, freigaben, ki, pdfStand }: {
  userId: string; initialDateien: Datei[]; material: HubMaterial[]; ordner: Ordner[]; speicherBelegt: number | null; limit: number;
  zuordnungen: MaterialFachZuordnung[]; mehrfachVerfuegbar: boolean;
  themen: { id: string; fach_id: string; name: string }[];
  info: { art: string; material_id: string; anzeigetitel: string | null; papierkorb_am: string | null; papierkorb_titel: string | null }[];
  workflow: boolean; freigaben: boolean; ki: boolean; pdfStand: { datei_id: string; letzte_seite: number }[];
}) {
  const router = useRouter();
  const pfad = usePathname();
  const searchParams = useSearchParams();
  const ordnerParam = searchParams.get("ordner");
  const aktuellerOrdner = ordner.find((o) => o.id === ordnerParam) ?? ordner[0];

  const aktivitaet = useMaterialAktivitaet(userId);
  const [sonderansicht, setSonderansicht] = useState<"pakete" | "papierkorb" | null>(null);
  const [aktion, setAktion] = useState<{ art: "titel" | "titel-vorschlag" | "thema" | "faecher" | "verknuepfen" | "teilen" | "papierkorb"; id: string } | null>(null);
  const [paketOffen, setPaketOffen] = useState(false);
  const [themenOffen, setThemenOffen] = useState(false);
  const [leselisteOffen, setLeselisteOffen] = useState(false);
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [fachWahl, setFachWahl] = useState("");
  const [zielThema, setZielThema] = useState("");
  const [sortiert, setSortiert] = useState(false);
  const [serverDateien, setServerDateien] = useState(initialDateien);
  const [dateien, setDateien] = useState(initialDateien);
  if (serverDateien !== initialDateien) {
    setServerDateien(initialDateien);
    setDateien(initialDateien);
  }
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [sortierung, setSortierung] = useState<Sortierung>({ spalte: "datum", absteigend: true });
  const [umbenennenId, setUmbenennenId] = useState<string | null>(null);
  const [verschiebenId, setVerschiebenId] = useState<string | null>(null);
  const [materialVorschau, setMaterialVorschau] = useState<string | null>(null);
  const druck = useGedruecktHalten(setMaterialVorschau);
  const [vorschau, setVorschau] = useState<Vorschau | null>(null);
  const [ziehenUeber, setZiehenUeber] = useState(false);
  const [ordnerZiel, setOrdnerZiel] = useState<string | null | undefined>(undefined);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [linkOffen, setLinkOffen] = useState(false);
  const [linkWert, setLinkWert] = useState("");
  const [webLinkWartet, setWebLinkWartet] = useState(false);
  const eingabe = useRef<HTMLInputElement>(null);
  const einfuegenRef = useRef<(e: ClipboardEvent) => void>(() => undefined);

  const pdfOffen = dateien.filter((d) => d.pdf_index_status === "wartet").slice(0, 80).map((d) => d.id).join(",");
  useEffect(() => {
    if (!pdfOffen) return;
    let aktiv = true;
    const timer = window.setInterval(() => {
      void pdfIndexStatusLaden(pdfOffen.split(",")).then((status) => {
        if (!aktiv) return;
        const nachId = new Map(status.map((s) => [s.id, s.pdf_index_status]));
        setDateien((liste) => liste.map((d) => nachId.has(d.id) ? { ...d, pdf_index_status: nachId.get(d.id) ?? null } : d));
      }).catch(() => undefined);
    }, 2500);
    return () => { aktiv = false; window.clearInterval(timer); };
  }, [pdfOffen]);
  const eigeneBytes = (liste: Datei[]) => liste.reduce((summe, d) => summe + (d.user_id === userId ? Number(d.groesse) : 0), 0);
  const belegt = eigeneBytes(dateien) + (speicherBelegt === null ? 0 : Math.max(0, Number(speicherBelegt) - eigeneBytes(initialDateien)));
  const voll = belegt >= limit;

  const infoNachId = new Map(info.map((i) => [`${i.art}:${i.material_id}`, i]));
  const alle = [
    ...dateien.map((datei) => ({ id: `datei:${datei.id}`, titel: infoNachId.get(`datei:${datei.id}`)?.anzeigetitel ?? ablageDateiname(datei), fachId: datei.fach_id, datei, hub: null })),
    ...material.map((hub) => ({ id: `${hub.art}:${hub.id}`, titel: infoNachId.get(`${hub.art}:${hub.id}`)?.anzeigetitel ?? hub.titel, fachId: hub.fachId, datei: null, hub })),
  ].filter((e) => !infoNachId.get(e.id)?.papierkorb_am);
  type Eintrag = (typeof alle)[number];
  function ref(e: Eintrag): MaterialRef {
    return e.hub ? { art: e.hub.art, id: e.hub.id } : { art: "datei", id: e.datei!.id };
  }
  const eigenes = (e: Eintrag) => (e.datei?.user_id ?? e.hub?.userId) === userId;
  const fachThemen = themen.filter((t) => t.fach_id === aktuellerOrdner.id);
  const nachId = new Map(alle.map((e) => [e.id, e]));
  const zuordnungenNachId = new Map<string, MaterialFachZuordnung[]>();
  for (const z of zuordnungen) {
    const key = `${z.art}:${z.material_id}`;
    const gruppe = zuordnungenNachId.get(key) ?? [];
    gruppe.push(z);
    zuordnungenNachId.set(key, gruppe);
  }
  function liegtIn(eintrag: Eintrag, fachId: string | null) {
    const faecher = fachZuordnungen(eintrag.fachId, zuordnungenNachId.get(eintrag.id) ?? []);
    return fachId ? faecher.includes(fachId) : faecher.length === 0;
  }
  const aktionsEintrag = aktion ? nachId.get(aktion.id) : null;
  const themaVon = (e: Eintrag) => zuordnungenNachId.get(e.id)?.find((z) => z.fach_id === aktuellerOrdner.id)?.thema_id ?? null;
  const vorschauEintrag = materialVorschau ? nachId.get(materialVorschau) : null;
  const zuletzt = new Set(aktivitaet.zuletzt.filter((id) => nachId.has(id)).slice(0, 4));
  const istPin = (id: string) => aktivitaet.pins.includes(`${aktuellerOrdner.id ?? "lose"}:${id}`);
  const eintraege = alle.filter((e) => sonderansicht === "pakete" ? !eigenes(e) : leselisteOffen ? Object.hasOwn(aktivitaet.lesen, e.id) : liegtIn(e, aktuellerOrdner.id));
  const faktor = sortierung.absteigend ? -1 : 1;
  eintraege.sort((a, b) => {
    if (!leselisteOffen && istPin(a.id) !== istPin(b.id)) return istPin(a.id) ? -1 : 1;
    if (sortierung.spalte === "name") return faktor * a.titel.localeCompare(b.titel, "de", { numeric: true });
    if (sortierung.spalte === "groesse") {
      return faktor * (Number(a.datei?.groesse ?? 0) - Number(b.datei?.groesse ?? 0));
    }
    const erstelltA = a.datei?.erstellt_am ?? a.hub?.erstelltAm ?? "";
    const erstelltB = b.datei?.erstellt_am ?? b.hub?.erstelltAm ?? "";
    return faktor * erstelltA.localeCompare(erstelltB);
  });
  const ausgewaehlt = eintraege.filter((e) => auswahl.includes(e.id));
  const mitGruppen = !leselisteOffen && !sonderansicht && fachThemen.length > 0;
  const tabellenzeilen = mitGruppen
    ? [...eintraege.filter((e) => istPin(e.id) || !themaVon(e)),
        ...fachThemen.flatMap((t) => [t, ...eintraege.filter((e) => !istPin(e.id) && themaVon(e) === t.id)])]
    : eintraege;

  function eintragOeffnen(eintrag: Eintrag) {
    if (eintrag.datei) void oeffnen(eintrag.datei);
    if (eintrag.hub) {
      aktivitaet.oeffnen(eintrag.id);
      router.push(materialPfad(eintrag.hub));
    }
  }

  function eintragPfad(eintrag: Eintrag): string | null {
    if (eintrag.hub) return materialPfad(eintrag.hub);
    if (!eintrag.datei) return null;
    if (istWebLink(eintrag.datei)) return `/dateiablage/weblink/${eintrag.datei.id}`;
    const art = dateiTyp(eintrag.datei.name)?.art;
    if (art === "pdf") return pdfPfad(eintrag.datei.id);
    if (art === "bild" || art === "audio" || art === "text") return `/dateiablage/oeffnen/${eintrag.datei.id}`;
    return null;
  }

  async function zuordnen(eintraege: Eintrag[], fachId: string, entfernen = false, themaId?: string) {
    setSortiert(true);
    try {
      await fachZuordnungenSpeichern(eintraege.map((e) => ({
        art: e.hub?.art ?? "datei",
        material_id: e.hub?.id ?? e.datei?.id ?? "",
        fach_id: fachId,
        ausgeblendet: entfernen,
        ...(themaId ? { thema_id: themaId } : {}),
      })));
      setAuswahl([]);
      setFachWahl("");
      setZielThema("");
    } catch {
      setMeldung("Die Fachzuordnung konnte nicht gespeichert werden.");
    } finally {
      setSortiert(false);
    }
  }

  function nebeneinanderOeffnen() {
    const [links, rechts] = ausgewaehlt.map(eintragPfad);
    if (!links || !rechts) return;
    inZweiterAnsichtOeffnen(rechts);
    router.push(links);
  }

  function auswahlUmschalten(id: string) {
    setAuswahl((vorher) => vorher.includes(id) ? vorher.filter((x) => x !== id) : [...vorher, id]);
  }

  function privateAktionen(eintrag: Eintrag) {
    const aufListe = Object.hasOwn(aktivitaet.lesen, eintrag.id);
    return [
      { label: "Vorschau", onClick: () => setMaterialVorschau(eintrag.id) },
      ...(workflow && eigenes(eintrag) ? [
        { label: "Anzeigetitel bearbeiten", onClick: () => setAktion({ art: "titel", id: eintrag.id }) },
        ...(ki ? [{ label: "Titel vorschlagen", icon: "studio" as const, onClick: () => setAktion({ art: "titel-vorschlag", id: eintrag.id }) }] : []),
        { label: "Mit Aufgabe oder Prüfung verknüpfen", onClick: () => setAktion({ art: "verknuepfen", id: eintrag.id }) },
        ...(freigaben ? [{ label: "Freigeben", onClick: () => setAktion({ art: "teilen", id: eintrag.id }) }] : []),
        { label: "In den Papierkorb verschieben", onClick: () => setAktion({ art: "papierkorb", id: eintrag.id }), gefahr: true },
      ] : []),
      ...(mehrfachVerfuegbar ? [{
        label: "Fächer zuordnen",
        onClick: () => setAktion({ art: "faecher", id: eintrag.id }),
      }] : []),
      ...(mehrfachVerfuegbar && aktuellerOrdner.id && !leselisteOffen ? [{
        label: "Aus diesem Fach entfernen",
        onClick: () => { if (aktuellerOrdner.id) void zuordnen([eintrag], aktuellerOrdner.id, true); },
      }] : []),
      ...(workflow && ordner.some((o) => o.id) ? [{
        label: "In Themenstapel legen",
        onClick: () => setAktion({ art: "thema", id: eintrag.id }),
      }] : []),
      ...(!leselisteOffen ? [{ label: istPin(eintrag.id) ? "Pin lösen" : "Anpinnen", icon: "anheften" as const, onClick: () => aktivitaet.pin(aktuellerOrdner.id, eintrag.id) }] : []),
      { label: aufListe ? "Von Leseliste entfernen" : "Später lesen", onClick: () => aktivitaet.leseliste(eintrag.id, aufListe ? null : false) },

    ];
  }

  function ordnerOeffnen(id: string | null) {
    setAuswahl([]);
    setLeselisteOffen(false);
    setSonderansicht(null);
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("ordner", id);
    else params.delete("ordner");
    const query = params.toString();
    router.push(query ? `${pfad}?${query}` : pfad, { scroll: false });
  }

  function anzahl(id: string | null) {
    return alle.filter((e) => liegtIn(e, id)).length;
  }

  // --- DAT-02 Hochladen ---------------------------------------------------
  async function eineHochladen(datei: File, fachId: string | null, schluessel: string) {
    const setzen = (teil: Partial<Upload>) =>
      setUploads((liste) => liste.map((u) => (u.schluessel === schluessel ? { ...u, ...teil } : u)));
    let ticketPfad: string | null = null;
    try {
      const ticket = await uploadVorbereiten({ name: datei.name, groesse: datei.size, fachId });
      ticketPfad = ticket.pfad;
      setzen({ name: ticket.name });
      await hochladenMitFortschritt(ticket.signedUrl, datei, ticket.mime, (anteil) => setzen({ anteil }));
      const neu = await uploadAbschliessen({ pfad: ticket.pfad, name: ticket.name, fachId });
      ticketPfad = null;
      setDateien((liste) => [neu, ...liste.filter((d) => d.id !== neu.id)]);
      // Die Lichtspur schließt sich zum Haken, danach verschwindet der Eintrag
      setzen({ anteil: 1, fertig: true });
      window.setTimeout(() => setUploads((liste) => liste.filter((u) => u.schluessel !== schluessel)), 1100);
      track("datei_hochgeladen", { art: dateiTyp(datei.name)?.art ?? "unbekannt", kb: Math.round(datei.size / 1024), mit_fach: Boolean(fachId) });
    } catch (err) {
      if (ticketPfad) void uploadVerwerfen(ticketPfad).catch(() => undefined);
      const text = err instanceof Error && !/minified react error|server components render/i.test(err.message) && !("digest" in err)
        ? err.message : "Die Datei konnte nicht hochgeladen werden. Versuch es noch einmal.";
      setzen({ fehler: text, wiederholbar: true });
      fehlerMelden(err, { ort: "datei_upload" });
    }
  }

  function hochladen(liste: FileList | File[]) {
    const fachId = aktuellerOrdner.id;
    let reserviert = belegt;
    const neue: Upload[] = [];
    const starten: [File, string][] = [];
    for (const datei of Array.from(liste)) {
      const schluessel = crypto.randomUUID();
      const pruefung = uploadPruefen(datei.name, datei.size, reserviert);
      if (!pruefung.ok) {
        neue.push({ schluessel, name: datei.name, anteil: 0, fehler: pruefung.fehler });
        continue;
      }
      reserviert += datei.size;
      // Datei bleibt am Eintrag, damit ein abgebrochener Upload erneut versucht werden kann
      neue.push({ schluessel, name: datei.name, anteil: 0, fehler: null, datei, fachId });
      starten.push([datei, schluessel]);
    }
    setUploads((u) => [...u, ...neue]);
    // Höchstens drei gleichzeitig
    const warteschlange = [...starten];
    const arbeiter = async () => {
      for (let naechste = warteschlange.shift(); naechste; naechste = warteschlange.shift()) {
        await eineHochladen(naechste[0], fachId, naechste[1]);
      }
    };
    void Promise.all([arbeiter(), arbeiter(), arbeiter()]);
  }

  function erneutHochladen(u: Upload) {
    if (!u.datei || u.fachId === undefined) return;
    setUploads((l) => l.map((x) => (x.schluessel === u.schluessel ? { ...x, anteil: 0, fehler: null, wiederholbar: false } : x)));
    void eineHochladen(u.datei, u.fachId, u.schluessel);
  }

  // --- Import über einen Link (öffentliche Dateien, der Server lädt sie herunter) ---
  async function ausLink(link: string) {
    const fachId = aktuellerOrdner.id;
    const schluessel = crypto.randomUUID();
    let anzeige = link.trim();
    try {
      const u = linkNormalisieren(link);
      if (u) anzeige = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? u.hostname) || u.hostname;
    } catch {
      // Anzeige bleibt der Link
    }
    setUploads((u) => [...u, { schluessel, name: anzeige, anteil: 0, fehler: null, vonLink: true }]);
    const a = await ausLinkImportieren({ link, fachId }).catch(() => null);
    if (!a?.ok) {
      const fehler = a && !a.ok ? a.fehler : "Keine Verbindung. Bitte versuch es noch einmal.";
      setUploads((liste) => liste.map((u) => (u.schluessel === schluessel ? { ...u, fehler } : u)));
      track("datei_link_import_fehler", {});
      return;
    }
    setDateien((liste) => [a.datei, ...liste]);
    setUploads((liste) => liste.filter((u) => u.schluessel !== schluessel));
    track("datei_hochgeladen", { art: dateiTyp(a.datei.name)?.art ?? "unbekannt", kb: Math.round(Number(a.datei.groesse) / 1024), mit_fach: Boolean(fachId), quelle: "link" });
  }

  function linkAbschicken() {
    if (!linkNormalisieren(linkWert)) return;
    void ausLink(linkWert);
    setLinkWert("");
    setLinkOffen(false);
  }

  async function alsWebLinkSpeichern() {
    if (!webLinkUrl(linkWert)) return;
    setWebLinkWartet(true);
    try {
      const antwort = await webLinkSpeichern({ link: linkWert, fachId: aktuellerOrdner.id });
      if (!antwort.ok) {
        setMeldung(antwort.fehler);
        return;
      }
      setDateien((liste) => [antwort.datei, ...liste.filter((d) => d.id !== antwort.datei.id)]);
      setLinkWert("");
      setLinkOffen(false);
      setMeldung(null);
    } catch {
      setMeldung("Der Link konnte nicht gespeichert werden.");
    } finally {
      setWebLinkWartet(false);
    }
  }

  // Strg+V auf der Seite: kopierter Link wird importiert, kopierte Dateien hochgeladen
  useEffect(() => {
    einfuegenRef.current = (e: ClipboardEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (ziel && (ziel.tagName === "INPUT" || ziel.tagName === "TEXTAREA" || ziel.isContentEditable)) return;
      if (document.querySelector("dialog[open], .quick-add-overlay")) return;
      const kopierteDateien = Array.from(e.clipboardData?.files ?? []);
      if (kopierteDateien.length) {
        e.preventDefault();
        if (!voll) hochladen(kopierteDateien);
        return;
      }
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (linkNormalisieren(text)) {
        e.preventDefault();
        if (voll) setMeldung("Dein Speicherplatz ist voll (2 GB).");
        else void ausLink(text);
      }
    };
  });
  useEffect(() => {
    const einfuegen = (e: ClipboardEvent) => einfuegenRef.current(e);
    window.addEventListener("paste", einfuegen);
    return () => window.removeEventListener("paste", einfuegen);
  }, []);

  // --- DAT-04 Öffnen ------------------------------------------------------
  async function oeffnen(d: Datei) {
    if (istWebLink(d)) {
      router.push(`/dateiablage/weblink/${d.id}`);
      return;
    }
    const art = dateiTyp(d.name)?.art;
    track("datei_geoeffnet", { art: art ?? "unbekannt" });
    if (art === "pdf") {
      aktivitaet.oeffnen(`datei:${d.id}`);
      router.push(pdfPfad(d.id));
      return;
    }
    try {
      const url = await dateiLink(d.id, art !== "bild" && art !== "audio");
      aktivitaet.oeffnen(`datei:${d.id}`);
      if (art === "bild" || art === "audio") setVorschau({ art, url, name: d.name, id: d.id });
      else window.location.assign(url);
    } catch (err) {
      setMeldung("Datei konnte nicht geöffnet werden.");
      fehlerMelden(err, { ort: "datei_oeffnen" });
    }
  }

  async function herunterladen(d: Datei) {
    try {
      window.location.assign(await dateiLink(d.id, true));
      track("datei_heruntergeladen", { art: dateiTyp(d.name)?.art ?? "unbekannt" });
    } catch (err) {
      setMeldung("Download hat nicht geklappt.");
      fehlerMelden(err, { ort: "datei_download" });
    }
  }

  async function verschieben(d: Datei, fachId: string | null) {
    setVerschiebenId(null);
    if ((d.fach_id ?? null) === fachId) return;
    // Bewegung: die Zeile tritt zurück, ein goldener Punkt fliegt vom Symbol zum Ordner
    const zeile = document.querySelector<HTMLElement>(`[data-datei="${d.id}"]`);
    const zielEl = document.querySelector(`[data-ort="${fachId ?? "allgemein"}"]`);
    if (zeile && zielEl) {
      zeile.animate([{ opacity: 1 }, { opacity: 0.25 }], { duration: 120, fill: "forwards" });
      await punktFlug(mitteVon(zeile.querySelector(".dat-typ") ?? zeile), mitteVon(zielEl));
      zielEl.classList.add("ortswechsel-ziel");
      window.setTimeout(() => zielEl.classList.remove("ortswechsel-ziel"), 600);
    }
    try {
      const neu = await dateiVerschieben(d.id, fachId);
      setDateien((liste) => liste.map((x) => (x.id === d.id ? neu : x)));
      track("datei_verschoben");
    } catch (err) {
      zeile?.getAnimations().forEach((a) => a.cancel());
      setMeldung("Verschieben hat nicht geklappt.");
      fehlerMelden(err, { ort: "datei_verschieben" });
    }
  }

  async function loeschen(d: Datei) {
    let hinweis = "";
    try {
      const { anhaenge, quellen } = await dateiVerwendung(d.id);
      const teile = [
        anhaenge > 0 ? `an ${anhaenge} ${anhaenge === 1 ? "Eintrag" : "Einträgen"} angehängt` : "",
        quellen > 0 ? `mit ${quellen} ${quellen === 1 ? "Quelle" : "Quellen"} verknüpft` : "",
      ].filter(Boolean);
      if (teile.length) hinweis = ` Sie ist ${teile.join(" und ")}.`;
    } catch {
      // Hinweis ist optional
    }
    if (!(await rueckfrage({ titel: "Datei endgültig löschen?", text: `„${d.name}“ wird endgültig gelöscht.${hinweis}`, ja: "Endgültig löschen", gefahr: true }))) return;
    // Bewegung: die Zeile tritt zurück, bevor sie verschwindet (nur Deckkraft, kein Weg)
    const zeile = document.querySelector<HTMLElement>(`[data-datei="${d.id}"]`);
    if (zeile && !bewegungReduziert()) {
      await zeile.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "cubic-bezier(0.4, 0, 0.9, 0.5)", fill: "forwards" }).finished.catch(() => undefined);
    }
    setDateien((liste) => liste.filter((x) => x.id !== d.id));
    try {
      if (!await dateiEndgueltigLoeschen(d.id)) throw new Error("Endgültiges Löschen nicht verfügbar.");
      setMeldung(null);
      track("datei_geloescht");
    } catch (err) {
      setDateien((liste) => [d, ...liste]);
      setMeldung("Löschen hat nicht geklappt.");
      fehlerMelden(err, { ort: "datei_loeschen" });
    }
  }

  function sortierenNach(spalte: Sortierung["spalte"]) {
    setSortierung((s) => (s.spalte === spalte ? { spalte, absteigend: !s.absteigend } : { spalte, absteigend: spalte !== "name" }));
  }

  const pfeil = (spalte: Sortierung["spalte"]) => (sortierung.spalte === spalte ? (sortierung.absteigend ? " ↓" : " ↑") : "");
  const ariaSort = (spalte: Sortierung["spalte"]) =>
    sortierung.spalte === spalte ? (sortierung.absteigend ? "descending" : "ascending") : "none";

  const hochladenKnopf = (
    <>
      <button
        type="button"
        className="knopf leise"
        onClick={() => setLinkOffen((o) => !o)}
        disabled={voll}
        aria-expanded={linkOffen}
        title="Datei über einen Link importieren (oder Link mit Strg+V einfügen)"
      >
        <Icon name="link" groesse={16} />
        Aus Link
      </button>
      <button type="button" className="knopf haupt" onClick={() => eingabe.current?.click()} disabled={voll} title={voll ? "Speicher voll" : undefined}>
        <Icon name="hochladen" groesse={16} />
        Hochladen
      </button>
      <input
        ref={eingabe}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUT}
        hidden
        onChange={(e) => {
          if (e.target.files?.length) hochladen(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );

  return (
    <>
      <Bereichskopf
        titel="Dateiablage"
        {...(serverDateien.length ? kopfListe(serverDateien.map((d) => ({ titel: d.name, geaendert: d.geaendert_am })), "Datei", ["Datei", "Dateien"]) : {})}
        aktionen={hochladenKnopf}
      />
      {linkOffen && (
        <form
          className="crud-form dat-link-form"
          onSubmit={(e) => {
            e.preventDefault();
            linkAbschicken();
          }}
        >
          <label className="dat-link-zeile">
            <span className="sr-only">Webadresse</span>
            <input
              className="field"
              type="url"
              inputMode="url"
              autoFocus
              placeholder="https://… Webadresse einfügen"
              disabled={webLinkWartet}
              value={linkWert}
              onChange={(e) => setLinkWert(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setLinkOffen(false);
              }}
            />
          </label>
          <button type="submit" className="knopf haupt" disabled={webLinkWartet || !linkNormalisieren(linkWert)}>
            Datei importieren
          </button>
          <button type="button" className="knopf neben" disabled={webLinkWartet || !webLinkUrl(linkWert)} onClick={() => void alsWebLinkSpeichern()}>
            Als Weblink speichern
          </button>
          <button type="button" className="knopf leise" onClick={() => setLinkOffen(false)}>
            Abbrechen
          </button>
          <p className="muted dat-link-tipp">
            Füge die Adresse einer öffentlich erreichbaren Datei ein. Für Dateien aus Moodle oder ILIAS kannst du den Download hierher ziehen.
          </p>
        </form>
      )}
      {meldung && (
        <p className="formular-fehler dat-meldung" role="alert">
          {meldung}
          <button type="button" className="knopf leise klein nur-symbol" aria-label="Meldung schließen" onClick={() => setMeldung(null)}>
            <Icon name="schliessen" groesse={16} />
          </button>
        </p>
      )}

      <div className="dat-layout">
        <aside className="dat-ordner" aria-label="Ordner">
          <h2 className="gt">Ordner</h2>
          <ul className="kliste">
            {ordner.map((o) => (
              <li key={o.id ?? "allgemein"}>
                <button
                  type="button"
                  className={`keintrag dat-ordner-knopf${ordnerZiel === o.id ? " ziel" : ""}`}
                  data-ort={o.id ?? "allgemein"}
                  aria-current={o.id === aktuellerOrdner.id ? "true" : undefined}
                  onClick={() => ordnerOeffnen(o.id)}
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes(DRAG_TYP)) {
                      e.preventDefault();
                      setOrdnerZiel(o.id);
                    }
                  }}
                  onDragLeave={() => setOrdnerZiel(undefined)}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData(DRAG_TYP);
                    setOrdnerZiel(undefined);
                    const d = dateien.find((x) => x.id === id);
                    if (d) {
                      e.preventDefault();
                      void verschieben(d, o.id);
                    }
                  }}
                >
                  <OrdnerZeichen ordner={o} />
                  <span className="n">{o.name}</span>
                  <RollText className="z" wert={String(anzahl(o.id))} />
                </button>
              </li>
            ))}
          </ul>

          {/* Leseliste, Geteiltes und Papierkorb als Einträge wie die Ordner, nicht als drei Knöpfe (Aufgabe 4, B9) */}
          <ul className="kliste dat-sonder" aria-label="Weitere Ansichten">
            <li>
              <button
                type="button"
                className="keintrag dat-ordner-knopf"
                aria-pressed={leselisteOffen}
                onClick={() => { setSonderansicht(null); setLeselisteOffen(!leselisteOffen); setAuswahl([]); }}
              >
                <Icon name="lesezeichen" groesse={16} />
                <span className="n">Leseliste</span>
              </button>
            </li>
            {freigaben && (
              <li>
                <button type="button" className="keintrag dat-ordner-knopf" aria-pressed={sonderansicht === "pakete"}
                  onClick={() => { setSonderansicht("pakete"); setLeselisteOffen(false); setAuswahl([]); }}>
                  <Icon name="gruppe" groesse={16} />
                  <span className="n">Mit mir geteilt</span>
                </button>
              </li>
            )}
            {workflow && (
              <li>
                <button type="button" className="keintrag dat-ordner-knopf" aria-pressed={sonderansicht === "papierkorb"}
                  onClick={() => { setSonderansicht("papierkorb"); setLeselisteOffen(false); setAuswahl([]); }}>
                  <Icon name="loeschen" groesse={16} />
                  <span className="n">Papierkorb</span>
                </button>
              </li>
            )}
          </ul>

          {/* DAT-09 */}
          <div className="dat-speicher">
            <span className={`balkenf${voll ? " voll" : ""}`} aria-hidden>
              <i style={{ width: `${Math.min(100, (belegt / limit) * 100)}%` }} />
            </span>
            <span className={voll ? "dat-speicher-voll" : undefined}>
              {groesseText(belegt)} von {groesseText(limit)} belegt
            </span>
            {voll && <span className="dat-speicher-voll">Dein Speicher ist voll. Dateien im Papierkorb belegen weiterhin Speicher.</span>}
          </div>
        </aside>

        <section
          className={`dat-inhalt${ziehenUeber ? " dat-ablegen" : ""}`}
          aria-label={`Unterlagen in ${aktuellerOrdner.name}`}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files") || e.dataTransfer.types.includes("text/uri-list")) {
              e.preventDefault();
              setZiehenUeber(true);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setZiehenUeber(false);
          }}
          onDrop={(e) => {
            if (!e.dataTransfer.files.length) {
              const link = e.dataTransfer.getData("text/uri-list").split("\n").find((z) => z && !z.startsWith("#")) ?? "";
              if (!linkNormalisieren(link)) return;
              e.preventDefault();
              setZiehenUeber(false);
              if (!voll) void ausLink(link);
              return;
            }
            e.preventDefault();
            setZiehenUeber(false);
            if (!voll) hochladen(e.dataTransfer.files);
          }}
        >
          <h2 className="abschnitt-titel dat-titel">{sonderansicht === "papierkorb" ? "Papierkorb" : sonderansicht === "pakete" ? "Mit mir geteilt" : leselisteOffen ? "Leseliste" : aktuellerOrdner.name}</h2>
          {sonderansicht === "pakete" && <MaterialPakete />}
          {sonderansicht === "papierkorb" && (
            <ul className="dat-workflow-liste">{info.filter((i) => i.papierkorb_am).map((i) => <li key={`${i.art}:${i.material_id}`}>
              <span>{i.papierkorb_titel ?? "Unterlage"}</span>
              <button type="button" className="knopf leise klein" onClick={() => {
                void materialPapierkorb({ art: i.art as MaterialRef["art"], id: i.material_id }, false)
                  .catch(() => setMeldung("Die Unterlage konnte nicht wiederhergestellt werden."));
              }}>Wiederherstellen</button>
            </li>)}</ul>
          )}
          <div className="dat-auswahl-form dat-arbeitsaktionen">
          {workflow && aktuellerOrdner.id && !leselisteOffen && !sonderansicht && (
            <button type="button" className="knopf neben klein dat-auswahl-aktion" onClick={() => setThemenOffen(true)}>Themen ordnen</button>
          )}
          {ki && aktuellerOrdner.id && !sonderansicht && !leselisteOffen && (
            <button type="button" className="knopf neben klein dat-auswahl-aktion" onClick={() => {
              const id = aktuellerOrdner.id;
              if (id) studioOeffnen(`Gib mir einen Crashkurs zu dem, was wir zuletzt in ${aktuellerOrdner.name} gemacht haben.`, { crashkursFachId: id });
            }}>Crashkurs mit Studio</button>
          )}
          {ki && ausgewaehlt.length > 0 && ausgewaehlt.length <= 20 && sonderansicht !== "papierkorb" && (
            <button type="button" className="knopf neben klein dat-auswahl-aktion dat-aktion-einzeilig" onClick={() => studioOeffnen(undefined, { material: ausgewaehlt.map(ref) })}>Auswahl mit Studio besprechen</button>
          )}
          {freigaben && sonderansicht !== "papierkorb" && ausgewaehlt.length > 0 && ausgewaehlt.every(eigenes) && (
            <button type="button" className="knopf neben klein dat-auswahl-aktion" onClick={() => setPaketOffen(true)}>Als Materialpaket teilen</button>
          )}
          {!mehrfachVerfuegbar && !leselisteOffen && !sonderansicht && ausgewaehlt.length > 0 && (
            <span className="dat-index-hinweis" role="status">Die Mehrfachzuordnung wird mit dem Datenbank-Update verfügbar.</span>
          )}
          {mehrfachVerfuegbar && !leselisteOffen && sonderansicht !== "papierkorb" && ausgewaehlt.length > 0 && (
            <div className="dat-auswahl-form">
              <select className="field" value={fachWahl} onChange={(e) => { setFachWahl(e.target.value); setZielThema(""); }} aria-label="Zielfach">
                <option value="">Fach auswählen</option>
                {ordner.filter((o) => o.id && o.id !== aktuellerOrdner.id).map((o) => <option key={o.id} value={o.id ?? ""}>{o.name}</option>)}
              </select>
              {fachWahl && themen.some((t) => t.fach_id === fachWahl) && (
                <select className="field" value={zielThema} onChange={(e) => setZielThema(e.target.value)} aria-label="Zielthema">
                  <option value="">Ohne Thema</option>
                  {themen.filter((t) => t.fach_id === fachWahl).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
              <button type="button" className="knopf neben klein" disabled={!fachWahl || sortiert}
                onClick={() => void zuordnen(ausgewaehlt, fachWahl, false, zielThema || undefined)}>
                Dem Fach zuordnen
              </button>
            </div>
          )}
          {ausgewaehlt.length === 2 && ausgewaehlt.every(eintragPfad) && (
            <button type="button" className="knopf neben klein dat-auswahl-aktion" onClick={nebeneinanderOeffnen}>
              Nebeneinander öffnen
            </button>
          )}
          </div>

          {uploads.length > 0 && (
            <ul className="dat-uploads" aria-live="polite">
              {uploads.map((u) => (
                <li key={u.schluessel} className={u.fertig ? "fertig" : u.fehler ? "fehler" : ""}>
                  <UploadMarke anteil={u.anteil} fertig={Boolean(u.fertig)} fehler={Boolean(u.fehler)} icon={icon(u.name)} />
                  <span className="dat-upload-name">{u.name}</span>
                  {u.fehler ? (
                    <>
                      <span className="dat-upload-fehler">{u.fehler}</span>
                      {u.wiederholbar && (
                        <button type="button" className="knopf neben klein" onClick={() => erneutHochladen(u)}>
                          Erneut versuchen
                        </button>
                      )}
                      <button
                        type="button"
                        className="knopf leise klein nur-symbol"
                        aria-label="Hinweis schließen"
                        onClick={() => setUploads((l) => l.filter((x) => x.schluessel !== u.schluessel))}
                      >
                        <Icon name="schliessen" groesse={16} />
                      </button>
                    </>
                  ) : u.vonLink ? (
                    <span className="dat-upload-info">Wird aus dem Link geladen …</span>
                  ) : (
                    <span className="dat-upload-info zahl">{u.fertig ? "Hochgeladen" : `${Math.round(u.anteil * 100)} %`}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {sonderansicht !== "papierkorb" && (tabellenzeilen.length === 0 ? (sonderansicht === "pakete" ? null : (
            <Zustand
              art="leer"
              region
              ebene={3}
              icon="dateiablage"
              titel={leselisteOffen ? "Keine Unterlagen auf der Leseliste" : "Noch keine Unterlagen"}
              aktion={!leselisteOffen && (
                <button type="button" className="knopf neben klein" onClick={() => eingabe.current?.click()} disabled={voll}>
                  <Icon name="hochladen" groesse={16} />
                  Dateien hochladen
                </button>
              )}
            >{leselisteOffen ? "Wähle bei einer Unterlage „Später lesen“." : aktuellerOrdner.id ? "Lade eine Datei hoch oder ordne vorhandenes Lernmaterial diesem Fach zu." : "Hier erscheinen Unterlagen ohne Fach."}
            </Zustand>
          )) : (
            <div className="dat-tabelle-wrap">
              <table className="dat-tabelle">
                <thead>
                  <tr>
                    <th className="dat-spalte-auswahl" aria-label="Auswahl" />
                    {leselisteOffen && <th className="dat-spalte-auswahl" aria-label="Gelesen" />}
                    <th className="dat-spalte-typ" aria-label="Symbol" />
                    <th aria-sort={ariaSort("name")}>
                      <button type="button" onClick={() => sortierenNach("name")}>
                        Name{pfeil("name")}
                      </button>
                    </th>
                    <th className="dat-spalte-groesse" aria-sort={ariaSort("groesse")}>
                      <button type="button" onClick={() => sortierenNach("groesse")}>
                        Größe{pfeil("groesse")}
                      </button>
                    </th>
                    <th className="dat-spalte-material">Typ</th>
                    <th aria-label="Aktionen" />
                  </tr>
                </thead>
                <tbody>
                  {tabellenzeilen.map((eintrag) => {
                    if (!("datei" in eintrag)) return <tr className="dat-thema-zeile" key={eintrag.id}><td colSpan={6}>
                      <span className="dat-thema-linie">{eintrag.name}</span>
                    </td></tr>;
                    const { id, datei: d, hub } = eintrag;
                    const kuerzlichGeoeffnet = zuletzt.has(id);
                    const zuletztHinweis = kuerzlichGeoeffnet && <span className="dat-zuletzt-hinweis">Zuletzt geöffnet</span>;
                    const letzteSeite = d && kuerzlichGeoeffnet ? pdfStand.find((p) => p.datei_id === d.id)?.letzte_seite : undefined;
                    const auswahlZelle = (
                      <>
                        <td className="dat-spalte-auswahl">
                          <input type="checkbox" aria-label={`${eintrag.titel} auswählen`} checked={auswahl.includes(id)} onChange={() => auswahlUmschalten(id)} />
                        </td>
                        {leselisteOffen && (
                          <td className="dat-spalte-auswahl">
                            <input type="checkbox" aria-label={`${eintrag.titel} gelesen`} checked={aktivitaet.lesen[id] ?? false} onChange={(e) => aktivitaet.leseliste(id, e.target.checked)} />
                          </td>
                        )}
                      </>
                    );
                    return hub ? (
                    <tr key={id}>
                      {auswahlZelle}
                      <td className="dat-spalte-typ" aria-hidden>
                        <span className="dat-typ"><Icon name={MATERIAL_ARTEN[hub.art].icon} groesse={14} /></span>
                      </td>
                      <td className="dat-spalte-name">
                        <div className="dat-name-zeile">
                          <Link className="dat-name-knopf" href={materialPfad(hub)} prefetch={false} {...druck(id)} onNavigate={() => aktivitaet.oeffnen(id)}>{eintrag.titel}</Link>
                          {!leselisteOffen && istPin(id) && <span className="muted" role="img" aria-label="Angepinnt" title="Angepinnt"><Icon name="anheften" groesse={14} /></span>}
                          {zuletztHinweis}
                        </div>
                      </td>
                      <td className="dat-spalte-groesse" />
                      <td className="dat-spalte-material">{MATERIAL_ARTEN[hub.art].name}</td>
                      <td className="dat-spalte-aktion"><DreiPunkteMenue punkte={privateAktionen(eintrag)} /></td>
                    </tr>
                  ) : d && (
                    <tr
                      key={d.id}
                      data-datei={d.id}
                      draggable={umbenennenId !== d.id}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_TYP, d.id);
                        e.dataTransfer.effectAllowed = "move";
                        ziehbildSetzen(e, d.name);
                      }}
                    >
                      {auswahlZelle}
                      <td className="dat-spalte-typ" aria-hidden>
                        <span className="dat-typ">
                          <Icon name={istWebLink(d) ? "link" : icon(d.name)} groesse={14} />
                        </span>
                      </td>
                      <td className="dat-spalte-name">
                        {umbenennenId === d.id ? (
                          <UmbenennenFeld
                            datei={d}
                            onFertig={(neu) => {
                              setUmbenennenId(null);
                              if (neu) setDateien((liste) => liste.map((x) => (x.id === neu.id ? neu : x)));
                            }}
                          />
                        ) : (
                          <>
                            <div className="dat-name-zeile">
                              <button type="button" className="dat-name-knopf" {...druck(id)} onClick={() => void oeffnen(d)}>
                                {eintrag.titel}
                              </button>
                              {!leselisteOffen && istPin(id) && <span className="muted" role="img" aria-label="Angepinnt" title="Angepinnt"><Icon name="anheften" groesse={14} /></span>}
                              {zuletztHinweis}
                            </div>
                            {letzteSeite !== undefined && (
                              <Link prefetch={false} className="dat-fortsetzen" href={pdfPfad(d.id)}>
                                Weiter auf Seite {letzteSeite}
                              </Link>
                            )}
                          </>
                        )}
                        {d.pdf_index_status === "wartet" && <span className="dat-index-hinweis">Inhalt wird für die Suche vorbereitet</span>}
                        {d.pdf_index_status === "fehler" && <span className="dat-index-hinweis">PDF-Text konnte nicht erfasst werden</span>}
                      </td>
                      <td className="dat-spalte-groesse mono">{groesseText(Number(d.groesse))}</td>
                      <td className="dat-spalte-material">{istWebLink(d) ? "Weblink" : endung(d.name).toUpperCase() || "Datei"}</td>
                      <td className="dat-spalte-aktion">
                        <DreiPunkteMenue
                          punkte={[
                            { label: "Öffnen", onClick: () => void oeffnen(d) },
                            ...privateAktionen(eintrag),
                            { label: "Umbenennen", onClick: () => setUmbenennenId(d.id) },
                            { label: "Verschieben nach …", onClick: () => setVerschiebenId(d.id) },
                            ...(!istWebLink(d) ? [{ label: "Herunterladen", onClick: () => void herunterladen(d) }] : []),
                            ...(!workflow && eigenes(eintrag) ? [{ label: "Endgültig löschen", onClick: () => void loeschen(d), gefahr: true }] : []),
                          ]}
                        />
                        {verschiebenId === d.id && (
                          <div className="drei-punkte-menue dat-verschieben" role="menu" aria-label="Verschieben nach">
                            <span className="dat-verschieben-titel">Verschieben nach</span>
                            {ordner
                              .filter((o) => o.id !== (d.fach_id ?? null))
                              .map((o) => (
                                <button key={o.id ?? "allgemein"} type="button" role="menuitem" onClick={() => void verschieben(d, o.id)}>
                                  <OrdnerZeichen ordner={o} /> {o.name}
                                </button>
                              ))}
                            <button type="button" role="menuitem" onClick={() => setVerschiebenId(null)}>
                              Abbrechen
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
          {ziehenUeber && <div className="dat-ablegen-hinweis">Hier ablegen</div>}
        </section>
      </div>

      {themenOffen && aktuellerOrdner.id && <ThemenDialog
        fachId={aktuellerOrdner.id} themen={fachThemen}
        auswahl={ausgewaehlt.map((e) => ({ ...ref(e), titel: e.titel }))}
        offen={eintraege.filter((e) => !themaVon(e)).map((e) => ({ ...ref(e), titel: e.titel }))}
        titelFuer={(r) => nachId.get(`${r.art}:${r.id}`)?.titel} ki={ki} schliessen={() => setThemenOffen(false)}
      />}
      {paketOffen && <MaterialTeilen refs={ausgewaehlt.map(ref)} titel="" paket schliessen={() => setPaketOffen(false)} />}
      {aktionsEintrag && aktion && <Fragment key={aktion.id}>
        {(aktion.art === "titel" || aktion.art === "titel-vorschlag") && <TitelDialog
          material={ref(aktionsEintrag)} titel={aktionsEintrag.titel} schliessen={() => setAktion(null)} ki={ki} direkt={aktion.art === "titel-vorschlag"} />}
        {aktion.art === "faecher" && <MaterialFaecherDialog material={ref(aktionsEintrag)} schliessen={() => setAktion(null)} />}
        {aktion.art === "thema" && <UnterlageEinsortieren
          material={{ ...ref(aktionsEintrag), titel: aktionsEintrag.titel }}
          faecher={ordner.flatMap((o) => o.id ? [{ id: o.id, name: o.name }] : [])}
          themen={themen} startFach={aktuellerOrdner.id} schliessen={() => setAktion(null)}
        />}
        {aktion.art === "teilen" && <MaterialTeilen refs={[ref(aktionsEintrag)]} titel={aktionsEintrag.titel} schliessen={() => setAktion(null)} />}
        {aktion.art === "verknuepfen" && <MaterialRueckverweise material={ref(aktionsEintrag)} titel={aktionsEintrag.titel} schliessen={() => setAktion(null)} />}
        {aktion.art === "papierkorb" && <PapierkorbDialog material={ref(aktionsEintrag)} titel={aktionsEintrag.titel}
          faecher={ordner.filter((o) => o.id && liegtIn(aktionsEintrag, o.id)).map((o) => o.name)}
          schliessen={() => setAktion(null)} abgelegt={() => setAktion(null)} />}
      </Fragment>}
      {vorschauEintrag && (
        <MaterialVorschauFenster
          key={vorschauEintrag.id}
          id={vorschauEintrag.hub?.id ?? vorschauEintrag.datei?.id ?? ""}
          art={vorschauEintrag.hub?.art ?? "datei"}
          titel={vorschauEintrag.titel}
          schliessen={() => setMaterialVorschau(null)}
          oeffnen={() => eintragOeffnen(vorschauEintrag)}
        />
      )}
      {vorschau && <VorschauFenster vorschau={vorschau} onSchliessen={() => setVorschau(null)} />}
    </>
  );
}

/** Inline umbenennen; die Endung (.pdf …) bleibt erhalten. Auch im PDF Reader genutzt. */
export function UmbenennenFeld({ datei, onFertig }: { datei: Pick<Datei, "id" | "name">; onFertig: (neu: Datei | null) => void }) {
  const [wert, setWert] = useState(nameOhneEndung(datei.name));
  const [fehler, setFehler] = useState<string | null>(null);
  const fertig = useRef(false);
  const e = endung(datei.name);

  async function speichern() {
    if (fertig.current) return;
    if (!wert.trim()) {
      setFehler("Name darf nicht leer sein.");
      return;
    }
    if (wert.trim() === nameOhneEndung(datei.name)) {
      fertig.current = true;
      onFertig(null);
      return;
    }
    fertig.current = true;
    try {
      const neu = await dateiUmbenennen(datei.id, wert);
      track("datei_umbenannt");
      onFertig(neu);
    } catch (err) {
      fertig.current = false;
      setFehler(err instanceof Error ? err.message : "Umbenennen hat nicht geklappt.");
    }
  }

  return (
    <span className="dat-umbenennen">
      <input
        className="field"
        value={wert}
        autoFocus
        aria-label="Neuer Name"
        onChange={(ev) => {
          setWert(ev.target.value);
          setFehler(null);
        }}
        onFocus={(ev) => ev.target.select()}
        onKeyDown={(ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            void speichern();
          } else if (ev.key === "Escape") {
            fertig.current = true;
            onFertig(null);
          }
        }}
      />
      {e && <span className="muted">.{e}</span>}
      {fehler && <span className="dat-upload-fehler">{fehler}</span>}
    </span>
  );
}

function VorschauFenster({ vorschau, onSchliessen }: { vorschau: Vorschau; onSchliessen: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dat-vorschau"
      onCancel={(e) => {
        e.preventDefault();
        onSchliessen();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSchliessen();
      }}
    >
      <div className="dat-vorschau-kopf">
        <h2 className="dat-vorschau-titel">{vorschau.name}</h2>
        <button type="button" className="knopf leise klein nur-symbol" aria-label="Schließen" onClick={onSchliessen}>
          <Icon name="schliessen" groesse={16} />
        </button>
      </div>
      {vorschau.art === "bild" ? (
        // eslint-disable-next-line @next/next/no-img-element -- signierte Storage-URL, keine Optimierung nötig
        <img src={vorschau.url} alt={vorschau.name} />
      ) : (
        <>
          <audio src={vorschau.url} controls autoFocus />
          <Link href={`/transkription?datei=${vorschau.id}`} className="knopf neben dat-transkribieren">
            <Icon name="mikrofon" groesse={16} />
            Transkribieren
          </Link>
        </>
      )}
    </dialog>
  );
}
