// src/lib/prisma.ts
// Prisma Client singleton untuk Next.js (mencegah multiple instances di development)

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

// Simpan di globalThis baik di dev (mencegah leak HMR) maupun di production serverless (reuse connection pool)
globalForPrisma.prisma = prisma;

