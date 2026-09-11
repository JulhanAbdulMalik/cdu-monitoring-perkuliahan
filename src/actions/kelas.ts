"use server";
// src/actions/kelas.ts
// Server Actions untuk CRUD Data Kelas & Auto Generate 16 Monitoring Sessions

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
    const activeSemester = await prisma.semester.findFirst({
      where: { aktif: true },
    });

    const targetSemesterId = semesterId || activeSemester?.id;

    const kelas = await prisma.kelas.findMany({
      where: targetSemesterId ? { semesterId: targetSemesterId } : {},
      include: {
        semester: true,
        mataKuliah: {
          include: { prodi: true },
        },
        dosen: true,
        monitoringSesi: {
          orderBy: { nomorSesi: "asc" },
        },
      },
      orderBy: [{ mataKuliah: { prodi: { nama: "asc" } } }, { kodeKelas: "asc" }],
    });

    const allSemesters = await prisma.semester.findMany({
      orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
    });

    const allMataKuliah = await prisma.mataKuliah.findMany({
      include: { prodi: true },
      orderBy: [{ prodi: { nama: "asc" } }, { nama: "asc" }],
    });

    const allDosen = await prisma.dosen.findMany({
      include: { prodi: true },
      orderBy: { nama: "asc" },
    });

    const allProdi = await prisma.prodi.findMany({
      orderBy: { nama: "asc" },
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

    revalidatePath("/master/kelas");
    revalidatePath("/monitoring");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menghapus kelas" };
  }
}
