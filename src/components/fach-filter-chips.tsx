"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { FachOption } from "@/lib/fach-option";

export function FachFilterChips({ faecher }: { faecher: FachOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const aktivFachId = searchParams.get("fachId");

  function setFilter(fachId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (fachId) {
      params.set("fachId", fachId);
    } else {
      params.delete("fachId");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  if (faecher.length === 0) return null;

  return (
    <div className="fach-filter-chips">
      <button
        type="button"
        className={`chip ${!aktivFachId ? "chip-active" : ""}`}
        onClick={() => setFilter(null)}
      >
        Alle
      </button>
      {faecher.map((f) => (
        <button
          key={f.id}
          type="button"
          className={`chip ${aktivFachId === f.id ? "chip-active" : ""}`}
          onClick={() => setFilter(f.id)}
        >
          <span
            className="dot"
            style={{ background: aktivFachId === f.id ? "#fff" : f.farbe ?? "#94a3b8" }}
            aria-hidden
          />
          {f.name}
        </button>
      ))}
    </div>
  );
}
