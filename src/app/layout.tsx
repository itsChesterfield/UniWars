import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AnalyticsBanner } from "@/components/analytics-banner";

// Eine schlichte Schrift für alles – Überschriften nutzen sie über --font-display (globals.css)
const schrift = Inter({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
});

const zahlen = JetBrains_Mono({
  variable: "--font-mono",
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
      className={`${schrift.variable} ${zahlen.variable}`}
    >
      <body>
        {children}
        <AnalyticsBanner />
      </body>
    </html>
  );
}
