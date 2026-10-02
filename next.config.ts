import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep hot-reload chunks separate from production builds. A build can then
  // run without replacing modules loaded by an open development browser tab.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  async rewrites() {
    const backendOrigin = process.env.BACKEND_ORIGIN ??
      (process.env.BACKEND_EXTERNAL_HOSTNAME
        ? `https://${process.env.BACKEND_EXTERNAL_HOSTNAME}`
        : undefined);

    if (!backendOrigin) return [];

    return [
      { source: "/health", destination: `${backendOrigin}/health` },
      { source: "/api/v1/:path*", destination: `${backendOrigin}/api/v1/:path*` },
    ];
  },
};

export default nextConfig;
