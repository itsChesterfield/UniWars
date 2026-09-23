"use client";

import { useEffect } from "react";
import { nutzerSetzen } from "@/lib/analytics";

export function AnalyticsNutzer({ userId, username }: { userId: string; username: string }) {
  useEffect(() => {
    nutzerSetzen({ id: userId, username });
  }, [userId, username]);
  return null;
}
