// src/app/api/integrasi/sesi/eksternal/route.ts
// POST /api/integrasi/sesi/eksternal  (auth: Bearer INTEGRASI_API_KEYS)
// Worker mengirim ringkasan konten per sesi dari LMS nusaputra.app untuk satu kelas
// (respons GET /api/integration/v1/classes/{uuid}/sessions, sudah dipetakan worker).
//
// Aturan aman (sama dengan mode "merge" Edlink):
//   - Komponen konten hanya dinaikkan false/null → true; centang staf CDU tidak pernah dihapus.
//   - Sesi 8 (UTS) dan 16 (UAS) CDU tidak diberi konten; sesi ujian di sumber juga dilewati.
//   - Tanggal sesi hanya diisi bila masih kosong; selisih dilaporkan di `selisihJadwal`.
//   - Kehadiran TIDAK pernah disentuh.
//   - Hanya untuk kelas sumberLms = NUSAPUTRA_APP (dicari lewat externalId).
//   - dryRun=true: hitung perubahan tanpa menulis.
//
// Body:
// {
//   "externalId": "uuid",
//   "sesi": [{ "nomor": 1, "tanggal": "2026-09-21", "ujian": false,
//              "konten": { "lectureNote": true, "slide": false, "video": false,
//                          "conference": false, "tugas": true, "kuis": false },
//              "bukti": ["Slide: Pengantar.pptx"] }],
//   "dryRun": false
// }

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { checkIntegrasiAuth, jsonError } from "@/lib/integrasi-auth";
import { KOMPONEN_KONTEN } from "@/lib/edlink-mapper";
import { invalidateLaporanCache } from "@/actions/laporan";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type SesiInput = {
  nomor?: unknown;
  tanggal?: unknown;
  ujian?: unknown;
  konten?: Record<string, unknown>;
  bukti?: unknown;
};

export async function POST(req: NextRequest) {
  const denied = checkIntegrasiAuth(req);
  if (denied) return denied;

  let body: { externalId?: unknown; sesi?: unknown; dryRun?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError("Body harus JSON");
  }

  const externalId = typeof body?.externalId === "string" ? body.externalId.trim() : "";
  if (!externalId) return jsonError("externalId wajib diisi");
  const daftar: SesiInput[] = Array.isArray(body?.sesi) ? (body.sesi as SesiInput[]) : [];
  if (daftar.length > 40) return jsonError("sesi maksimal 40");
  const dryRun = body?.dryRun === true;

  const kelas = await prisma.kelas.findUnique({ where: { externalId }, include: { monitoringSesi: true } });
  if (!kelas) return jsonError("Kelas dengan externalId ini belum diimpor ke CDU", 404);
  if (kelas.sumberLms !== "NUSAPUTRA_APP") return jsonError("Kelas ini bukan kelas sumber nusaputra.app", 409);

  const perubahan: Array<{ nomorSesi: number; field: string; dari: unknown; ke: unknown }> = [];
  const lewati: Array<{ nomorSesi: number; alasan: string }> = [];
  const selisihJadwal: Array<{ nomorSesi: number; cdu: string; sumber: string }> = [];
  const updates: Array<{ id: string; data: Prisma.MonitoringSesiUpdateInput }> = [];
  const nomorDilihat = new Set<number>();

  for (const s of daftar) {
    const nomor = Number(s?.nomor);
    if (!Number.isInteger(nomor) || nomor < 1 || nomor > 16) {
      lewati.push({ nomorSesi: nomor, alasan: "nomor sesi di luar 1–16" });
      continue;
    }
    if (nomorDilihat.has(nomor)) {
      lewati.push({ nomorSesi: nomor, alasan: "nomor sesi ganda di sumber" });
      continue;
    }
    nomorDilihat.add(nomor);

    const sesi = kelas.monitoringSesi.find((x) => x.nomorSesi === nomor);
    if (!sesi) {
      lewati.push({ nomorSesi: nomor, alasan: "baris sesi belum ada di CDU" });
      continue;
    }

    const data: Prisma.MonitoringSesiUpdateInput & Record<string, unknown> = {};
    const cduUjian = sesi.jenisSesi !== "REGULER";
    if (cduUjian || s?.ujian === true) {
      if (!cduUjian) lewati.push({ nomorSesi: nomor, alasan: "sesi ujian di nusaputra.app; konten tidak dihitung" });
    } else {
      for (const k of KOMPONEN_KONTEN) {
        if (s?.konten?.[k] === true && sesi[k] !== true) data[k] = true;
      }
    }

    const tgl = typeof s?.tanggal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.tanggal) ? s.tanggal : null;
    if (tgl) {
      const tglCdu = sesi.tanggal ? sesi.tanggal.toISOString().slice(0, 10) : null;
      if (!tglCdu) data.tanggal = new Date(`${tgl}T00:00:00.000Z`);
      else if (tglCdu !== tgl) selisihJadwal.push({ nomorSesi: nomor, cdu: tglCdu, sumber: tgl });
    }

    if (Object.keys(data).length > 0) {
      for (const [field, ke] of Object.entries(data)) {
        perubahan.push({ nomorSesi: nomor, field, dari: (sesi as Record<string, unknown>)[field] ?? null, ke });
      }
      if (KOMPONEN_KONTEN.some((k) => k in data)) data.sumberData = "NUSAPUTRA_APP";
      updates.push({ id: sesi.id, data });
    }
  }

  if (!dryRun) {
    await prisma.$transaction([
      ...updates.map((u) => prisma.monitoringSesi.update({ where: { id: u.id }, data: u.data })),
      prisma.kelas.update({ where: { id: kelas.id }, data: { externalSyncedAt: new Date() } }),
    ]);
    if (updates.length > 0) {
      try {
        revalidatePath(`/monitoring/${kelas.id}`);
        revalidatePath("/monitoring");
        revalidatePath("/laporan/rekap");
        revalidatePath("/");
      } catch {
        /* revalidate opsional */
      }
      await invalidateLaporanCache();
    }
  }

  return NextResponse.json({
    kelasId: kelas.id,
    kodeKelas: kelas.kodeKelas,
    externalId,
    dryRun,
    sesiDiperbarui: updates.length,
    perubahan,
    lewati,
    selisihJadwal,
  });
}
