import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AnalyticsBanner } from "@/components/analytics-banner";

const ueberschrift = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
});

const fliesstext = Plus_Jakarta_Sans({
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
      className={`${ueberschrift.variable} ${fliesstext.variable} ${zahlen.variable}`}
    >
      <body>
        {children}
        <AnalyticsBanner />
      </body>
    </html>
  );
}
