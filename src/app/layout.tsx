import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { AnalyticsBanner } from "@/components/analytics-banner";
import { FRAME_NAME } from "@/lib/geteilte-ansicht";

// Eine schlichte Schrift für alles – Überschriften und Zahlen nutzen sie über
// --font-display / --font-mono (globals.css); nur Code bleibt Monospace.
const schrift = Inter({
  variable: "--font-body",
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
      className={`${schrift.variable}`}
    >
      <body>
        {/* Zweiter Hub der geteilten Ansicht: Sidebar & Co. vor dem ersten Zeichnen ausblenden */}
        <Script id="geteilte-ansicht" strategy="beforeInteractive">
          {`if (window.name === ${JSON.stringify(FRAME_NAME)}) document.documentElement.setAttribute("data-eingebettet", "");`}
        </Script>
        {children}
        <AnalyticsBanner />
      </body>
    </html>
  );
}
