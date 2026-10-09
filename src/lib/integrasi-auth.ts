// src/lib/integrasi-auth.ts
// Autentikasi API integrasi (machine-to-machine) untuk worker sinkronisasi Edlink.
//
// Konfigurasi env:
//   INTEGRASI_API_KEYS="key1,key2"   → daftar API key yang valid (pisahkan koma, min. 32 karakter)
// Jika env kosong, seluruh endpoint /api/integrasi/* dinonaktifkan (503).
//
// Pemakaian dari client:
//   Authorization: Bearer <api-key>

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "crypto";

function getKeys(): string[] {
  return (process.env.INTEGRASI_API_KEYS || "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length >= 32);
}

function safeEqual(a: string, b: string): boolean {
  // Bandingkan hash supaya panjang sama & waktu konstan
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Mengembalikan NextResponse error bila request tidak sah, atau null bila sah.
 */
export function checkIntegrasiAuth(req: NextRequest): NextResponse | null {
  const keys = getKeys();
  if (keys.length === 0) {
    return NextResponse.json(
      { error: "API integrasi tidak aktif (INTEGRASI_API_KEYS belum diset)" },
      { status: 503 }
    );
  }

  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() || "";
  if (!token || !keys.some((k) => safeEqual(k, token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...(extra || {}) }, { status });
}
