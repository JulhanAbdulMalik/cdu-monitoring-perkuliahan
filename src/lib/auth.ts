// src/lib/auth.ts
// NextAuth.js v5 — full config dengan Credentials provider
// Gunakan ini di server components dan API routes (BUKAN middleware)

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";

const loginSchema = z.object({
  email: z.string().min(1, "Email atau username harus diisi"),
  password: z.string().min(1, "Password harus diisi"),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email / Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email: rawInput, password } = parsed.data;
        const normalized = rawInput.trim();
        const emailWithDomain = normalized.includes("@")
          ? normalized.toLowerCase()
          : `${normalized.toLowerCase()}@nusaputra.ac.id`;

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: emailWithDomain, mode: "insensitive" } },
              { email: { equals: normalized, mode: "insensitive" } },
            ],
          },
          include: {
            prodis: {
              select: { id: true },
            },
          },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          prodiIds: user.prodis.map((p) => p.id),
        };
      },
    }),
  ],
});
