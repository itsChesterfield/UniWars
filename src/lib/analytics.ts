import posthog from "posthog-js";

type Nutzer = { id: string; username: string };

let aktuellerNutzer: Nutzer | null = null;

export type Einwilligung = "granted" | "denied" | "pending";

export function einwilligungsStatus(): Einwilligung {
  return posthog.get_explicit_consent_status();
}

// reset() setzt auch die Einwilligung zurück; danach muss sie wiederhergestellt werden.
function zuruecksetzenMitEinwilligung() {
  const status = posthog.get_explicit_consent_status();
  posthog.reset();
  if (status === "granted") posthog.opt_in_capturing({ captureEventName: false });
  else if (status === "denied") posthog.opt_out_capturing();
}

function identifizieren(nutzer: Nutzer) {
  if (posthog.get_explicit_consent_status() !== "granted") return;
  const schonIdentifiziert = posthog.get_property("$user_state") === "identified";
  if (schonIdentifiziert && posthog.get_distinct_id() === nutzer.id) return;
  if (schonIdentifiziert) zuruecksetzenMitEinwilligung();
  posthog.identify(nutzer.id, { username: nutzer.username });
}

export function nutzerSetzen(nutzer: Nutzer) {
  aktuellerNutzer = nutzer;
  identifizieren(nutzer);
}

export function einwilligen() {
  posthog.opt_in_capturing();
  if (aktuellerNutzer) identifizieren(aktuellerNutzer);
}

export function ablehnen() {
  posthog.opt_out_capturing();
}

export function abmelden() {
  track("abgemeldet");
  aktuellerNutzer = null;
  zuruecksetzenMitEinwilligung();
}

export function track(event: string, properties?: Record<string, unknown>) {
  posthog.capture(event, properties);
}

export function fehlerMelden(error: unknown, properties?: Record<string, unknown>) {
  posthog.captureException(error, properties);
}
