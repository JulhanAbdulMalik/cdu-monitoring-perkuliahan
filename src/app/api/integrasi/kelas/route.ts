// src/app/api/integrasi/kelas/route.ts
// GET  /api/integrasi/kelas?semesterId=&prodiId=&hanyaTerpetakan=1
//      Daftar kelas (default: semester aktif) beserta ID Edlink — dipakai worker sinkronisasi.
// POST /api/integrasi/kelas
//      Pemetaan massal ID Edlink → kelas CDU.
//      Body: { "items": [{ "kelasId": "...", "edlinkGroupId": 2126659 }, ...] }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkIntegrasiAuth, jsonError } from "@/lib/integrasi-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = checkIntegrasiAuth(req);
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const semesterId = sp.get("semesterId") || undefined;
  const prodiId = sp.get("prodiId") || undefined;
  const hanyaTerpetakan = sp.get("hanyaTerpetakan") === "1";

  const semester = semesterId
    ? await prisma.semester.findUnique({ where: { id: semesterId } })
    : await prisma.semester.findFirst({ where: { aktif: true } });
  if (!semester) return jsonError("Semester tidak ditemukan", 404);

  const kelas = await prisma.kelas.findMany({
    where: {
      semesterId: semester.id,
      ...(prodiId ? { mataKuliah: { prodiId } } : {}),
      ...(hanyaTerpetakan ? { edlinkGroupId: { not: null } } : {}),
    },
    select: {
      id: true,
      kodeKelas: true,
      jadwalHari: true,
      jadwalJam: true,
      ruangan: true,
      modePembelajaran: true,
      edlinkGroupId: true,
      edlinkSyncedAt: true,
      mataKuliah: { select: { kode: true, nama: true, prodi: { select: { id: true, kode: true, nama: true } } } },
      dosen: { select: { id: true, nama: true } },
      dosen2: { select: { id: true, nama: true } },
    },
    orderBy: [{ kodeKelas: "asc" }],
  });

  return NextResponse.json({
    semester: {
      id: semester.id,
      tahunAkademik: semester.tahunAkademik,
      periode: semester.periode,
      tanggalMulai: semester.tanggalMulai,
    },
    total: kelas.length,
    terpetakan: kelas.filter((k) => k.edlinkGroupId != null).length,
    data: kelas,
  });
}

export async function POST(req: NextRequest) {
  const denied = checkIntegrasiAuth(req);
  if (denied) return denied;

  type ItemPemetaan = { kelasId?: string; edlinkGroupId?: number | null };
  let body: { items?: unknown };
  try {
    body = (await req.json()) as { items?: unknown };
  } catch {
    return jsonError("Body harus JSON");
  }
  const items: ItemPemetaan[] = Array.isArray(body?.items) ? (body.items as ItemPemetaan[]) : [];
  if (items.length === 0 || items.length > 5000) return jsonError("items wajib diisi (1–5000)");

  const hasil = { diperbarui: 0, gagal: [] as Array<{ kelasId?: string; error: string }> };
  for (const it of items) {
    const gid = it.edlinkGroupId == null ? null : Number(it.edlinkGroupId);
    if (!it.kelasId || (gid !== null && (!Number.isInteger(gid) || gid <= 0))) {
      hasil.gagal.push({ kelasId: it.kelasId, error: "kelasId / edlinkGroupId tidak valid" });
      continue;
    }
    try {
      await prisma.kelas.update({ where: { id: it.kelasId }, data: { edlinkGroupId: gid } });
      hasil.diperbarui++;
    } catch (e: unknown) {
      const code = (e as { code?: string } | null)?.code;
      hasil.gagal.push({
        kelasId: it.kelasId,
        error: code === "P2002" ? "edlinkGroupId sudah dipakai kelas lain" : code === "P2025" ? "kelas tidak ditemukan" : "gagal update",
      });
    }
  }
  return NextResponse.json(hasil);
}
