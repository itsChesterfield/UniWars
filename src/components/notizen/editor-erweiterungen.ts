/**
 * Erweiterungen für den Notiz-Editor (Word-artige Formatierungen, Obsidian-artige Links).
 *
 * Gespeichert wird weiterhin Markdown. Was Markdown nicht kennt (Farbe, Schriftgröße,
 * Ausrichtung, hoch-/tiefgestellt), landet als kleiner HTML-Schnipsel im Markdown –
 * so wie Obsidian das auch liest – und wird beim Öffnen wieder zur Formatierung.
 */
import { Extension, InputRule, Node, mergeAttributes, type Editor, type MarkdownToken } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import Paragraph from "@tiptap/extension-paragraph";
import Heading from "@tiptap/extension-heading";
import Blockquote from "@tiptap/extension-blockquote";
import { TextStyle, Color, BackgroundColor, FontSize, FontFamily } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import { Mathematics } from "@tiptap/extension-mathematics";
import { DOMSerializer, type DOMOutputSpec } from "@tiptap/pm/model";
import { zielZerlegen, istPdfName } from "@/lib/notizen/wikilinks";
import { ICONS, symbolTeile, type IconName } from "@/lib/icons";

// ---------------------------------------------------------------------------
// Hilfen: Inline-HTML-Schnipsel im Markdown lesen (<tag …>Inhalt</tag>)
// ---------------------------------------------------------------------------

type Lexer = { inlineTokens: (src: string) => MarkdownToken[]; blockTokens: (src: string) => MarkdownToken[] };

/** Findet <tag attrs>…</tag> am Anfang von src (nicht verschachtelt). */
function htmlTagLesen(src: string, tag: string): { raw: string; attrs: string; inhalt: string } | null {
  const offen = new RegExp(`^<${tag}(\\s[^>]*)?>`, "i").exec(src);
  if (!offen) return null;
  const ende = src.toLowerCase().indexOf(`</${tag}>`, offen[0].length);
  if (ende === -1) return null;
  const inhalt = src.slice(offen[0].length, ende);
  if (!inhalt) return null;
  return { raw: src.slice(0, ende + tag.length + 3), attrs: offen[1] ?? "", inhalt };
}

function styleLesen(attrs: string): Record<string, string> {
  const style = /style="([^"]*)"/i.exec(attrs)?.[1] ?? "";
  const ergebnis: Record<string, string> = {};
  for (const teil of style.split(";")) {
    const [k, ...v] = teil.split(":");
    if (k && v.length) ergebnis[k.trim().toLowerCase()] = v.join(":").trim();
  }
  return ergebnis;
}

