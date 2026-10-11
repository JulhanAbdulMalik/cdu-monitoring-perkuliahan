// src/lib/prisma.ts
// Prisma Client singleton untuk Next.js dengan self-healing dynamic reload di development

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getPrismaInstance(): PrismaClient {
  const current = globalForPrisma.prisma;
  if (current && (current as any).notification) {
    return current;
  }

  // Jika di development dan model notification belum terdeteksi (karena module ter-cache sebelum prisma generate),
  // lakukan cache-busting native require untuk memuat build terbaru dari disk
  if (process.env.NODE_ENV === "development" && typeof eval !== "undefined") {
    try {
      const nativeRequire = eval("require");
      if (nativeRequire && nativeRequire.cache) {
        Object.keys(nativeRequire.cache).forEach((key) => {
          if (key.includes(".prisma") || key.includes("@prisma")) {
            delete nativeRequire.cache[key];
          }
        });
        const freshModule = nativeRequire("@prisma/client");
        if (freshModule && freshModule.PrismaClient) {
          const freshClient = new freshModule.PrismaClient({
            log: ["query", "error", "warn"],
          });
          if ((freshClient as any).notification) {
            globalForPrisma.prisma = freshClient;
            return freshClient;
          }
        }
      }
    } catch {
      // fallback jika native require tidak tersedia
    }
  }

  const fallbackClient =
    current ??
    new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });

  globalForPrisma.prisma = fallbackClient;
  return fallbackClient;
}

// Export sebagai Proxy agar selalu mengakses instance Prisma teranyar yang memiliki seluruh model
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const instance = getPrismaInstance();
    const val = (instance as any)[prop];
    if (typeof val === "function") {
      return val.bind(instance);
    }
    return val;
  },
});
