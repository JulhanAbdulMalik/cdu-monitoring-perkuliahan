// src/app/api/integrasi/cek/[id]/selesai/route.ts
// POST /api/integrasi/cek/{id}/selesai  (auth: Bearer INTEGRASI_API_KEYS)
// Worker melaporkan hasil satu permintaan "Cek dari Edlink".
//
// Body: { "status": "SELESAI" | "GAGAL", "hasil"?: {...ringkasan respons /api/integrasi/sesi}, "error"?: "..." }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkIntegrasiAuth, jsonError } from "@/lib/integrasi-auth";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = checkIntegrasiAuth(req);
  if (denied) return denied;

  const { id } = await ctx.params;

  let body: { status?: unknown; hasil?: unknown; error?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError("Body harus JSON");
  }

  const status = body?.status === "SELESAI" ? "SELESAI" : body?.status === "GAGAL" ? "GAGAL" : null;
  if (!status) return jsonError('status wajib "SELESAI" atau "GAGAL"');

  let hasil: Prisma.InputJsonValue | undefined;
  if (body?.hasil && typeof body.hasil === "object") {
    if (JSON.stringify(body.hasil).length > 200_000) return jsonError("hasil terlalu besar (maks 200 KB)", 413);
    hasil = body.hasil as Prisma.InputJsonValue;
  }
  const error = typeof body?.error === "string" ? body.error.slice(0, 1000) : null;

  const r = await prisma.edlinkCekRequest.updateMany({
    where: { id, status: { in: ["PENDING", "PROSES"] } },
    data: { status, hasil, error, selesaiAt: new Date() },
  });
  if (r.count === 0) return jsonError("Permintaan tidak ditemukan atau sudah selesai", 404);

  return NextResponse.json({ ok: true, id, status });
}
