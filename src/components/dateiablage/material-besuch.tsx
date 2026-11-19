"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { materialVomPfad } from "@/lib/dateiablage/material";
import { materialGeoeffnet } from "@/lib/dateiablage/material-aktivitaet";

export function MaterialBesuch({ userId }: { userId: string }) {
  const pfad = usePathname();
  const suche = useSearchParams();
  const id = materialVomPfad(pfad, suche);

  useEffect(() => {
    if (id) materialGeoeffnet(userId, id);
  }, [id, userId]);
  return null;
}
