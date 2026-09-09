import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server Actions sudah enabled by default di Next.js 14+
  // Konfigurasi tambahan untuk file upload besar
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // max upload file Excel
    },
  },
};

export default nextConfig;
