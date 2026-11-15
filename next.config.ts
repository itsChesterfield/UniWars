import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Stundenplan-Foto: das (im Browser verkleinerte) Bild geht als Data-URL an die Server Action
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
