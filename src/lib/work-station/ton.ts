"use client";

// Kurzer Dreiklang über Web Audio – keine Audiodatei nötig.
export function signalton() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.22, 0.44].forEach((versatz, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = [660, 880, 990][i];
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + versatz);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + versatz + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + versatz + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + versatz);
      osc.stop(ctx.currentTime + versatz + 0.22);
    });
    window.setTimeout(() => ctx.close().catch(() => undefined), 1200);
  } catch {
    // Kein Audio verfügbar – dann eben still.
  }
}

export function benachrichtigen(titel: string, text: string) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    new Notification(titel, { body: text, icon: "/favicon.ico", tag: "uniwars-work-station" });
  } catch {
    // Manche Browser erlauben Notification nur über einen Service Worker.
  }
}

export function benachrichtigungErfragen() {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  } catch {
    // ignorieren
  }
}
