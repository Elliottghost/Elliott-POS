import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  devIndicators: false,
  allowedDevOrigins: [
    "pv-d4816698fa7c-52855518-6fbe-4d36-a0dc-4d6622967df2.style.dev",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
