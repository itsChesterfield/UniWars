import type { MetadataRoute } from "next";

/**
 * Installierbare App (Didi, 20.11.): Symbol im Design Sternenhimmel. Farben stehen hier als feste Werte,
 * weil das Manifest keine CSS-Variablen kennt; sie entsprechen `--grund` im Design Sternenhimmel (DESIGN.md Abschnitt 2).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "UniVerse",
    short_name: "UniVerse",
    description: "Dein Studium an einem Ort. Aufgaben, Unterlagen und Lernen, ruhig geordnet.",
    lang: "de",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#08090b",
    theme_color: "#08090b",
    icons: [
      { src: "/app/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
