import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Stundenplan-Foto: das (im Browser verkleinerte) Bild geht als Data-URL an die Server Action
    serverActions: { bodySizeLimit: "4mb" },
    // Gerade besuchte Bereiche 30 s im Browser behalten: Hin- und Herwechseln ohne neuen Server-Aufruf.
    // Änderungen (Server Actions mit revalidatePath, router.refresh) leeren diesen Speicher wie bisher.
    staleTimes: { dynamic: 30 },
  },
  // Service Worker der installierbaren App: nie aus dem Zwischenspeicher, damit Änderungen sofort ankommen
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
