// scripts/remediate-mismatched-classes.ts
// Script perbaikan data kelas yang sebelumnya salah terhubung ke Mata Kuliah prodi lain

import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("=== MEMULAI PERBAIKAN DATA KELAS TERHUBUNG KE PRODI YANG SALAH ===");

  const prodiManajemen = await prisma.prodi.findFirst({
    where: { nama: { equals: "Manajemen", mode: "insensitive" } },
  });
  const prodiGizi = await prisma.prodi.findFirst({
    where: { nama: { equals: "Gizi", mode: "insensitive" } },
  });

  if (!prodiManajemen || !prodiGizi) {
    console.error("Prodi Manajemen atau Gizi tidak ditemukan!");
    return;
  }

  // 1. Ambil semua kelas yang prefix kodenya tidak cocok dengan prodi Mata Kuliah
  const allKelas = await prisma.kelas.findMany({
    include: {
      mataKuliah: {
        include: { prodi: true },
      },
    },
  });

  const mismatchedKelas = allKelas.filter((k) => {
    const prefix = k.kodeKelas.substring(0, 2);
    if (prefix === "MN" && k.mataKuliah.prodi.nama !== "Manajemen") return true;
    if (prefix === "GZ" && k.mataKuliah.prodi.nama !== "Gizi") return true;
    return false;
  });

  console.log(`Ditemukan ${mismatchedKelas.length} kelas yang terhubung ke prodi salah.`);

  // Mapping kode MK spesifik per prodi
  const MK_MAP_MANAJEMEN: Record<string, { kode: string; sks: number }> = {
    "Pengantar Manajemen": { kode: "25MN11001", sks: 3 },
    "Pengantar Akuntansi": { kode: "25MN11004", sks: 3 },
    "Pendidikan Kewarganegaraan": { kode: "25WN10002", sks: 2 },
    "Bahasa Inggris Akademik": { kode: "25WU11001", sks: 2 },
    "Manajemen Keuangan": { kode: "25MN21011", sks: 3 },
    "Agama dan Etika": { kode: "25WN20004", sks: 2 },
    "Filsafat Ilmu": { kode: "FB41002", sks: 2 },
    "Metodologi Penelitian": { kode: "MN31026", sks: 3 },
  };

  const MK_MAP_GIZI: Record<string, { kode: string; sks: number }> = {
    "Biologi Dasar": { kode: "26GZ11001", sks: 2 },
    "Bahasa Inggris Akademik": { kode: "25WU11001", sks: 2 },
    "Pendidikan Kewarganegaraan": { kode: "25WN10002", sks: 2 },
  };

  let fixedCount = 0;

  for (const k of mismatchedKelas) {
    const prefix = k.kodeKelas.substring(0, 2);
    const targetProdi = prefix === "MN" ? prodiManajemen : prodiGizi;
    const mapping = prefix === "MN" ? MK_MAP_MANAJEMEN : MK_MAP_GIZI;

    const mkNama = k.mataKuliah.nama;
    const mappedInfo = mapping[mkNama];

    const targetKode = mappedInfo ? mappedInfo.kode : k.mataKuliah.kode;
    const targetSks = mappedInfo ? mappedInfo.sks : k.mataKuliah.sks;

    // Cari atau buat Mata Kuliah di target prodi
    let correctMk = await prisma.mataKuliah.findFirst({
      where: {
        prodiId: targetProdi.id,
        OR: [
          { kode: targetKode },
          { nama: { equals: mkNama, mode: "insensitive" } },
        ],
      },
    });

    if (!correctMk) {
      correctMk = await prisma.mataKuliah.create({
        data: {
          kode: targetKode,
          nama: mkNama,
          sks: targetSks,
          prodiId: targetProdi.id,
        },
      });
      console.log(`[MK BARU] Dibuat MK "${targetKode} - ${mkNama}" di Prodi ${targetProdi.nama}`);
    }

    // Update kelas agar terhubung ke correctMk
    await prisma.kelas.update({
      where: { id: k.id },
      data: {
        mataKuliahId: correctMk.id,
      },
    });

    fixedCount++;
    console.log(
      `[REPAIR] Kelas ${k.kodeKelas} (${mkNama}) dipindahkan dari Prodi "${k.mataKuliah.prodi.nama}" ke "${targetProdi.nama}" (MK ID: ${correctMk.id})`
    );
  }

  console.log(`\n=== SUKSES: Berhasil memperbaiki ${fixedCount} data kelas! ===`);
}

main()
  .catch((e) => {
    console.error("Error executing remediation:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
