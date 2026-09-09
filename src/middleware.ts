// src/middleware.ts
// Proteksi route — menggunakan auth.config.ts (Edge-safe, tanpa Node.js imports)

import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isLoginPage = nextUrl.pathname === "/login";
  const isApiAuth = nextUrl.pathname.startsWith("/api/auth");

  // Biarkan API auth route lewat
  if (isApiAuth) return NextResponse.next();

  // Redirect ke /login jika belum login
  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect ke / jika sudah login tapi coba akses /login
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
