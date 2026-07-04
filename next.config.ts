import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // 開発サーバーに LAN の IP でアクセスすると Next.js 16 は JS/HMR を遮断するため、
  // 利用するオリジンをここで許可する
  allowedDevOrigins: ["192.168.68.108"],
};

export default nextConfig;
