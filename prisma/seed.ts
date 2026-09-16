// prisma/seed.ts
// Seed data awal: admin user + contoh data semester

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Memulai seed database...");

  // ── 1. Buat / Update Super Admin User ──────────────────────────────────────────
  const existingAdmin = await prisma.user.findUnique({
    where: { email: "admin@nusaputra.ac.id" },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await prisma.user.create({
      data: {
        name: "Super Admin CDU",
        email: "admin@nusaputra.ac.id",
        password: hashedPassword,
        role: "SUPER_ADMIN",
      },
    });
    console.log("✅ Super Admin user dibuat: admin@nusaputra.ac.id / admin123");
  } else {
    await prisma.user.update({
      where: { email: "admin@nusaputra.ac.id" },
      data: { role: "SUPER_ADMIN", name: "Super Admin CDU" },
    });
    console.log("ℹ️  Admin user diupdate menjadi SUPER_ADMIN: admin@nusaputra.ac.id");
  }

  // ── 2. Buat CDU Staff User ──────────────────────────────────────────────────
  const existingCdu = await prisma.user.findUnique({
    where: { email: "cdu@nusaputra.ac.id" },
  });

  if (!existingCdu) {
    const hashedPassword = await bcrypt.hash("cdu123", 10);
    await prisma.user.create({
      data: {
        name: "Staff CDU",
        email: "cdu@nusaputra.ac.id",
        password: hashedPassword,
        role: "ADMIN",
      },
    });
    console.log("✅ Admin CDU dibuat: cdu@nusaputra.ac.id / cdu123");
  } else {
    console.log("ℹ️  CDU Staff sudah ada, skip.");
  }

  // ── 3. Semester Aktif ───────────────────────────────────────────────────────
  const existingSemester = await prisma.semester.findFirst({
    where: { tahunAkademik: "2025/2026", periode: "GANJIL" },
  });

  let semester;
  if (!existingSemester) {
    semester = await prisma.semester.create({
      data: {
        tahunAkademik: "2025/2026",
        periode: "GANJIL",
        aktif: true,
      },
    });
    console.log("✅ Semester aktif dibuat: 2025/2026 Ganjil");
  } else {
    semester = existingSemester;
    console.log("ℹ️  Semester sudah ada, skip.");
  }

  // ── 4. Contoh Fakultas ──────────────────────────────────────────────────────
  const fakultas = await prisma.fakultas.upsert({
    where: { nama: "Fakultas Teknologi dan Informatika" },
    create: { nama: "Fakultas Teknologi dan Informatika" },
    update: {},
  });

  const fakultasBisnis = await prisma.fakultas.upsert({
    where: { nama: "Fakultas Bisnis dan Humaniora" },
    create: { nama: "Fakultas Bisnis dan Humaniora" },
    update: {},
  });

  console.log("✅ Fakultas dibuat");

  // ── 5. Contoh Prodi ─────────────────────────────────────────────────────────
  const prodiTI = await prisma.prodi.upsert({
    where: { kode: "TI" },
    create: {
      nama: "Teknik Informatika",
      kode: "TI",
      fakultasId: fakultas.id,
    },
    update: {},
  });

  const prodiMN = await prisma.prodi.upsert({
    where: { kode: "MN" },
    create: {
      nama: "Manajemen",
      kode: "MN",
      fakultasId: fakultasBisnis.id,
    },
    update: {},
  });

  console.log("✅ Prodi dibuat: TI, MN");

  // ── 6. Contoh Dosen ─────────────────────────────────────────────────────────
  const dosen1 = await prisma.dosen.upsert({
    where: { nidn: "0000000001" },
    create: {
      nama: "Dr. Contoh Dosen, S.T., M.Kom.",
      nidn: "0000000001",
      email: "dosen1@nusaputra.ac.id",
      prodiId: prodiTI.id,
    },
    update: {},
  });

  console.log("✅ Contoh dosen dibuat");

  // ── 7. Contoh Mata Kuliah ───────────────────────────────────────────────────
  const mk1 = await prisma.mataKuliah.upsert({
    where: { kode_prodiId: { kode: "TI001", prodiId: prodiTI.id } },
    create: {
      kode: "TI001",
      nama: "Pemrograman Web",
      sks: 3,
      prodiId: prodiTI.id,
    },
    update: {},
  });

  console.log("✅ Contoh mata kuliah dibuat");

  // ── 8. Contoh Kelas ─────────────────────────────────────────────────────────
  const kelasExisting = await prisma.kelas.findFirst({
    where: {
      kodeKelas: "TI24A",
      semesterId: semester.id,
      mataKuliahId: mk1.id,
    },
  });

  if (!kelasExisting) {
    const kelas = await prisma.kelas.create({
      data: {
        kodeKelas: "TI24A",
        semesterId: semester.id,
        mataKuliahId: mk1.id,
        dosenId: dosen1.id,
        jadwalHari: "Senin",
        jadwalJam: "08:00 - 09:40",
        modePembelajaran: "DARING",
      },
    });

    // Buat 16 sesi monitoring default
    const sesiList = Array.from({ length: 16 }, (_, i) => {
      const nomorSesi = i + 1;
      const isUTSUAS = nomorSesi === 8 || nomorSesi === 16;
      return {
        kelasId: kelas.id,
        nomorSesi,
        jenisSesi: nomorSesi === 8 ? ("UTS" as const) : nomorSesi === 16 ? ("UAS" as const) : ("REGULER" as const),
        kehadiran: "BELUM_DIISI" as const,
        lectureNote: isUTSUAS ? null : false,
        slide: isUTSUAS ? null : false,
        video: isUTSUAS ? null : false,
        conference: isUTSUAS ? null : false,
        tugas: isUTSUAS ? null : false,
        kuis: isUTSUAS ? null : false,
      };
    });

    await prisma.monitoringSesi.createMany({ data: sesiList });
    console.log("✅ Contoh kelas TI24A dibuat dengan 16 sesi monitoring");
  } else {
    console.log("ℹ️  Kelas TI24A sudah ada, skip.");
  }

  console.log("\n🎉 Seed selesai!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Login Admin  : admin@nusaputra.ac.id / admin123");
  console.log("Login CDU    : cdu@nusaputra.ac.id / cdu123");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((e) => {
    console.error("❌ Seed gagal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
