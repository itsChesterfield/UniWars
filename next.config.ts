import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Stundenplan-Foto: das (im Browser verkleinerte) Bild geht als Data-URL an die Server Action
    serverActions: { bodySizeLimit: "4mb" },
    // Gerade besuchte Bereiche 30 s im Browser behalten: Hin- und Herwechseln ohne neuen Server-Aufruf.
    // Änderungen (Server Actions mit revalidatePath, router.refresh) leeren diesen Speicher wie bisher.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
