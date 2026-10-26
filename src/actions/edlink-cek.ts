"use server";
// src/actions/edlink-cek.ts
// Tombol "Cek dari Edlink" di halaman monitoring kelas.
//
// Alur:
//   1. Staf klik tombol → mintaCekEdlink(kelasId) membuat EdlinkCekRequest (PENDING).
//   2. Worker edlink-sync mengambil antrian via POST /api/integrasi/cek/ambil,
//      menarik data 16 sesi dari Edlink, mengirim ke /api/integrasi/sesi (mode merge),
//      lalu melapor ke /api/integrasi/cek/{id}/selesai.
//   3. Halaman memanggil getStatusCekEdlink(id) berkala sampai SELESAI/GAGAL,
//      lalu memperbarui grid dengan data sesi terbaru.

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const ROLE_BOLEH = ["SUPER_ADMIN", "ADMIN"];
/** Permintaan yang masih berjalan lebih muda dari ini dipakai ulang (hindari dobel klik). */
const REUSE_MS = 3 * 60 * 1000;

export type StatusCekEdlink = "PENDING" | "PROSES" | "SELESAI" | "GAGAL";

export interface HasilCekEdlink {
  sesiDiperbarui?: number;
  perubahan?: Array<{ nomorSesi: number; field: string; dari: unknown; ke: unknown }>;
  selisihJadwal?: Array<{ nomorSesi: number; cdu: string; edlink: string }>;
}

async function cekAkses() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return { ok: false as const, error: "Sesi login berakhir, silakan login ulang" };
  if (!ROLE_BOLEH.includes(user.role || "")) {
    return { ok: false as const, error: "Hanya Admin CDU yang dapat menjalankan cek Edlink" };
  }
  return { ok: true as const, userId: user.id };
}

export async function mintaCekEdlink(kelasId: string) {
  try {
    const akses = await cekAkses();
    if (!akses.ok) return { success: false, error: akses.error };

    const kelas = await prisma.kelas.findUnique({
      where: { id: kelasId },
      select: { id: true, edlinkGroupId: true, sumberLms: true, externalId: true },
    });
    if (!kelas) return { success: false, error: "Kelas tidak ditemukan" };
    const terpetakan = kelas.sumberLms === "NUSAPUTRA_APP" ? !!kelas.externalId : !!kelas.edlinkGroupId;
    if (!terpetakan) {
      return {
        success: false,
        error: kelas.sumberLms === "NUSAPUTRA_APP"
          ? "Kelas ini belum terhubung ke nusaputra.app"
          : "Kelas ini belum dipetakan ke kelas Edlink",
      };
    }

    const berjalan = await prisma.edlinkCekRequest.findFirst({
      where: {
        kelasId,
        status: { in: ["PENDING", "PROSES"] },
        createdAt: { gte: new Date(Date.now() - REUSE_MS) },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (berjalan) return { success: true, requestId: berjalan.id };

    const req = await prisma.edlinkCekRequest.create({
      data: { kelasId, dimintaOlehId: akses.userId },
      select: { id: true },
    });
    return { success: true, requestId: req.id };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Gagal membuat permintaan cek" };
  }
}

export async function getStatusCekEdlink(requestId: string) {
  try {
    const akses = await cekAkses();
    if (!akses.ok) return { success: false, error: akses.error };

    const req = await prisma.edlinkCekRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        kelasId: true,
        status: true,
        hasil: true,
        error: true,
        createdAt: true,
        selesaiAt: true,
      },
    });
    if (!req) return { success: false, error: "Permintaan tidak ditemukan" };

    const selesai = req.status === "SELESAI" || req.status === "GAGAL";
    const kelas = selesai
      ? await prisma.kelas.findUnique({
          where: { id: req.kelasId },
          select: {
            edlinkSyncedAt: true,
            externalSyncedAt: true,
            sumberLms: true,
            monitoringSesi: {
              select: {
                id: true,
                nomorSesi: true,
                tanggal: true,
                kehadiran: true,
                lectureNote: true,
                slide: true,
                video: true,
                conference: true,
                tugas: true,
                kuis: true,
              },
              orderBy: { nomorSesi: "asc" },
            },
          },
        })
      : null;

    return {
      success: true,
      data: {
        id: req.id,
        status: req.status as StatusCekEdlink,
        hasil: (req.hasil ?? null) as HasilCekEdlink | null,
        error: req.error,
        edlinkSyncedAt:
          (kelas?.sumberLms === "NUSAPUTRA_APP" ? kelas?.externalSyncedAt : kelas?.edlinkSyncedAt) ?? null,
        sesi: kelas?.monitoringSesi ?? null,
      },
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Gagal memuat status cek" };
  }
}
