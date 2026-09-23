import posthog from "posthog-js";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
  defaults: "2025-05-24",
  // Ohne Einwilligung im Banner werden weder Events erfasst noch Cookies/Local Storage gesetzt.
  opt_out_capturing_by_default: true,
  opt_out_persistence_by_default: true,
  capture_exceptions: true,
  person_profiles: "identified_only",
});
