// src/middleware.ts
// Proteksi route — Edge-safe menggunakan getToken dari next-auth/jwt
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const secret =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "cdu-monitoring-nusa-putra-secret-key-2026-change-in-production";

export default async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const isLoginPage = nextUrl.pathname === "/login";
  const isApiAuth = nextUrl.pathname.startsWith("/api/auth");

  // Biarkan API auth route lewat
  if (isApiAuth) return NextResponse.next();

  // Ambil session token langsung dari cookies (cek secure cookie untuk production, fallback non-secure)
  let token = await getToken({ req, secret, secureCookie: true });
  if (!token) {
    token = await getToken({ req, secret, secureCookie: false });
  }

  const isLoggedIn = !!token;

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

  // ── Route Protections Berdasarkan Role ─────────────────────────────
  if (isLoggedIn && token) {
    const userRole = token.role as string | undefined;

    // Data Master & Kelola Akun: Khusus SUPER_ADMIN
    if (
      (nextUrl.pathname.startsWith("/master") || nextUrl.pathname.startsWith("/kelola-akun")) &&
      userRole !== "SUPER_ADMIN"
    ) {
      return NextResponse.redirect(new URL("/", nextUrl));
    }

    // Monitoring: Khusus SUPER_ADMIN & ADMIN (DOSEN dilarang)
    if (nextUrl.pathname.startsWith("/monitoring") && userRole === "DOSEN") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|public/).*)"],
};
