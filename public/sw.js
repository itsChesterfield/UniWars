// UniVerse: Service Worker nur für den Offline-Hinweis (Didi, 20.11.).
// Er speichert genau eine Seite (offline.html) und zeigt sie, wenn eine Seite ohne Netz nicht lädt.
// Daten werden nicht zwischengespeichert, damit nie veraltete Stände erscheinen.
const CACHE = "universe-offline-1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(new Request(OFFLINE, { cache: "reload" }))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const namen = await caches.keys();
      await Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      // Seitenaufrufe laufen parallel zum Start des Workers, damit nichts langsamer wird
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    (async () => {
      try {
        const vorgeladen = await event.preloadResponse;
        if (vorgeladen) return vorgeladen;
        return await fetch(event.request);
      } catch {
        return (await caches.match(OFFLINE)) ?? Response.error();
      }
    })(),
  );
});
