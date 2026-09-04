import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
