"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// MM-06 / WB-05: Mausrad = Zoom, Ziehen auf leerer Fläche = Ansicht verschieben.
export type Ansicht = { x: number; y: number; zoom: number };

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 3;

export function useAnsicht(start: Ansicht = { x: 0, y: 0, zoom: 1 }) {
  const [ansicht, setAnsicht] = useState(start);
  const flaeche = useRef<HTMLDivElement>(null);
  const ziehen = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  // Wheel muss "passive: false" sein, damit preventDefault das Seiten-Scrollen verhindert.
  useEffect(() => {
    const el = flaeche.current;
    if (!el) return;
    const rad = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      setAnsicht((a) => {
        const faktor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, a.zoom * faktor));
        // Punkt unter der Maus bleibt stehen
        return { zoom, x: mx - ((mx - a.x) * zoom) / a.zoom, y: my - ((my - a.y) * zoom) / a.zoom };
      });
    };
    el.addEventListener("wheel", rad, { passive: false });
    return () => el.removeEventListener("wheel", rad);
  }, []);

  /** Bildschirm- in Zeichenflächen-Koordinaten. */
  const welt = useCallback(
    (clientX: number, clientY: number) => {
      const r = flaeche.current?.getBoundingClientRect();
      return { x: (clientX - (r?.left ?? 0) - ansicht.x) / ansicht.zoom, y: (clientY - (r?.top ?? 0) - ansicht.y) / ansicht.zoom };
    },
    [ansicht],
  );

  const panStart = useCallback(
    (e: React.PointerEvent) => {
      ziehen.current = { px: e.clientX, py: e.clientY, x: ansicht.x, y: ansicht.y };
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    },
    [ansicht],
  );

  const panBewegen = useCallback((e: React.PointerEvent) => {
    const z = ziehen.current;
    if (!z) return false;
    setAnsicht((a) => ({ ...a, x: z.x + e.clientX - z.px, y: z.y + e.clientY - z.py }));
    return true;
  }, []);

  const panEnde = useCallback(() => {
    const war = ziehen.current !== null;
    ziehen.current = null;
    return war;
  }, []);

  /** Bereich (Weltkoordinaten) mittig einpassen. */
  const einpassen = useCallback((b: { x1: number; y1: number; x2: number; y2: number }, maxZoom = 1) => {
    const el = flaeche.current;
    if (!el) return;
    const w = Math.max(1, b.x2 - b.x1);
    const h = Math.max(1, b.y2 - b.y1);
    const zoom = Math.min(maxZoom, Math.max(MIN_ZOOM, Math.min((el.clientWidth - 80) / w, (el.clientHeight - 80) / h)));
    setAnsicht({ zoom, x: el.clientWidth / 2 - ((b.x1 + b.x2) / 2) * zoom, y: el.clientHeight / 2 - ((b.y1 + b.y2) / 2) * zoom });
  }, []);

  const zoomen = useCallback((faktor: number) => {
    const el = flaeche.current;
    const mx = (el?.clientWidth ?? 0) / 2;
    const my = (el?.clientHeight ?? 0) / 2;
    setAnsicht((a) => {
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, a.zoom * faktor));
      return { zoom, x: mx - ((mx - a.x) * zoom) / a.zoom, y: my - ((my - a.y) * zoom) / a.zoom };
    });
  }, []);

  return { ansicht, setAnsicht, flaeche, welt, panStart, panBewegen, panEnde, einpassen, zoomen };
}

async function alsDataUrl(src: string): Promise<string | null> {
  try {
    const antwort = await fetch(src);
    if (!antwort.ok) return null;
    const blob = await antwort.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * MM-08 / WB-06: Inhalt einer SVG-Gruppe als PNG. Elemente mit class="ui" werden weggelassen,
 * Bilder als Data-URL eingebettet. Alle Darstellungsattribute müssen inline am SVG stehen.
 */
export async function svgAlsPng(
  inhalt: SVGGElement,
  b: { x1: number; y1: number; x2: number; y2: number },
  hintergrund = "#ffffff",
  aufloesung = 2,
): Promise<Blob> {
  const rand = 40;
  const x = b.x1 - rand;
  const y = b.y1 - rand;
  const w = Math.max(1, b.x2 - b.x1 + 2 * rand);
  const h = Math.max(1, b.y2 - b.y1 + 2 * rand);
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("xmlns", ns);
  svg.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  const bg = document.createElementNS(ns, "rect");
  bg.setAttribute("x", String(x));
  bg.setAttribute("y", String(y));
  bg.setAttribute("width", String(w));
  bg.setAttribute("height", String(h));
  bg.setAttribute("fill", hintergrund);
  svg.appendChild(bg);
  const kopie = inhalt.cloneNode(true) as SVGGElement;
  kopie.removeAttribute("transform");
  kopie.querySelectorAll(".ui, foreignObject").forEach((n) => n.remove());
  for (const bild of Array.from(kopie.querySelectorAll("image"))) {
    const src = bild.getAttribute("href");
    const data = src ? await alsDataUrl(src) : null;
    if (data) bild.setAttribute("href", data);
    else bild.remove();
  }
  svg.appendChild(kopie);
  const text = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG konnte nicht gerendert werden"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    const faktor = Math.min(aufloesung, 8000 / Math.max(w, h));
    canvas.width = Math.round(w * faktor);
    canvas.height = Math.round(h * faktor);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas nicht verfügbar");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG fehlgeschlagen"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

let messKontext: CanvasRenderingContext2D | null = null;

/** Textbreite für Knoten/Text-Elemente (ohne DOM-Layout). */
export function textBreite(text: string, schrift: string): number {
  if (typeof document === "undefined") return text.length * 8;
  messKontext ??= document.createElement("canvas").getContext("2d");
  if (!messKontext) return text.length * 8;
  messKontext.font = schrift;
  return messKontext.measureText(text).width;
}

const keinAbo = () => () => {};

/** true erst im Browser – für Inhalte, die Textmaße brauchen (sonst weichen Server- und Client-HTML ab). */
export function useImBrowser(): boolean {
  return useSyncExternalStore(keinAbo, () => true, () => false);
}
