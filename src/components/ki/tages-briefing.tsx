"use client";

import { tagesbriefing, type Briefing } from "@/app/(hubs)/assistent/briefing-actions";

let erstesBriefing: Promise<Briefing | null> | null = null;
/** Briefing einmal pro Seitenaufruf laden; alle Stellen im Hub teilen sich das Ergebnis */
export function briefingHolen(): Promise<Briefing | null> {
  erstesBriefing ??= tagesbriefing().catch(() => null);
  return erstesBriefing;
}
