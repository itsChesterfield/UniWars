"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

export function TrackEvent({
  event,
  properties,
}: {
  event: string;
  properties?: Record<string, unknown>;
}) {
  const propsJson = JSON.stringify(properties ?? {});
  useEffect(() => {
    track(event, JSON.parse(propsJson));
  }, [event, propsJson]);
  return null;
}
