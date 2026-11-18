import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/rollen";

/**
 * Paket 1 (Plan 1.4): Der Admin-Bereich ist nur für Admins erreichbar.
 * Jede page.tsx unter /admin ruft requireAdmin() selbst auf, weil ein Layout
 * bei Navigation innerhalb der App nicht neu ausgeführt wird.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return children;
}
