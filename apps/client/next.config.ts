import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/db"],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "https://debt-proof-server1.onrender.com",
    API_URL: process.env.API_URL || "https://debt-proof-server1.onrender.com",
  },
};

export default nextConfig;
