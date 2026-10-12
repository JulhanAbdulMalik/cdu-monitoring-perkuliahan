// src/app/api/integrasi/cek/ambil/route.ts
// POST /api/integrasi/cek/ambil  (auth: Bearer INTEGRASI_API_KEYS)
// Worker edlink-sync mengambil (claim) antrian "Cek dari Edlink" secara atomik.
//
// Body (opsional): { "maks": 5 }
// Respons: { items: [{ id, kelasId, kodeKelas, edlinkGroupId }] }
//
// Permintaan PROSES yang macet > 10 menit (worker mati di tengah jalan) dikembalikan
// ke antrian; PENDING > 30 menit ditandai GAGAL agar UI tidak menunggu selamanya.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkIntegrasiAuth } from "@/lib/integrasi-auth";

export const dynamic = "force-dynamic";

const MACET_MS = 10 * 60 * 1000;
const KADALUARSA_MS = 30 * 60 * 1000;

export async function POST(req: NextRequest) {
  const denied = checkIntegrasiAuth(req);
  if (denied) return denied;

  let maks = 5;
  try {
    const body = (await req.json()) as { maks?: unknown };
    const n = Number(body?.maks);
    if (Number.isInteger(n) && n >= 1 && n <= 50) maks = n;
  } catch {
    /* body opsional */
  }

  const now = Date.now();
  await prisma.$transaction([
    prisma.edlinkCekRequest.updateMany({
      where: { status: "PROSES", diambilAt: { lt: new Date(now - MACET_MS) } },
      data: { status: "PENDING", diambilAt: null },
    }),
    prisma.edlinkCekRequest.updateMany({
      where: { status: "PENDING", createdAt: { lt: new Date(now - KADALUARSA_MS) } },
      data: { status: "GAGAL", error: "Kedaluwarsa: worker tidak memproses dalam 30 menit", selesaiAt: new Date(now) },
    }),
  ]);

  // Claim atomik: UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING
  const diambil = await prisma.$queryRaw<Array<{ id: string; kelasId: string }>>`
    UPDATE "EdlinkCekRequest" SET status = 'PROSES', "diambilAt" = NOW()
    WHERE id IN (
      SELECT id FROM "EdlinkCekRequest"
      WHERE status = 'PENDING'
      ORDER BY "createdAt" ASC
      LIMIT ${maks}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, "kelasId"
  `;

  if (diambil.length === 0) return NextResponse.json({ items: [] });

  const kelas = await prisma.kelas.findMany({
    where: { id: { in: diambil.map((d) => d.kelasId) } },
    select: { id: true, kodeKelas: true, edlinkGroupId: true },
  });
  const byId = new Map(kelas.map((k) => [k.id, k]));

  return NextResponse.json({
    items: diambil.map((d) => ({
      id: d.id,
      kelasId: d.kelasId,
      kodeKelas: byId.get(d.kelasId)?.kodeKelas ?? null,
      edlinkGroupId: byId.get(d.kelasId)?.edlinkGroupId ?? null,
    })),
  });
}
