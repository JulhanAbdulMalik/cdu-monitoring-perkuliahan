// src/lib/prisma.ts
// Prisma Client singleton untuk Next.js (mencegah multiple instances di development)

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const cachedPrisma = globalForPrisma.prisma;
// Re-instantiate jika client di cache belum memiliki model notification (misal setelah generate baru)
const shouldCreateNew = !cachedPrisma || !(cachedPrisma as any).notification;

export const prisma = shouldCreateNew
  ? new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    })
  : cachedPrisma;

// Simpan di globalThis baik di dev (mencegah leak HMR) maupun di production serverless (reuse connection pool)
globalForPrisma.prisma = prisma;

