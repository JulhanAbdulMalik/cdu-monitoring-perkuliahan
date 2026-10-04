// scripts/export-backup-all.ts
// Comprehensive Backup Script for Neon.tech Database
// Exports to:
// 1. backups/neon-cdu-backup-[timestamp].sql
// 2. backups/neon-cdu-backup-[timestamp].xlsx

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import ExcelJS from "exceljs";

const NEON_DIRECT_URL =
  "postgresql://neondb_owner:npg_fcvHmLBPhn43@ep-crimson-heart-b3076drq.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: NEON_DIRECT_URL,
    },
  },
});

function escapeSqlValue(val: any): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === "string") {
    return `'${val.replace(/'/g, "''")}'`;
  }
  if (Array.isArray(val)) {
    const elements = val.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",");
    return `'{${elements}}'`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

function generateInsertStatements(
  tableName: string,
  columns: string[],
  rows: any[]
): string {
  if (rows.length === 0) return `-- No data in ${tableName}\n\n`;

  const header = `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES\n`;
  const chunks: string[] = [];
  const chunkSize = 200; // insert in chunks of 200

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const valueLines = chunk.map((row) => {
      const values = columns.map((col) => escapeSqlValue(row[col]));
      return `  (${values.join(", ")})`;
    });
    chunks.push(header + valueLines.join(",\n") + ";\n");
  }

  return chunks.join("\n") + "\n";
}

