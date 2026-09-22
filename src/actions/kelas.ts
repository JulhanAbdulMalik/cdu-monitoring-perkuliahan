"use server";
// src/actions/kelas.ts
// Server Actions untuk CRUD Data Kelas & Auto Generate 16 Monitoring Sessions

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { invalidateLaporanCache } from "@/actions/laporan";

const kelasSchema = z.object({
  kodeKelas: z.string().min(1, "Kode kelas wajib diisi").toUpperCase(),
  semesterId: z.string().min(1, "Semester wajib dipilih"),
  mataKuliahId: z.string().min(1, "Mata kuliah wajib dipilih"),
  dosenId: z.string().min(1, "Dosen pengampu wajib dipilih"),
  jadwalHari: z.string().min(1, "Jadwal hari wajib diisi"),
  jadwalJam: z.string().min(1, "Jadwal jam wajib diisi"),
  modePembelajaran: z.enum(["DARING", "LURING", "BIMBINGAN"]).default("DARING"),
});

export async function getKelasList(semesterId?: string) {
  try {
    // Optimasi Waterfall: Jalankan query data master secara paralel
    const [allSemesters, allMataKuliah, allDosen, allProdi] = await Promise.all([
      prisma.semester.findMany({
        orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
      }),
      prisma.mataKuliah.findMany({
        include: { prodi: true },
        orderBy: [{ prodi: { nama: "asc" } }, { nama: "asc" }],
      }),
      prisma.dosen.findMany({
        include: { prodi: true },
        orderBy: { nama: "asc" },
      }),
      prisma.prodi.findMany({
        orderBy: { nama: "asc" },
      }),
    ]);

    const activeSemester = allSemesters.find((s) => s.aktif) || allSemesters[0];
    const targetSemesterId = semesterId || activeSemester?.id;

    const kelas = await prisma.kelas.findMany({
      where: targetSemesterId ? { semesterId: targetSemesterId } : {},
      include: {
        semester: true,
        mataKuliah: {
          include: { prodi: true },
        },
        dosen: true,
      },
      orderBy: [{ mataKuliah: { prodi: { nama: "asc" } } }, { kodeKelas: "asc" }],
    });

    return {
      success: true,
      data: {
        kelas,
        semesters: allSemesters,
        mataKuliah: allMataKuliah,
        dosen: allDosen,
        prodi: allProdi,
        activeSemesterId: activeSemester?.id || allSemesters[0]?.id,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memuat data kelas" };
  }
}

export interface UnifiedKelasPayload {
  kodeKelas: string;
  semesterId: string;
  jadwalHari: string;
  jadwalJam: string;
  ruangan?: string | null;
  modePembelajaran: "DARING" | "LURING" | "BIMBINGAN";
  mataKuliahId?: string;
  kodeMk?: string;
  namaMk?: string;
  sks?: number;
  prodiId?: string;
  dosenId?: string;
  namaDosen?: string;
}

export async function createKelas(formData: UnifiedKelasPayload) {
  try {
    const kodeKelas = (formData.kodeKelas || "").trim().toUpperCase();
    if (!kodeKelas) {
      return { success: false, error: "Kode / Nama Kelas wajib diisi" };
    }
    if (!formData.semesterId) {
      return { success: false, error: "Semester wajib dipilih" };
    }

    // 1. Resolve Mata Kuliah
    let mataKuliahId = formData.mataKuliahId;
    if (!mataKuliahId) {
      const mkKode = (formData.kodeMk || kodeKelas).trim().toUpperCase();
      const mkNama = (formData.namaMk || mkKode).trim();
      const mkSks = Number(formData.sks) || 3;
      const pId = formData.prodiId;

      if (!pId) {
        return { success: false, error: "Program Studi wajib dipilih" };
      }

      let existingMk = await prisma.mataKuliah.findFirst({
        where: {
          kode: mkKode,
          prodiId: pId,
        },
      });

      if (!existingMk) {
        existingMk = await prisma.mataKuliah.create({
          data: {
            kode: mkKode,
            nama: mkNama,
            sks: mkSks,
            prodiId: pId,
          },
        });
      }
      mataKuliahId = existingMk.id;
    }

    // 2. Resolve Dosen
    let dosenId = formData.dosenId;
    if (!dosenId) {
      const dNama = (formData.namaDosen || "").trim();
      if (!dNama) {
        return { success: false, error: "Dosen Pengampu wajib diisi atau dipilih" };
      }
      const pId = formData.prodiId;
      if (!pId) {
        return { success: false, error: "Program Studi wajib dipilih" };
      }

      let existingDosen = await prisma.dosen.findFirst({
        where: {
          nama: { equals: dNama, mode: "insensitive" },
        },
      });

      if (!existingDosen) {
        existingDosen = await prisma.dosen.create({
          data: {
            nama: dNama,
            prodiId: pId,
          },
        });
      }
      dosenId = existingDosen.id;
    }

    // 3. Cek duplikasi kode kelas pada semester dan mata kuliah yang sama
    const existing = await prisma.kelas.findFirst({
      where: {
        kodeKelas: kodeKelas,
        semesterId: formData.semesterId,
        mataKuliahId: mataKuliahId,
      },
    });

    if (existing) {
      return {
        success: false,
        error: `Kelas "${kodeKelas}" untuk mata kuliah ini sudah ada di semester tersebut`,
      };
    }

    // 4. Buat Kelas sekaligus 16 Sesi Monitoring
    const newKelas = await prisma.$transaction(async (tx) => {
      const createdKelas = await tx.kelas.create({
        data: {
          kodeKelas: kodeKelas,
          semesterId: formData.semesterId,
          mataKuliahId: mataKuliahId!,
          dosenId: dosenId!,
          jadwalHari: (formData.jadwalHari || "Senin").trim(),
          jadwalJam: (formData.jadwalJam || "08:00 - 09:40").trim(),
          ruangan: formData.modePembelajaran !== "DARING" ? (formData.ruangan?.trim() || null) : null,
          modePembelajaran: formData.modePembelajaran || "DARING",
        },
      });

      const sessionsData = [];
      for (let i = 1; i <= 16; i++) {
        const isUTS = i === 8;
        const isUAS = i === 16;
        const isExam = isUTS || isUAS;

        sessionsData.push({
          kelasId: createdKelas.id,
          nomorSesi: i,
          jenisSesi: isUTS ? ("UTS" as const) : isUAS ? ("UAS" as const) : ("REGULER" as const),
          kehadiran: "BELUM_DIISI" as const,
          lectureNote: isExam ? null : false,
          slide: isExam ? null : false,
          video: isExam ? null : false,
          conference: isExam && formData.modePembelajaran !== "BIMBINGAN" ? null : false,
          tugas: isExam ? null : false,
          kuis: isExam ? null : false,
        });
      }

      await tx.monitoringSesi.createMany({
        data: sessionsData,
      });

      return tx.kelas.findUnique({
        where: { id: createdKelas.id },
        include: {
          semester: true,
          mataKuliah: { include: { prodi: true } },
          dosen: true,
          monitoringSesi: { orderBy: { nomorSesi: "asc" } },
        },
      });
    });

    await invalidateLaporanCache();
    revalidatePath("/master/kelas");
    revalidatePath("/monitoring");
    revalidatePath("/");
    return { success: true, data: newKelas };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal membuat kelas perkuliahan baru" };
  }
}

export async function updateKelas(id: string, formData: UnifiedKelasPayload) {
  try {
    const kodeKelas = (formData.kodeKelas || "").trim().toUpperCase();
    if (!kodeKelas) {
      return { success: false, error: "Kode / Nama Kelas wajib diisi" };
    }

    // 1. Resolve Mata Kuliah
    let mataKuliahId = formData.mataKuliahId;
    if (!mataKuliahId && (formData.namaMk || formData.kodeMk)) {
      const mkKode = (formData.kodeMk || kodeKelas).trim().toUpperCase();
      const mkNama = (formData.namaMk || mkKode).trim();
      const mkSks = Number(formData.sks) || 3;
      const pId = formData.prodiId;

      if (!pId) {
        return { success: false, error: "Program Studi wajib dipilih" };
      }

      let existingMk = await prisma.mataKuliah.findFirst({
        where: {
          kode: mkKode,
          prodiId: pId,
        },
      });

      if (!existingMk) {
        existingMk = await prisma.mataKuliah.create({
          data: {
            kode: mkKode,
            nama: mkNama,
            sks: mkSks,
            prodiId: pId,
          },
        });
      }
      mataKuliahId = existingMk.id;
    }

    // 2. Resolve Dosen
    let dosenId = formData.dosenId;
    if (!dosenId && formData.namaDosen) {
      const dNama = formData.namaDosen.trim();
      const pId = formData.prodiId;
      if (!pId) {
        return { success: false, error: "Program Studi wajib dipilih" };
      }

      let existingDosen = await prisma.dosen.findFirst({
        where: {
          nama: { equals: dNama, mode: "insensitive" },
        },
      });

      if (!existingDosen) {
        existingDosen = await prisma.dosen.create({
          data: {
            nama: dNama,
            prodiId: pId,
          },
        });
      }
      dosenId = existingDosen.id;
    }

    const currentKelas = await prisma.kelas.findUnique({ where: { id } });
    if (!currentKelas) return { success: false, error: "Kelas tidak ditemukan" };

    const finalSemesterId = formData.semesterId || currentKelas.semesterId;
    const finalMataKuliahId = mataKuliahId || currentKelas.mataKuliahId;
    const finalDosenId = dosenId || currentKelas.dosenId;

    const existing = await prisma.kelas.findFirst({
      where: {
        kodeKelas: kodeKelas,
        semesterId: finalSemesterId,
        mataKuliahId: finalMataKuliahId,
        NOT: { id },
      },
    });

    if (existing) {
      return {
        success: false,
        error: `Kelas "${kodeKelas}" sudah ada pada semester dan mata kuliah yang dipilih`,
      };
    }

    const updatedKelas = await prisma.kelas.update({
      where: { id },
      data: {
        kodeKelas: kodeKelas,
        semesterId: finalSemesterId,
        mataKuliahId: finalMataKuliahId,
        dosenId: finalDosenId,
        jadwalHari: formData.jadwalHari?.trim(),
        jadwalJam: formData.jadwalJam?.trim(),
        ruangan: formData.modePembelajaran !== "DARING" ? (formData.ruangan?.trim() || null) : null,
        modePembelajaran: formData.modePembelajaran,
      },
      include: {
        semester: true,
        mataKuliah: { include: { prodi: true } },
        dosen: true,
        monitoringSesi: { orderBy: { nomorSesi: "asc" } },
      },
    });

    await invalidateLaporanCache();
    revalidatePath("/master/kelas");
    revalidatePath("/monitoring");
    revalidatePath("/");
    return { success: true, data: updatedKelas };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memperbarui data kelas" };
  }
}

export async function deleteKelas(id: string) {
  try {
    // Menghapus kelas akan otomatis menghapus 16 sesi monitoring (cascade onDelete)
    await prisma.kelas.delete({
      where: { id },
    });

    await invalidateLaporanCache();
    revalidatePath("/master/kelas");
    revalidatePath("/monitoring");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menghapus kelas" };
  }
}

export interface ResetKelasStats {
  kelasCount: number;
  sesiCount: number;
  emptyMkCount: number;
  prodiNama: string;
  semesterNama: string;
}

export async function getResetKelasStats(options: {
  semesterId?: string;
  prodiId?: string;
}) {
  try {
    const whereKelas: any = {};
    if (options.semesterId && options.semesterId !== "ALL") {
      whereKelas.semesterId = options.semesterId;
    }
    if (options.prodiId && options.prodiId !== "ALL") {
      whereKelas.mataKuliah = { prodiId: options.prodiId };
    }

    const [kelasCount, kelasList] = await Promise.all([
      prisma.kelas.count({ where: whereKelas }),
      prisma.kelas.findMany({
        where: whereKelas,
        select: { id: true, mataKuliahId: true },
      }),
    ]);

    const kelasIds = kelasList.map((k) => k.id);
    const sesiCount = await prisma.monitoringSesi.count({
      where: { kelasId: { in: kelasIds } },
    });

    // Hitung estimasi Mata Kuliah yang akan menjadi 0 kelas jika filter ini dihapus
    let emptyMkCount = 0;
    const deletedMkIds = new Set(kelasList.map((k) => k.mataKuliahId));
    const whereMkFilter: any = {};
    if (options.prodiId && options.prodiId !== "ALL") {
      whereMkFilter.prodiId = options.prodiId;
    }

    const mks = await prisma.mataKuliah.findMany({
      where: whereMkFilter,
      include: {
        kelas: { select: { id: true } },
      },
    });

    for (const m of mks) {
      // MK kosong saat ini, atau semua kelas di dalamnya termasuk yang akan dihapus
      const remainingClasses = m.kelas.filter((k) => !kelasIds.includes(k.id));
      if (remainingClasses.length === 0) {
        emptyMkCount++;
      }
    }

    let prodiNama = "Semua Program Studi";
    if (options.prodiId && options.prodiId !== "ALL") {
      const p = await prisma.prodi.findUnique({ where: { id: options.prodiId } });
      if (p) prodiNama = p.nama;
    }

    let semesterNama = "Semua Semester";
    if (options.semesterId && options.semesterId !== "ALL") {
      const s = await prisma.semester.findUnique({ where: { id: options.semesterId } });
      if (s) semesterNama = `${s.tahunAkademik} ${s.periode}`;
    }

    return {
      success: true,
      data: {
        kelasCount,
        sesiCount,
        emptyMkCount,
        prodiNama,
        semesterNama,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal mengambil statistik pembersihan" };
  }
}

export async function resetKelasData(options: {
  semesterId?: string;
  prodiId?: string;
  cleanupEmptyMk?: boolean;
}) {
  try {
    const whereKelas: any = {};
    if (options.semesterId && options.semesterId !== "ALL") {
      whereKelas.semesterId = options.semesterId;
    }
    if (options.prodiId && options.prodiId !== "ALL") {
      whereKelas.mataKuliah = { prodiId: options.prodiId };
    }

    // Ambil list ID kelas yang akan dihapus
    const targetedKelas = await prisma.kelas.findMany({
      where: whereKelas,
      select: { id: true, mataKuliahId: true },
    });

    const targetKelasIds = targetedKelas.map((k) => k.id);
    const kelasCount = targetKelasIds.length;

    if (kelasCount === 0) {
      return {
        success: true,
        countKelas: 0,
        countSesi: 0,
        countMk: 0,
        message: "Tidak ada data kelas yang cocok dengan filter yang dipilih.",
      };
    }

    // Hitung sesi yang ikut terhapus
    const sesiCount = await prisma.monitoringSesi.count({
      where: { kelasId: { in: targetKelasIds } },
    });

    // Eksekusi penghapusan kelas secara batch (onDelete: Cascade otomatis menghapus monitoringSesi dan laporanCdu)
    await prisma.kelas.deleteMany({
      where: { id: { in: targetKelasIds } },
    });

    // Jika user menghendaki pembersihan MK kosong
    let countMk = 0;
    if (options.cleanupEmptyMk) {
      const whereMk: any = {
        kelas: { none: {} },
      };
      if (options.prodiId && options.prodiId !== "ALL") {
        whereMk.prodiId = options.prodiId;
      }

      const deletedMks = await prisma.mataKuliah.deleteMany({
        where: whereMk,
      });
      countMk = deletedMks.count;
    }

    await invalidateLaporanCache();
    revalidatePath("/master/kelas");
    revalidatePath("/master/mata-kuliah");
    revalidatePath("/monitoring");
    revalidatePath("/");

    return {
      success: true,
      countKelas: kelasCount,
      countSesi: sesiCount,
      countMk,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal membersihkan data perkuliahan" };
  }
}

