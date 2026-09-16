"use server";
// src/actions/lapor-cdu.ts
// Server Actions untuk Fitur "Lapor CDU" (Sanggahan & Ketidaksesuaian Monitoring)

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { KategoriLapor, StatusLapor } from "@prisma/client";

// Skema validasi pembuatan laporan
const createLaporSchema = z.object({
  kelasId: z.string().min(1, "Kelas wajib dipilih"),
  nomorSesi: z.number().min(1).max(16, "Nomor sesi harus antara 1 sampai 16"),
  kategori: z.enum([
    "KEHADIRAN_ALPHA",
    "LIVE_CONFERENCE",
    "KONTEN_MATERI",
    "DOSEN_PENGGANTI",
    "LAINNYA",
  ]),
  keterangan: z.string().min(10, "Keterangan kendala minimal 10 karakter"),
  tautanBukti: z.string().optional().nullable(),
});

// Helper otentikasi
async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Sesi login tidak valid. Silakan masuk terlebih dahulu.");
  }
  return session;
}

// Helper otentikasi CDU Staff / Admin / Super Admin
async function requireAdminOrSuper() {
  const session = await requireAuth();
  const role = (session.user as any)?.role;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    throw new Error("Akses ditolak. Fitur verifikasi hanya dapat diakses oleh Staf CDU / Administrator.");
  }
  return session;
}

export interface LaporCduItem {
  id: string;
  kelasId: string;
  nomorSesi: number;
  prodiId: string;
  pelaporId: string;
  kategori: KategoriLapor;
  keterangan: string;
  tautanBukti: string | null;
  status: StatusLapor;
  catatanCdu: string | null;
  diprosesOlehId: string | null;
  tanggalDiproses: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  kelas: {
    id: string;
    kodeKelas: string;
    mataKuliah: {
      id: string;
      nama: string;
      kode: string;
    };
    dosen: {
      id: string;
      nama: string;
    };
    semester: {
      id: string;
      tahunAkademik: string;
      periode: string;
    };
  };
  prodi: {
    id: string;
    nama: string;
    kode: string;
  };
  pelapor: {
    id: string;
    name: string;
    email: string;
  };
  diprosesOleh?: {
    id: string;
    name: string;
  } | null;
  monitoringSesi?: {
    id: string;
    kehadiran: string;
    conference: boolean | null;
    lectureNote: boolean | null;
    slide: boolean | null;
    video: boolean | null;
    tugas: boolean | null;
    kuis: boolean | null;
    catatanCdu: string | null;
  } | null;
}

