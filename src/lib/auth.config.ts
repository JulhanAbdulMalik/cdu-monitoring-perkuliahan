// src/lib/auth.config.ts
// Auth config yang AMAN untuk Edge Runtime (middleware)
// TIDAK boleh import Node.js-specific modules seperti bcryptjs atau Prisma

import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  secret:
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "cdu-monitoring-nusa-putra-secret-key-2026-change-in-production",
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/login";
      const isApiAuth = nextUrl.pathname.startsWith("/api/auth");

      if (isApiAuth) return true;
      if (isLoginPage) return true; // biarkan auth page diakses
      return isLoggedIn; // protect semua halaman lain
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.prodiIds = (user as { prodiIds?: string[] }).prodiIds || [];
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.prodiIds = (token.prodiIds as string[]) || [];
      }
      return session;
    },
  },
  providers: [], // Providers ditambahkan di auth.ts (bukan edge)
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
};