/** Nur harmlose Werte in style="" schreiben */
function sicher(wert: unknown): string | null {
  return typeof wert === "string" && /^[#(),.%\w\s'"-]{1,80}$/.test(wert) && !/url|expression/i.test(wert) ? wert : null;
}

// ---------------------------------------------------------------------------
// Schrift: Farbe, Hintergrund (Texthervorhebung), Größe, Schriftart → <span style>
// ---------------------------------------------------------------------------

const TextStyleMd = TextStyle.extend({
  markdownTokenName: "textStyleSpan",
  markdownTokenizer: {
    name: "textStyleSpan",
    level: "inline",
    start: (src: string) => src.toLowerCase().indexOf("<span"),
    tokenize(src: string, _tokens: MarkdownToken[], lexer: Lexer) {
      const t = htmlTagLesen(src, "span");
      if (!t) return undefined;
      return { type: "textStyleSpan", raw: t.raw, text: t.inhalt, attrs: t.attrs, tokens: lexer.inlineTokens(t.inhalt) };
    },
  },
  parseMarkdown(token, h) {
    const s = styleLesen(String(token.attrs ?? ""));
    return h.applyMark("textStyle", h.parseInline(token.tokens ?? []), {
      color: sicher(s.color),
      backgroundColor: sicher(s["background-color"]),
      fontSize: sicher(s["font-size"]),
      fontFamily: sicher(s["font-family"]),
    });
  },
  renderMarkdown(node, h) {
    const a = (node.attrs ?? {}) as Record<string, unknown>;
    const teile = [
      sicher(a.color) && `color: ${a.color}`,
      sicher(a.backgroundColor) && `background-color: ${a.backgroundColor}`,
      sicher(a.fontSize) && `font-size: ${a.fontSize}`,
      sicher(a.fontFamily) && `font-family: ${String(a.fontFamily).replace(/"/g, "'")}`,
    ].filter(Boolean);
    const inhalt = h.renderChildren(node);
    return teile.length ? `<span style="${teile.join("; ")}">${inhalt}</span>` : inhalt;
  },
});

/** <sub>/<sup> als Markdown-Schnipsel */
function hochTief<T extends typeof Subscript | typeof Superscript>(basis: T, tag: "sub" | "sup") {
  return basis.extend({
    markdownTokenName: `${tag}Html`,
    markdownTokenizer: {
      name: `${tag}Html`,
      level: "inline",
      start: (src: string) => src.toLowerCase().indexOf(`<${tag}>`),
      tokenize(src: string, _t: MarkdownToken[], lexer: Lexer) {
        const t = htmlTagLesen(src, tag);
        if (!t || t.attrs) return undefined;
        return { type: `${tag}Html`, raw: t.raw, text: t.inhalt, tokens: lexer.inlineTokens(t.inhalt) };
      },
    },
    parseMarkdown(token, h) {
      return h.applyMark(this.name, h.parseInline(token.tokens ?? []));
    },
    renderMarkdown(node, h) {
      return `<${tag}>${h.renderChildren(node)}</${tag}>`;
    },
  });
}

// ---------------------------------------------------------------------------
// Ausrichtung: <div data-align="center"> … </div> um Absätze/Überschriften
// ---------------------------------------------------------------------------

const AUSRICHTUNGEN = ["left", "center", "right", "justify"] as const;

function mitAusrichtung(inhalt: string, node: { attrs?: Record<string, unknown> }, ctx: { parentType?: string | null } | undefined) {
  const a = node.attrs?.textAlign;
  // Nur auf oberster Ebene – in Listen/Tabellen würde der Block die Struktur zerreißen
  if (!inhalt || typeof a !== "string" || a === "left" || !AUSRICHTUNGEN.includes(a as never)) return inhalt;
  if (ctx?.parentType && ctx.parentType !== "doc") return inhalt;
  return `<div data-align="${a}">\n\n${inhalt}\n\n</div>`;
}

const ParagraphMd = Paragraph.extend({
  renderMarkdown(node, h, ctx) {
    const basis = this.parent?.(node, h, ctx) ?? h.renderChildren(node.content ?? []);
    return mitAusrichtung(basis, node, ctx);
  },
});

const HeadingMd = Heading.extend({
  renderMarkdown(node, h, ctx) {
    const basis = this.parent?.(node, h, ctx) ?? "";
    return mitAusrichtung(basis, node, ctx);
  },
});

const Ausrichtungsblock = Extension.create({
  name: "ausrichtungsblock",
  markdownTokenName: "ausrichtung",
  markdownTokenizer: {
    name: "ausrichtung",
    level: "block",
    start: (src: string) => src.indexOf("<div data-align="),
    tokenize(src: string, _t: MarkdownToken[], lexer: Lexer) {
      const m = /^<div data-align="(left|center|right|justify)">\n+([\s\S]*?)\n+<\/div>[ \t]*(?:\n|$)/.exec(src);
      if (!m) return undefined;
      return { type: "ausrichtung", raw: m[0], align: m[1], tokens: lexer.blockTokens(m[2]) };
    },
  },
  parseMarkdown(token, h) {
    const kinder = h.parseChildren(token.tokens ?? []);
    return kinder.map((k) =>
      k.type === "paragraph" || k.type === "heading" ? { ...k, attrs: { ...(k.attrs ?? {}), textAlign: token.align } } : k,
    );
  },
});

// ---------------------------------------------------------------------------
// Callouts wie in Obsidian: > [!info] … (Info, Tipp, Merke, Warnung, Frage)
// ---------------------------------------------------------------------------

export const CALLOUTS = {
  info: { name: "Info", icon: "info" },
  tipp: { name: "Tipp", icon: "tipp" },
  merke: { name: "Merke", icon: "anheften" },
  warnung: { name: "Warnung", icon: "warnung" },
  frage: { name: "Frage", icon: "frage" },
} as const satisfies Record<string, { name: string; icon: IconName }>;

const SVG = "http://www.w3.org/2000/svg";
const SVG_ATTRIBUTE = { viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" };

/** Symbol aus dem eigenen Satz als ProseMirror-Ausgabe (Design B3, statt Emoji) */
function symbolSpec(name: IconName): DOMOutputSpec {
  const teile = symbolTeile(ICONS[name]).map((t): DOMOutputSpec =>
    t.art === "rect"
      ? [`${SVG} rect`, { x: String(t.x), y: String(t.y), width: String(t.b), height: String(t.h), rx: String(t.r) }]
      : t.art === "circle"
        ? [`${SVG} circle`, { cx: String(t.x), cy: String(t.y), r: String(t.r) }]
        : [`${SVG} path`, { d: t.d }],
  );
  return [`${SVG} svg`, SVG_ATTRIBUTE, ...teile];
}

/** dasselbe als DOM-Knoten (für Node-Views) */
function symbolKnoten(name: IconName): globalThis.Node {
  return DOMSerializer.renderSpec(document, symbolSpec(name)).dom;
}
export type CalloutTyp = keyof typeof CALLOUTS;

function calloutTyp(wert: string): CalloutTyp {
  const w = wert.toLowerCase();
  if (w in CALLOUTS) return w as CalloutTyp;
  if (["note", "abstract", "summary"].includes(w)) return "info";
  if (["tip", "hint", "success"].includes(w)) return "tipp";
  if (["important", "example"].includes(w)) return "merke";
  if (["warning", "caution", "danger", "attention", "bug", "failure"].includes(w)) return "warnung";
  if (["question", "help", "faq"].includes(w)) return "frage";
  return "info";
}

const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      typ: {
        default: "info",
        parseHTML: (el) => calloutTyp(el.getAttribute("data-callout") ?? "info"),
        renderHTML: (a) => ({ "data-callout": a.typ }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const info = CALLOUTS[calloutTyp(String(node.attrs.typ))];
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "md-callout" }),
      ["div", { class: "md-callout-titel", contenteditable: "false" }, symbolSpec(info.icon), info.name],
      ["div", { class: "md-callout-inhalt" }, 0],
    ];
  },
  renderMarkdown(node, h) {
    const kinder = (node.content ?? []).map((k: unknown, i: number) => h.renderChild?.(k as never, i) ?? h.renderChildren([k as never]));
    const zeilen = [`> [!${node.attrs?.typ ?? "info"}]`, ">"];
    kinder.forEach((k: string, i: number) => {
      if (i > 0) zeilen.push(">");
      for (const z of k.split("\n")) zeilen.push(z.trim() === "" ? ">" : `> ${z}`);
    });
    return zeilen.join("\n");
  },
  addCommands() {
    return {
      setCallout:
        (typ: CalloutTyp) =>
        ({ commands }) =>
          commands.wrapIn(this.name, { typ }),
      toggleCallout:
        (typ: CalloutTyp) =>
        ({ commands, editor }) =>
          editor.isActive(this.name) ? commands.lift(this.name) : commands.wrapIn(this.name, { typ }),
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (typ: CalloutTyp) => ReturnType;
      toggleCallout: (typ: CalloutTyp) => ReturnType;
    };
  }
}

