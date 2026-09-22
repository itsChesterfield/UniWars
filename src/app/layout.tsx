import type { Metadata } from "next";
import { Libre_Caslon_Display, Public_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const librecaslon = Libre_Caslon_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
});

const publicSans = Public_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "UniWars",
  description: "Study Platform — Main Hub",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${librecaslon.variable} ${publicSans.variable} ${spaceMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
