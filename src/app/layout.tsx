import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { AnalyticsBanner } from "@/components/analytics-banner";
import { ServiceWorkerAnmelden } from "@/components/service-worker-anmelden";
import { FRAME_NAME } from "@/lib/geteilte-ansicht";

// Design B3 (DESIGN.md Abschnitt 3): Bricolage Grotesque für alles,
// JetBrains Mono nur für Zahlen und Zeiten (--font-mono in globals.css).
const schrift = Bricolage_Grotesque({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
});

const zahlen = JetBrains_Mono({
  variable: "--font-zahl",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "UniVerse",
  description: "UniVerse: dein Studium an einem Ort. Aufgaben, Unterlagen und Lernen, ruhig geordnet.",
  // Installierbare App: auf dem iPhone ohne Browserleiste starten (Manifest in app/manifest.ts, Symbol in app/apple-icon.png)
  appleWebApp: { capable: true, title: "UniVerse", statusBarStyle: "default" },
};

// Farbe der Statusleiste vor dem ersten Zeichnen: `--grund` beider Designs (DESIGN.md Abschnitt 2); danach setzt DesignRahmen das gewählte Design
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ecece9" },
    { media: "(prefers-color-scheme: dark)", color: "#08090b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      data-erscheinen="kaesten"
      suppressHydrationWarning
      className={`${schrift.variable} ${zahlen.variable}`}
    >
      <body>
        {/* Vor dem ersten Zeichnen: zweiter Hub der geteilten Ansicht ohne Sidebar, eingeklappte Sidebar.
            data-erscheinen="kaesten": nach dem Neuladen kommen die Kästen nacheinander (nur CSS), danach nie wieder. */}
        <Script id="geteilte-ansicht" strategy="beforeInteractive">
          {`if (window.name === ${JSON.stringify(FRAME_NAME)}) document.documentElement.setAttribute("data-eingebettet", "");
try { if (localStorage.getItem("uniwars-sidebar-eingeklappt") === "1") document.documentElement.setAttribute("data-sidebar-eingeklappt", ""); } catch (e) {}
setTimeout(function () { if (document.documentElement.getAttribute("data-erscheinen") === "kaesten") document.documentElement.removeAttribute("data-erscheinen"); }, 900);`}
        </Script>
        {children}
        <AnalyticsBanner />
        <ServiceWorkerAnmelden />
      </body>
    </html>
  );
}