/** Zitat-Block, der "> [!typ]" als Callout erkennt */
const BlockquoteMd = Blockquote.extend({
  parseMarkdown(token, h) {
    const kinder = (h.parseBlockChildren ?? h.parseChildren)(token.tokens ?? []);
    const erstes = kinder[0];
    const ersterText = erstes?.type === "paragraph" ? erstes.content?.[0] : undefined;
    const m = ersterText?.type === "text" ? /^\[!(\w+)\][^\S\n]*\n?/.exec(ersterText.text ?? "") : null;
    if (!m || !erstes) return h.createNode("blockquote", undefined, kinder);
    const rest = (ersterText!.text ?? "").slice(m[0].length);
    const ersterInhalt = [...(erstes.content ?? [])];
    if (rest.trim()) ersterInhalt[0] = { ...ersterText!, text: rest };
    else {
      ersterInhalt.shift();
      if (ersterInhalt[0]?.type === "hardBreak") ersterInhalt.shift();
    }
    const inhalt = ersterInhalt.length ? [{ ...erstes, content: ersterInhalt }, ...kinder.slice(1)] : kinder.slice(1);
    return h.createNode("callout", { typ: calloutTyp(m[1]) }, inhalt.length ? inhalt : [{ type: "paragraph" }]);
  },
});

// ---------------------------------------------------------------------------
// Verlinkungen [[Notiz]] / [[Skript.pdf#S12]] / [[Ziel|Anzeigetext]]
// ---------------------------------------------------------------------------

export type LinkAufloesung = { art: "notiz" | "pdf" | "fehlt" };

export type WikilinkOptionen = {
  /** Gibt es das Ziel? (für die Darstellung) */
  aufloesen: (ziel: string) => LinkAufloesung;
};

