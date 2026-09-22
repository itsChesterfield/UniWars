"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DetailZielTyp } from "@/app/aufgaben-detail/actions";

export function useAufgabenDetail() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function oeffne(zielTyp: DetailZielTyp, zielId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("detail", `${zielTyp}:${zielId}`);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function schliesse() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("detail");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return { oeffne, schliesse };
}
