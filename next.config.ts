import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-hosted (local demo now, Hostinger later): plain Node server bundle.
  output: "standalone",
  cacheComponents: false,
  serverExternalPackages: ["pg", "exceljs", "@react-pdf/renderer"],
  experimental: {
    // Product photo uploads are capped at 4 MB in the app; leave room for multipart overhead.
    serverActions: { bodySizeLimit: "5mb" },
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