export const Wikilink = Node.create<WikilinkOptionen>({
  name: "wikilink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addOptions() {
    return { aufloesen: () => ({ art: "fehlt" }) };
  },
  addAttributes() {
    return {
      ziel: { default: "", parseHTML: (el) => el.getAttribute("data-ziel") ?? "" },
      label: { default: null, parseHTML: (el) => el.getAttribute("data-label") },
    };
  },
  parseHTML() {
    return [{ tag: "a[data-wikilink]" }];
  },
  renderHTML({ node }) {
    return ["a", { "data-wikilink": "", "data-ziel": node.attrs.ziel, "data-label": node.attrs.label ?? undefined }, node.attrs.label || node.attrs.ziel];
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("a");
      const ziel = String(node.attrs.ziel);
      const { name, seite } = zielZerlegen(ziel);
      const art = this.options.aufloesen(ziel).art;
      dom.setAttribute("data-wikilink", "");
      dom.setAttribute("data-ziel", ziel);
      dom.className = `md-wikilink md-wikilink-${art === "fehlt" ? (istPdfName(name) ? "pdf-fehlt" : "fehlt") : art}`;
      dom.title =
        art === "fehlt"
          ? istPdfName(name)
            ? "PDF nicht gefunden"
            : "Notiz gibt es noch nicht, Klick legt sie an"
          : `${art === "pdf" ? "PDF öffnen" : "Notiz öffnen"} (Strg/⌘+Klick: daneben)`;
      if (art === "pdf" || istPdfName(name)) dom.append(symbolKnoten("pdf"));
      dom.append(node.attrs.label || (seite ? `${name.replace(/\.pdf$/i, "")}, S. ${seite}` : name));
      return { dom };
    };
  },
  renderText({ node }) {
    return `[[${node.attrs.ziel}${node.attrs.label ? `|${node.attrs.label}` : ""}]]`;
  },
  markdownTokenName: "wikilink",
  markdownTokenizer: {
    name: "wikilink",
    level: "inline",
    start: (src: string) => src.indexOf("[["),
    tokenize(src: string) {
      const m = /^\[\[([^\]|\n]+?)(?:\|([^\]\n]+))?\]\]/.exec(src);
      if (!m) return undefined;
      return { type: "wikilink", raw: m[0], ziel: m[1].trim(), label: m[2]?.trim() ?? null };
    },
  },
  parseMarkdown(token, h) {
    return h.createNode("wikilink", { ziel: token.ziel, label: token.label ?? null });
  },
  renderMarkdown(node) {
    return `[[${node.attrs?.ziel ?? ""}${node.attrs?.label ? `|${node.attrs.label}` : ""}]]`;
  },
  addInputRules() {
    // [[Name]] tippen → Verlinkung
    return [
      new InputRule({
        find: /\[\[([^\]|\n]+?)(?:\|([^\]\n]+))?\]\]$/,
        handler: ({ state, range, match }) => {
          state.tr.replaceWith(range.from, range.to, this.type.create({ ziel: match[1].trim(), label: match[2]?.trim() ?? null }));
        },
      }),
    ];
  },
});

// ---------------------------------------------------------------------------
// Zusammenstellung
// ---------------------------------------------------------------------------

export type EditorOptionen = {
  platzhalter?: string;
  /** voller Notiz-Editor (sonst die schlanke Variante, z. B. für Karteikarten) */
  voll?: boolean;
  aufloesen?: WikilinkOptionen["aufloesen"];
  onFormelKlick?: (art: "inline" | "block", latex: string, pos: number) => void;
};

export function editorErweiterungen({ platzhalter, voll = false, aufloesen, onFormelKlick }: EditorOptionen) {
  const basis = [
    StarterKit.configure({
      heading: false,
      paragraph: false,
      blockquote: false,
      link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } },
      ...(voll ? {} : { horizontalRule: false, strike: false, underline: false }),
    }),
    ParagraphMd,
    HeadingMd.configure({ levels: voll ? [1, 2, 3, 4, 5, 6] : [1, 2, 3] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown,
    ...(platzhalter ? [Placeholder.configure({ placeholder: platzhalter })] : []),
  ];
  if (!voll) return basis;
  return [
    ...basis,
    BlockquoteMd,
    Callout,
    TextStyleMd,
    Color,
    BackgroundColor,
    FontSize,
    FontFamily,
    Highlight,
    hochTief(Subscript, "sub"),
    hochTief(Superscript, "sup"),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Ausrichtungsblock,
    TableKit.configure({ table: { resizable: false } }),
    Image.configure({ inline: false, allowBase64: false }),
    Mathematics.configure({
      inlineOptions: { onClick: (node, pos) => onFormelKlick?.("inline", String(node.attrs.latex ?? ""), pos) },
      blockOptions: { onClick: (node, pos) => onFormelKlick?.("block", String(node.attrs.latex ?? ""), pos) },
      katexOptions: { throwOnError: false },
    }),
    Wikilink.configure({ aufloesen: aufloesen ?? (() => ({ art: "fehlt" })) }),
  ];
}

/** Aktuelle Schriftgröße/-farbe usw. an der Cursorposition */
export function textStil(editor: Editor): Record<string, string | null> {
  return editor.getAttributes("textStyle") as Record<string, string | null>;
}
