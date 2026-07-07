import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
  generateBuildId: () => Date.now().toString(36),
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