async function exportAll() {
  console.log("==================================================");
  console.log("  MEMULAI EXPORT LENGKAP NEON (.SQL & .XLSX)     ");
  console.log("==================================================");

  const backupDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const sqlFilename = `neon-cdu-backup-${timestamp}.sql`;
  const xlsxFilename = `neon-cdu-backup-${timestamp}.xlsx`;
  const sqlPath = path.join(backupDir, sqlFilename);
  const xlsxPath = path.join(backupDir, xlsxFilename);

  console.log("1. Mengambil seluruh data dari Neon.tech...");
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
    prisma.semester.findMany({ orderBy: { id: "asc" } }),
    prisma.liburSemester.findMany({ orderBy: { id: "asc" } }),
    prisma.fakultas.findMany({ orderBy: { id: "asc" } }),
    prisma.prodi.findMany({ orderBy: { id: "asc" } }),
    prisma.user.findMany({ orderBy: { id: "asc" } }), // includes password hash
    prisma.dosen.findMany({ orderBy: { id: "asc" } }),
    prisma.mataKuliah.findMany({ orderBy: { id: "asc" } }),
    prisma.kelas.findMany({ orderBy: { id: "asc" } }),
    prisma.monitoringSesi.findMany({ orderBy: { id: "asc" } }),
    prisma.laporCdu.findMany({ orderBy: { id: "asc" } }),
  ]);

  // Implicit many-to-many _UserProdis
  let userProdis: { A: string; B: string }[] = [];
  try {
    userProdis = (await prisma.$queryRawUnsafe(
      'SELECT "A", "B" FROM "_UserProdis"'
    )) as { A: string; B: string }[];
  } catch (err) {
    console.warn("Catatan: _UserProdis tidak ditemukan atau kosong.");
  }

  console.log("-> Rekap Data Neon:");
  console.log(`   - Users: ${users.length}`);
  console.log(`   - User-Prodi Relations: ${userProdis.length}`);
  console.log(`   - Semester: ${semesters.length}`);
  console.log(`   - Libur Semester: ${liburSemesters.length}`);
  console.log(`   - Fakultas: ${fakultas.length}`);
  console.log(`   - Prodi: ${prodis.length}`);
  console.log(`   - Dosen: ${dosens.length}`);
  console.log(`   - Mata Kuliah: ${mataKuliahs.length}`);
  console.log(`   - Kelas: ${kelas.length}`);
  console.log(`   - Monitoring Sesi: ${monitoringSesi.length}`);
  console.log(`   - Lapor CDU: ${laporCdus.length}`);

  // ─────────────────────────────────────────────────────────────
  // 2. GENERATE .SQL FILE
  // ─────────────────────────────────────────────────────────────
  console.log("\n2. Membuat file SQL dump...");
  let sqlContent = `-- ==========================================================\n`;
  sqlContent += `-- BACKUP PENUH DATABASE NEON.TECH (CDU Portal)\n`;
  sqlContent += `-- Tanggal: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}\n`;
  sqlContent += `-- Server Asal: Neon.tech (PostgreSQL 16)\n`;
  sqlContent += `-- ==========================================================\n\n`;
  sqlContent += `BEGIN;\n\n`;

  // Matikan foreign key check sementara agar restore fleksibel
  sqlContent += `SET CONSTRAINTS ALL DEFERRED;\n\n`;

  // 1. Fakultas
  sqlContent += `-- Table: Fakultas (${fakultas.length} rows)\n`;
  sqlContent += generateInsertStatements(
    "Fakultas",
    ["id", "nama", "createdAt"],
    fakultas
  );

  // 2. Prodi
  sqlContent += `-- Table: Prodi (${prodis.length} rows)\n`;
  sqlContent += generateInsertStatements(
    "Prodi",
    ["id", "nama", "kode", "fakultasId", "createdAt"],
    prodis
  );

  // 3. User
  sqlContent += `-- Table: User (${users.length} rows)\n`;
  sqlContent += generateInsertStatements(
    "User",
    ["id", "name", "email", "password", "role", "createdAt", "updatedAt"],
    users
  );

  // 4. _UserProdis
  if (userProdis.length > 0) {
    sqlContent += `-- Table: _UserProdis (${userProdis.length} rows)\n`;
    sqlContent += generateInsertStatements("_UserProdis", ["A", "B"], userProdis);
  }

  // 5. Semester
  sqlContent += `-- Table: Semester (${semesters.length} rows)\n`;
  sqlContent += generateInsertStatements(
    "Semester",
    ["id", "tahunAkademik", "periode", "aktif", "tanggalMulai", "createdAt"],
    semesters
  );

  // 6. LiburSemester
  sqlContent += `-- Table: LiburSemester (${liburSemesters.length} rows)\n`;
  sqlContent += generateInsertStatements(
    "LiburSemester",
    ["id", "semesterId", "nama", "tanggalMulai", "tanggalSelesai", "keterangan", "createdAt", "updatedAt"],
    liburSemesters
  );

  // 7. Dosen
  sqlContent += `-- Table: Dosen (${dosens.length} rows)\n`;
  sqlContent += generateInsertStatements(
    "Dosen",
    ["id", "nama", "nidn", "email", "prodiId", "createdAt", "updatedAt"],
    dosens
  );

  // 8. MataKuliah
  sqlContent += `-- Table: MataKuliah (${mataKuliahs.length} rows)\n`;
  sqlContent += generateInsertStatements(
    "MataKuliah",
    ["id", "kode", "nama", "sks", "prodiId", "createdAt"],
    mataKuliahs
  );

  // 9. Kelas
  sqlContent += `-- Table: Kelas (${kelas.length} rows)\n`;
  sqlContent += generateInsertStatements(
    "Kelas",
    [
      "id",
      "kodeKelas",
      "semesterId",
      "mataKuliahId",
      "dosenId",
      "jadwalHari",
      "jadwalJam",
      "ruangan",
      "modePembelajaran",
      "createdAt",
      "updatedAt",
    ],
    kelas
  );

  // 10. MonitoringSesi
  sqlContent += `-- Table: MonitoringSesi (${monitoringSesi.length} rows)\n`;
  sqlContent += generateInsertStatements(
    "MonitoringSesi",
    [
      "id",
      "kelasId",
      "nomorSesi",
      "jenisSesi",
      "tanggal",
      "kehadiran",
      "lectureNote",
      "slide",
      "video",
      "conference",
      "tugas",
      "kuis",
      "dosenPengajarId",
      "statusPengajar",
      "catatanGantiDosen",
      "catatanCdu",
      "sumberData",
      "inputOlehId",
      "createdAt",
      "updatedAt",
    ],
    monitoringSesi
  );

  // 11. LaporCdu
  if (laporCdus.length > 0) {
    sqlContent += `-- Table: LaporCdu (${laporCdus.length} rows)\n`;
    sqlContent += generateInsertStatements(
      "LaporCdu",
      [
        "id",
        "kelasId",
        "nomorSesi",
        "prodiId",
        "pelaporId",
        "kategori",
        "keterangan",
        "tautanBukti",
        "status",
        "catatanCdu",
        "diprosesOlehId",
        "tanggalDiproses",
        "createdAt",
        "updatedAt",
      ],
      laporCdus
    );
  }

  sqlContent += `COMMIT;\n`;

  fs.writeFileSync(sqlPath, sqlContent, "utf8");
  const sqlStats = fs.statSync(sqlPath);
  console.log(`   ✔ File SQL tersimpan: ${sqlFilename} (${(sqlStats.size / (1024 * 1024)).toFixed(2)} MB)`);

  // ─────────────────────────────────────────────────────────────
  // 3. GENERATE .XLSX FILE (EXCEL)
  // ─────────────────────────────────────────────────────────────
  console.log("\n3. Membuat file Excel (.xlsx)...");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CDU System";
  workbook.created = new Date();

  // Helper untuk format styling sheet
  const setupSheet = (
    name: string,
    columns: { header: string; key: string; width: number }[],
    rows: any[]
  ) => {
    const ws = workbook.addWorksheet(name);
    ws.columns = columns;

    // Header styling
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFA80063" }, // Brand CDU magenta
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 24;

    // Add rows
    rows.forEach((row) => {
      const formattedRow: any = {};
      columns.forEach((col) => {
        let val = row[col.key];
        if (val instanceof Date) {
          formattedRow[col.key] = val.toISOString().replace("T", " ").substring(0, 19);
        } else if (typeof val === "boolean") {
          formattedRow[col.key] = val ? "YA" : "TIDAK";
        } else if (val === null || val === undefined) {
          formattedRow[col.key] = "";
        } else {
          formattedRow[col.key] = val;
        }
      });
      ws.addRow(formattedRow);
    });

    ws.views = [{ state: "frozen", ySplit: 1 }];
    return ws;
  };

  // Sheet 1: RINGKASAN
  const wsSummary = workbook.addWorksheet("Ringkasan");
  wsSummary.columns = [
    { header: "Nama Entitas / Tabel", key: "entitas", width: 30 },
    { header: "Jumlah Data (Baris)", key: "jumlah", width: 25 },
  ];
  wsSummary.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  wsSummary.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  wsSummary.addRows([
    { entitas: "Kelas", jumlah: kelas.length },
    { entitas: "Monitoring Sesi", jumlah: monitoringSesi.length },
    { entitas: "Dosen", jumlah: dosens.length },
    { entitas: "Mata Kuliah", jumlah: mataKuliahs.length },
    { entitas: "User Akun", jumlah: users.length },
    { entitas: "Fakultas", jumlah: fakultas.length },
    { entitas: "Program Studi", jumlah: prodis.length },
    { entitas: "Semester", jumlah: semesters.length },
    { entitas: "Libur Semester", jumlah: liburSemesters.length },
    { entitas: "Lapor CDU", jumlah: laporCdus.length },
    { entitas: "Waktu Backup", jumlah: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) },
  ]);

  // Sheet 2: Users
  setupSheet(
    "Users",
    [
      { header: "ID", key: "id", width: 30 },
      { header: "Nama", key: "name", width: 30 },
      { header: "Email", key: "email", width: 35 },
      { header: "Role", key: "role", width: 18 },
      { header: "Dibuat Pada", key: "createdAt", width: 22 },
    ],
    users
  );

  // Sheet 3: Dosen
  setupSheet(
    "Dosen",
    [
      { header: "ID", key: "id", width: 30 },
      { header: "Nama Dosen", key: "nama", width: 35 },
      { header: "NIDN", key: "nidn", width: 20 },
      { header: "Email", key: "email", width: 30 },
      { header: "Prodi ID", key: "prodiId", width: 30 },
    ],
    dosens
  );

  // Sheet 4: Mata Kuliah
  setupSheet(
    "MataKuliah",
    [
      { header: "ID", key: "id", width: 30 },
      { header: "Kode MK", key: "kode", width: 15 },
      { header: "Nama Mata Kuliah", key: "nama", width: 40 },
      { header: "SKS", key: "sks", width: 10 },
      { header: "Prodi ID", key: "prodiId", width: 30 },
    ],
    mataKuliahs
  );

  // Sheet 5: Kelas
  setupSheet(
    "Kelas",
    [
      { header: "ID", key: "id", width: 30 },
      { header: "Kode Kelas", key: "kodeKelas", width: 15 },
      { header: "Semester ID", key: "semesterId", width: 30 },
      { header: "Mata Kuliah ID", key: "mataKuliahId", width: 30 },
      { header: "Dosen ID", key: "dosenId", width: 30 },
      { header: "Hari", key: "jadwalHari", width: 15 },
      { header: "Jam", key: "jadwalJam", width: 20 },
      { header: "Ruangan", key: "ruangan", width: 15 },
      { header: "Mode", key: "modePembelajaran", width: 15 },
    ],
    kelas
  );

  // Sheet 6: Monitoring Sesi (23k+ baris)
  setupSheet(
    "MonitoringSesi",
    [
      { header: "ID", key: "id", width: 30 },
      { header: "Kelas ID", key: "kelasId", width: 30 },
      { header: "Sesi Ke", key: "nomorSesi", width: 10 },
      { header: "Jenis Sesi", key: "jenisSesi", width: 12 },
      { header: "Kehadiran", key: "kehadiran", width: 20 },
      { header: "Modul", key: "lectureNote", width: 10 },
      { header: "Slide", key: "slide", width: 10 },
      { header: "Video", key: "video", width: 10 },
      { header: "Conference", key: "conference", width: 12 },
      { header: "Tugas", key: "tugas", width: 10 },
      { header: "Kuis", key: "kuis", width: 10 },
      { header: "Dosen Pengajar ID", key: "dosenPengajarId", width: 30 },
      { header: "Status Pengajar", key: "statusPengajar", width: 20 },
      { header: "Catatan CDU", key: "catatanCdu", width: 30 },
      { header: "Sumber Data", key: "sumberData", width: 15 },
      { header: "Tanggal", key: "tanggal", width: 22 },
    ],
    monitoringSesi
  );

  // Sheet 7: Fakultas & Prodi
  setupSheet(
    "Prodi",
    [
      { header: "ID", key: "id", width: 30 },
      { header: "Kode Prodi", key: "kode", width: 15 },
      { header: "Nama Prodi", key: "nama", width: 35 },
      { header: "Fakultas ID", key: "fakultasId", width: 30 },
    ],
    prodis
  );

  setupSheet(
    "Fakultas",
    [
      { header: "ID", key: "id", width: 30 },
      { header: "Nama Fakultas", key: "nama", width: 40 },
    ],
    fakultas
  );

  // Sheet 8: Semester
  setupSheet(
    "Semester",
    [
      { header: "ID", key: "id", width: 30 },
      { header: "Tahun Akademik", key: "tahunAkademik", width: 20 },
      { header: "Periode", key: "periode", width: 15 },
      { header: "Status Aktif", key: "aktif", width: 15 },
      { header: "Tanggal Mulai", key: "tanggalMulai", width: 22 },
    ],
    semesters
  );

  // Sheet 9: Libur Semester
  setupSheet(
    "LiburSemester",
    [
      { header: "ID", key: "id", width: 30 },
      { header: "Semester ID", key: "semesterId", width: 30 },
      { header: "Nama Libur", key: "nama", width: 30 },
      { header: "Tgl Mulai", key: "tanggalMulai", width: 20 },
      { header: "Tgl Selesai", key: "tanggalSelesai", width: 20 },
      { header: "Keterangan", key: "keterangan", width: 30 },
    ],
    liburSemesters
  );

  // Sheet 10: Lapor CDU
  if (laporCdus.length > 0) {
    setupSheet(
      "LaporCDU",
      [
        { header: "ID", key: "id", width: 30 },
        { header: "Kelas ID", key: "kelasId", width: 30 },
        { header: "Sesi", key: "nomorSesi", width: 8 },
        { header: "Prodi ID", key: "prodiId", width: 30 },
        { header: "Pelapor ID", key: "pelaporId", width: 30 },
        { header: "Kategori", key: "kategori", width: 20 },
        { header: "Keterangan", key: "keterangan", width: 40 },
        { header: "Status", key: "status", width: 15 },
        { header: "Catatan CDU", key: "catatanCdu", width: 30 },
      ],
      laporCdus
    );
  }

  await workbook.xlsx.writeFile(xlsxPath);
  const xlsxStats = fs.statSync(xlsxPath);
  console.log(`   ✔ File Excel tersimpan: ${xlsxFilename} (${(xlsxStats.size / (1024 * 1024)).toFixed(2)} MB)`);

  console.log("\n==================================================");
  console.log("  BACKUP SELESAI DENGAN SUKSES!                   ");
  console.log(`  Lokasi Folder: ${backupDir}`);
  console.log(`  1. SQL:   ${sqlFilename}`);
  console.log(`  2. Excel: ${xlsxFilename}`);
  console.log("==================================================");
}

exportAll()
  .catch((e) => {
    console.error("Fatal Export Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
