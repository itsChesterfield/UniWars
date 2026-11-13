import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AnalyticsBanner } from "@/components/analytics-banner";

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
      className={`${schrift.variable}`}
    >
      <body>
        {children}
        <AnalyticsBanner />
      </body>
    </html>
  );
}