export async function getLaporCduList(filter?: {
  semesterId?: string;
  prodiId?: string;
  status?: string;
  search?: string;
}) {
  try {
    const session = await requireAuth();
    const userRole = (session.user as any)?.role;
    const userProdiIds = ((session.user as any)?.prodiIds as string[]) || [];

    const isDosen = userRole === "DOSEN";

    // Jika Dosen belum ditugaskan ke prodi apapun
    if (isDosen && userProdiIds.length === 0) {
      return {
        success: true,
        data: {
          items: [],
          stats: { totalAll: 0, totalPending: 0, totalDisetujui: 0, totalDitolak: 0 },
        },
      };
    }

    // Bangun filter query
    const where: any = {};

    // Filter Prodi
    if (isDosen) {
      if (filter?.prodiId && userProdiIds.includes(filter.prodiId)) {
        where.prodiId = filter.prodiId;
      } else {
        where.prodiId = { in: userProdiIds };
      }
    } else if (filter?.prodiId && filter.prodiId !== "ALL") {
      where.prodiId = filter.prodiId;
    }

    // Filter Semester
    if (filter?.semesterId && filter.semesterId !== "ALL") {
      where.kelas = { semesterId: filter.semesterId };
    }

    // Filter Status
    if (filter?.status && filter.status !== "ALL") {
      where.status = filter.status as StatusLapor;
    }

    // Filter Search
    if (filter?.search && filter.search.trim().length > 0) {
      const q = filter.search.trim();
      where.OR = [
        { keterangan: { contains: q, mode: "insensitive" } },
        { kelas: { kodeKelas: { contains: q, mode: "insensitive" } } },
        { kelas: { mataKuliah: { nama: { contains: q, mode: "insensitive" } } } },
        { kelas: { dosen: { nama: { contains: q, mode: "insensitive" } } } },
        { pelapor: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const rawList = await prisma.laporCdu.findMany({
      where,
      include: {
        kelas: {
          select: {
            id: true,
            kodeKelas: true,
            mataKuliah: {
              select: { id: true, nama: true, kode: true },
            },
            dosen: {
              select: { id: true, nama: true },
            },
            semester: {
              select: { id: true, tahunAkademik: true, periode: true },
            },
          },
        },
        prodi: {
          select: { id: true, nama: true, kode: true },
        },
        pelapor: {
          select: { id: true, name: true, email: true },
        },
        diprosesOleh: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Ambil detail monitoring sesi untuk setiap laporan agar data mutakhir
    const enrichedList: LaporCduItem[] = await Promise.all(
      rawList.map(async (item) => {
        const sesi = await prisma.monitoringSesi.findUnique({
          where: {
            kelasId_nomorSesi: {
              kelasId: item.kelasId,
              nomorSesi: item.nomorSesi,
            },
          },
          select: {
            id: true,
            kehadiran: true,
            conference: true,
            lectureNote: true,
            slide: true,
            video: true,
            tugas: true,
            kuis: true,
            catatanCdu: true,
          },
        });

        return {
          ...item,
          monitoringSesi: sesi,
        };
      })
    );

    // Hitung statistik (dengan filter semester dan prodi yang relevan)
    const statsWhere: any = {};
    if (isDosen) {
      statsWhere.prodiId = { in: userProdiIds };
    } else if (filter?.prodiId && filter.prodiId !== "ALL") {
      statsWhere.prodiId = filter.prodiId;
    }
    if (filter?.semesterId && filter.semesterId !== "ALL") {
      statsWhere.kelas = { semesterId: filter.semesterId };
    }

    const [totalAll, totalPending, totalDisetujui, totalDitolak] = await Promise.all([
      prisma.laporCdu.count({ where: statsWhere }),
      prisma.laporCdu.count({ where: { ...statsWhere, status: "PENDING" } }),
      prisma.laporCdu.count({ where: { ...statsWhere, status: "DISETUJUI" } }),
      prisma.laporCdu.count({ where: { ...statsWhere, status: "DITOLAK" } }),
    ]);

    return {
      success: true,
      data: {
        items: enrichedList,
        stats: { totalAll, totalPending, totalDisetujui, totalDitolak },
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memuat daftar Lapor CDU" };
  }
}

// Mengambil daftar kelas dan mata kuliah di prodi tertentu untuk form pelaporan
export async function getClassesForLaporForm(prodiId: string, semesterId?: string) {
  try {
    const session = await requireAuth();
    const userRole = (session.user as any)?.role;
    const userProdiIds = ((session.user as any)?.prodiIds as string[]) || [];

    // Jika Dosen, pastikan prodiId yang diminta memang miliknya
    if (userRole === "DOSEN" && !userProdiIds.includes(prodiId)) {
      throw new Error("Anda tidak memiliki akses ke program studi ini.");
    }

    // Tentukan semester
    let targetSemesterId = semesterId;
    if (!targetSemesterId) {
      const activeSem = await prisma.semester.findFirst({ where: { aktif: true } });
      targetSemesterId = activeSem?.id;
    }

    const kelasList = await prisma.kelas.findMany({
      where: {
        mataKuliah: { prodiId },
        ...(targetSemesterId ? { semesterId: targetSemesterId } : {}),
      },
      select: {
        id: true,
        kodeKelas: true,
        jadwalHari: true,
        jadwalJam: true,
        mataKuliah: {
          select: { id: true, nama: true, kode: true, sks: true },
        },
        dosen: {
          select: { id: true, nama: true },
        },
      },
      orderBy: [{ mataKuliah: { nama: "asc" } }, { kodeKelas: "asc" }],
    });

    return { success: true, data: kelasList };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memuat kelas untuk form" };
  }
}

// Mengambil status pratinjau sesi saat ini agar dosen tahu status sebelum lapor
export async function getSesiStatusPreview(kelasId: string, nomorSesi: number) {
  try {
    await requireAuth();

    const sesi = await prisma.monitoringSesi.findUnique({
      where: {
        kelasId_nomorSesi: { kelasId, nomorSesi },
      },
      select: {
        id: true,
        nomorSesi: true,
        kehadiran: true,
        conference: true,
        lectureNote: true,
        slide: true,
        video: true,
        tugas: true,
        kuis: true,
        catatanCdu: true,
      },
    });

    return { success: true, data: sesi };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memuat preview sesi" };
  }
}

// Membuat laporan kendala baru (Dosen / Kaprodi / Pelapor)
export async function createLaporCdu(formData: {
  kelasId: string;
  nomorSesi: number;
  kategori: KategoriLapor;
  keterangan: string;
  tautanBukti?: string | null;
}) {
  try {
    const session = await requireAuth();
    const userRole = (session.user as any)?.role;
    const userProdiIds = ((session.user as any)?.prodiIds as string[]) || [];

    const parsed = createLaporSchema.parse(formData);

    // Cari kelas dan prodi terkait
    const kelas = await prisma.kelas.findUnique({
      where: { id: parsed.kelasId },
      include: {
        mataKuliah: true,
      },
    });

    if (!kelas) {
      return { success: false, error: "Kelas tidak ditemukan." };
    }

    const prodiId = kelas.mataKuliah.prodiId;

    // Jika role Dosen, pastikan prodi ini adalah prodi yang diizinkan
    if (userRole === "DOSEN" && !userProdiIds.includes(prodiId)) {
      return { success: false, error: "Anda tidak memiliki wewenang untuk melaporkan kelas di prodi ini." };
    }

    // Buat tiket laporan baru
    const newLaporan = await prisma.laporCdu.create({
      data: {
        kelasId: parsed.kelasId,
        nomorSesi: parsed.nomorSesi,
        prodiId,
        pelaporId: session.user.id!,
        kategori: parsed.kategori,
        keterangan: parsed.keterangan.trim(),
        tautanBukti: parsed.tautanBukti?.trim() || null,
        status: "PENDING",
      },
    });

    revalidatePath("/lapor-cdu");
    return { success: true, data: newLaporan };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Validasi laporan gagal",
      };
    }
    return { success: false, error: error.message || "Gagal membuat laporan" };
  }
}

// Menyetujui laporan kendala & update otomatis sesi monitoring jika diminta (Admin CDU)
export async function approveLaporCdu(data: {
  id: string;
  catatanCdu?: string | null;
  updateMonitoring?: boolean;
}) {
  try {
    const session = await requireAdminOrSuper();

    const laporan = await prisma.laporCdu.findUnique({
      where: { id: data.id },
    });

    if (!laporan) {
      return { success: false, error: "Data laporan tidak ditemukan." };
    }

    // Jalankan transaksi update
    await prisma.$transaction(async (tx) => {
      // 1. Update status laporan menjadi DISETUJUI
      await tx.laporCdu.update({
        where: { id: data.id },
        data: {
          status: "DISETUJUI",
          catatanCdu: data.catatanCdu?.trim() || null,
          diprosesOlehId: session.user.id!,
          tanggalDiproses: new Date(),
        },
      });

      // 2. Jika opsi updateMonitoring aktif, lakukan sinkronisasi otomatis
      if (data.updateMonitoring) {
        const sesi = await tx.monitoringSesi.findUnique({
          where: {
            kelasId_nomorSesi: {
              kelasId: laporan.kelasId,
              nomorSesi: laporan.nomorSesi,
            },
          },
        });

        if (sesi) {
          const updateData: any = {};
          const noteAppend = data.catatanCdu?.trim()
            ? ` [Disetujui CDU: ${data.catatanCdu.trim()}]`
            : ` [Disetujui via Lapor CDU]`;

          updateData.catatanCdu = sesi.catatanCdu
            ? `${sesi.catatanCdu} |${noteAppend}`
            : noteAppend.trim();

          // Penyesuaian spesifik berdasarkan kategori
          if (laporan.kategori === "KEHADIRAN_ALPHA") {
            updateData.kehadiran = "HADIR";
          } else if (laporan.kategori === "LIVE_CONFERENCE") {
            updateData.conference = true;
            updateData.kehadiran = "HADIR";
          } else if (laporan.kategori === "KONTEN_MATERI") {
            updateData.lectureNote = true;
            updateData.slide = true;
          }

          await tx.monitoringSesi.update({
            where: { id: sesi.id },
            data: updateData,
          });
        }
      }
    });

    revalidatePath("/lapor-cdu");
    revalidatePath("/monitoring");
    revalidatePath("/laporan/rekap");
    revalidatePath("/laporan/dosen");
    revalidatePath("/laporan/prodi");
    revalidatePath("/");

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menyetujui laporan" };
  }
}

// Menolak laporan kendala disertai catatan alasan (Admin CDU)
export async function rejectLaporCdu(data: {
  id: string;
  catatanCdu: string;
}) {
  try {
    const session = await requireAdminOrSuper();

    if (!data.catatanCdu || data.catatanCdu.trim().length === 0) {
      return { success: false, error: "Alasan penolakan laporan wajib dicantumkan sebagai feedback ke pelapor." };
    }

    const laporan = await prisma.laporCdu.findUnique({
      where: { id: data.id },
    });

    if (!laporan) {
      return { success: false, error: "Data laporan tidak ditemukan." };
    }

    await prisma.laporCdu.update({
      where: { id: data.id },
      data: {
        status: "DITOLAK",
        catatanCdu: data.catatanCdu.trim(),
        diprosesOlehId: session.user.id!,
        tanggalDiproses: new Date(),
      },
    });

    revalidatePath("/lapor-cdu");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menolak laporan" };
  }
}

// Menghapus laporan (Super Admin, atau pelapor jika masih PENDING)
export async function deleteLaporCdu(id: string) {
  try {
    const session = await requireAuth();
    const userRole = (session.user as any)?.role;

    const laporan = await prisma.laporCdu.findUnique({
      where: { id },
    });

    if (!laporan) {
      return { success: false, error: "Laporan tidak ditemukan." };
    }

    const isOwner = laporan.pelaporId === session.user.id;
    const isSuperAdmin = userRole === "SUPER_ADMIN";

    if (!isSuperAdmin && (!isOwner || laporan.status !== "PENDING")) {
      return {
        success: false,
        error: "Anda hanya dapat menghapus laporan milik Anda sendiri yang masih berstatus PENDING.",
      };
    }

    await prisma.laporCdu.delete({ where: { id } });

    revalidatePath("/lapor-cdu");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menghapus laporan" };
  }
}
