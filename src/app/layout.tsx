import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { AnalyticsBanner } from "@/components/analytics-banner";
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
  title: "UniWars",
  description: "Study Platform — Main Hub",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={`${schrift.variable} ${zahlen.variable}`}
    >
      <body>
        {/* Vor dem ersten Zeichnen: zweiter Hub der geteilten Ansicht ohne Sidebar, eingeklappte Sidebar */}
        <Script id="geteilte-ansicht" strategy="beforeInteractive">
          {`if (window.name === ${JSON.stringify(FRAME_NAME)}) document.documentElement.setAttribute("data-eingebettet", "");
try { if (localStorage.getItem("uniwars-sidebar-eingeklappt") === "1") document.documentElement.setAttribute("data-sidebar-eingeklappt", ""); } catch (e) {}
try { if (localStorage.getItem("uniwars-symbolleiste-offen") === "1") document.documentElement.setAttribute("data-rail-offen", ""); } catch (e) {}`}
        </Script>
        {children}
        <AnalyticsBanner />
      </body>
    </html>
  );
}
