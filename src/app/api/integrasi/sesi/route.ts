// src/app/api/integrasi/sesi/route.ts
// POST /api/integrasi/sesi
// Worker mengirim data MENTAH sesi Edlink untuk satu kelas; CDU yang menerjemahkan
// (src/lib/edlink-mapper.ts) dan menyimpan dengan aturan aman:
//
//   mode "merge" (default):
//     - Komponen konten hanya dinaikkan false/null → true (tidak pernah menghapus
//       centang yang sudah diisi staf CDU).
//     - Tanggal sesi hanya diisi bila masih kosong (tanggal CDU sudah memperhitungkan
//       hari libur); selisih dengan jadwal Edlink dilaporkan di `selisihJadwal`.
//     - Kehadiran TIDAK disentuh, kecuali isiKehadiran=true dan nilai sekarang
//       BELUM_DIISI dan sesi sudah dimulai dosen di Edlink → HADIR.
//   mode "overwrite": komponen konten ditimpa persis sesuai Edlink
//     (hanya untuk sesi yang sumberData-nya bukan MANUAL berisi).
//   dryRun=true: hitung perubahan tanpa menulis.
//
// Body:
// {
//   "kelasId": "cuid..."            // atau
//   "edlinkGroupId": 2126659,
//   "sections": [ ...respons Edlink POST /api/v1.4/sections/all/{groupId} → data[] ],
//   "mode": "merge" | "overwrite",
//   "isiKehadiran": false,
//   "dryRun": false
// }

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { checkIntegrasiAuth, jsonError } from "@/lib/integrasi-auth";
import { EdlinkSection, KOMPONEN_KONTEN, mapEdlinkSection } from "@/lib/edlink-mapper";
import { invalidateLaporanCache } from "@/actions/laporan";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const denied = checkIntegrasiAuth(req);
  if (denied) return denied;

  type BodySesi = {
    kelasId?: string;
    edlinkGroupId?: number;
    sections?: unknown;
    mode?: string;
    isiKehadiran?: boolean;
    dryRun?: boolean;
  };
  let body: BodySesi;
  try {
    body = (await req.json()) as BodySesi;
  } catch {
    return jsonError("Body harus JSON");
  }

  const sections: EdlinkSection[] = Array.isArray(body?.sections) ? (body.sections as EdlinkSection[]) : [];
  const mode: "merge" | "overwrite" = body?.mode === "overwrite" ? "overwrite" : "merge";
  const isiKehadiran = body?.isiKehadiran === true;
  const dryRun = body?.dryRun === true;

  if (sections.length === 0 || sections.length > 40) return jsonError("sections wajib diisi (1–40)");

  const kelas = body?.kelasId
    ? await prisma.kelas.findUnique({ where: { id: String(body.kelasId) }, include: { monitoringSesi: true } })
    : body?.edlinkGroupId
      ? await prisma.kelas.findUnique({
          where: { edlinkGroupId: Number(body.edlinkGroupId) },
          include: { monitoringSesi: true },
        })
      : null;
  if (!kelas) return jsonError("Kelas tidak ditemukan (kirim kelasId atau edlinkGroupId yang sudah dipetakan)", 404);

  if (body?.edlinkGroupId && kelas.edlinkGroupId && Number(body.edlinkGroupId) !== kelas.edlinkGroupId) {
    return jsonError("edlinkGroupId tidak cocok dengan kelas", 409);
  }
  const salahGrup = sections.find((s) => s.groupId && kelas.edlinkGroupId && Number(s.groupId) !== kelas.edlinkGroupId);
  if (salahGrup) return jsonError(`Section ${salahGrup.id} bukan milik grup Edlink kelas ini`, 409);

  const perubahan: Array<{ nomorSesi: number; field: string; dari: unknown; ke: unknown }> = [];
  const lewati: Array<{ nomorSesi: number; alasan: string }> = [];
  const selisihJadwal: Array<{ nomorSesi: number; cdu: string; edlink: string }> = [];
  const ringkas: Array<{
    nomorSesi: number;
    tanggal: string | null;
    dimulai: boolean;
    konten: Record<string, boolean | null>;
    bukti: string[];
  }> = [];
  const updates: Array<{ id: string; data: Prisma.MonitoringSesiUpdateInput }> = [];

  for (const sec of sections) {
    const m = mapEdlinkSection(sec);
    if (!Number.isInteger(m.nomorSesi) || m.nomorSesi < 1 || m.nomorSesi > 16) {
      lewati.push({ nomorSesi: m.nomorSesi, alasan: "nomor sesi di luar 1–16" });
      continue;
    }
    ringkas.push({
      nomorSesi: m.nomorSesi,
      tanggal: m.tanggal ? m.tanggal.toISOString() : null,
      dimulai: m.dimulai,
      konten: Object.fromEntries(KOMPONEN_KONTEN.map((k) => [k, m[k]])),
      bukti: m.bukti,
    });

    const sesi = kelas.monitoringSesi.find((s) => s.nomorSesi === m.nomorSesi);
    if (!sesi) {
      lewati.push({ nomorSesi: m.nomorSesi, alasan: "baris sesi belum ada di CDU" });
      continue;
    }

    const data: Prisma.MonitoringSesiUpdateInput & Record<string, unknown> = {};

    if (!m.isExam) {
      const manualBerisi =
        sesi.sumberData === "MANUAL" && KOMPONEN_KONTEN.some((k) => sesi[k] === true);
      for (const k of KOMPONEN_KONTEN) {
        const lama = sesi[k];
        const baru = m[k];
        if (mode === "overwrite" && !manualBerisi) {
          if (lama !== baru) data[k] = baru;
        } else if (baru === true && lama !== true) {
          data[k] = true;
        }
      }
      if (mode === "overwrite" && manualBerisi) {
        lewati.push({ nomorSesi: m.nomorSesi, alasan: "overwrite dilewati: data manual staf CDU (pakai merge)" });
      }
    }

    // CDU menyimpan tanggal sesi sebagai tanggal saja (00:00 UTC) dan sudah memperhitungkan
    // hari libur (LiburSemester), sedangkan jadwal Edlink tidak. Karena itu tanggal CDU
    // TIDAK ditimpa: hanya diisi bila kosong; selisih dilaporkan di `selisihJadwal`.
    if (m.tanggal) {
      const tglWIB = new Date(m.tanggal.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
      const tglCdu = sesi.tanggal ? sesi.tanggal.toISOString().slice(0, 10) : null;
      if (!tglCdu) data.tanggal = new Date(`${tglWIB}T00:00:00.000Z`);
      else if (tglCdu !== tglWIB) selisihJadwal.push({ nomorSesi: m.nomorSesi, cdu: tglCdu, edlink: tglWIB });
    }

    if (isiKehadiran && m.dimulai && sesi.kehadiran === "BELUM_DIISI") {
      data.kehadiran = "HADIR";
    }

    if (Object.keys(data).length > 0) {
      for (const [field, ke] of Object.entries(data)) {
        perubahan.push({ nomorSesi: m.nomorSesi, field, dari: (sesi as Record<string, unknown>)[field] ?? null, ke });
      }
      const kontenBerubah = KOMPONEN_KONTEN.some((k) => k in data) || "kehadiran" in data;
      if (kontenBerubah) data.sumberData = "EDLINK_API";
      updates.push({ id: sesi.id, data });
    }
  }

  if (!dryRun) {
    await prisma.$transaction([
      ...updates.map((u) => prisma.monitoringSesi.update({ where: { id: u.id }, data: u.data })),
      prisma.kelas.update({ where: { id: kelas.id }, data: { edlinkSyncedAt: new Date() } }),
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
    edlinkGroupId: kelas.edlinkGroupId,
    mode,
    dryRun,
    sesiDiperbarui: updates.length,
    perubahan,
    lewati,
    selisihJadwal,
    hasilPemetaan: ringkas,
  });
}
