// scripts/backup-db.ts
// Script untuk backup otomatis seluruh data Neon ke file JSON lokal

import { prisma } from "../src/lib/prisma";
import * as fs from "fs";
import * as path from "path";

async function backup() {
  console.log("=== MEMULAI BACKUP DATA NEON KE LOKAL ===");
  const backupDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `cdu-backup-${timestamp}.json`;
  const filePath = path.join(backupDir, filename);

  console.log("1. Mengambil data master dan transaksi...");
  const [
    semesters,
    liburSemesters,
    fakultas,
    prodis,
    users,
    dosens,
    mataKuliahs,
    kelas,
    monitoringSesi,
    laporCdus,
  ] = await Promise.all([
    prisma.semester.findMany(),
    prisma.liburSemester.findMany(),
    prisma.fakultas.findMany(),
    prisma.prodi.findMany(),
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true } }),
    prisma.dosen.findMany(),
    prisma.mataKuliah.findMany(),
    prisma.kelas.findMany(),
    prisma.monitoringSesi.findMany(),
    prisma.laporCdu.findMany(),
  ]);

  const backupData = {
    metadata: {
      timestamp: new Date().toISOString(),
      counts: {
        semesters: semesters.length,
        liburSemesters: liburSemesters.length,
        fakultas: fakultas.length,
        prodis: prodis.length,
        users: users.length,
        dosens: dosens.length,
        mataKuliahs: mataKuliahs.length,
        kelas: kelas.length,
        monitoringSesi: monitoringSesi.length,
        laporCdus: laporCdus.length,
      },
    },
    data: {
      semesters,
      liburSemesters,
      fakultas,
      prodis,
      users,
      dosens,
      mataKuliahs,
      kelas,
      monitoringSesi,
      laporCdus,
    },
  };

  fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), "utf8");
  const stats = fs.statSync(filePath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`=== BACKUP SUKSES TERSIMPAN! ===`);
  console.log(`Lokasi: ${filePath}`);
  console.log(`Ukuran File: ${sizeMB} MB`);
  console.log(`Ringkasan: ${kelas.length} Kelas, ${monitoringSesi.length} Sesi, ${dosens.length} Dosen tersimpan aman.`);
}

backup()
  .catch((e) => console.error("Backup error:", e))
  .finally(async () => await prisma.$disconnect());
