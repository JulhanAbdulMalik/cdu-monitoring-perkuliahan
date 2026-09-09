// src/lib/template-generator.ts
// Utility to generate and download Master Data Excel Templates (.xlsx)

import * as XLSX from "xlsx";

export function generateTemplate(type: "dosen" | "mata-kuliah" | "kelas" | "prodi" | "semester") {
  const wb = XLSX.utils.book_new();

  if (type === "dosen") {
    const data = [
      ["Nama Lengkap & Gelar", "NIDN", "Email", "Kode Prodi"],
      ["Dr. Fajar Nugraha, S.T., M.Kom.", "0412345601", "fajar@nusaputra.ac.id", "TI"],
      ["Siti Rahmawati, M.M.", "0412345602", "siti@nusaputra.ac.id", "MN"],
      ["Budi Santoso, S.Kom., M.T.", "0412345603", "budi@nusaputra.ac.id", "SI"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 32 }, { wch: 15 }, { wch: 25 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Template_Dosen");
  } else if (type === "mata-kuliah") {
    const data = [
      ["Kode MK", "Nama Mata Kuliah", "SKS", "Kode Prodi"],
      ["IF2101", "Pemrograman Web Lanjut", 3, "TI"],
      ["IF2102", "Struktur Data & Algoritma", 3, "TI"],
      ["MN101", "Pengantar Manajemen Bisnis", 3, "MN"],
      ["SI201", "Analisis & Perancangan Sistem", 4, "SI"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 12 }, { wch: 32 }, { wch: 8 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Template_Mata_Kuliah");
  } else if (type === "kelas") {
    const data = [
      [
        "Kode Mata Kuliah",
        "Mata Kuliah",
        "SKS",
        "Kode Program Studi",
        "Nama Kelas",
        "Pengajar",
        "Hari Perkuliahan",
        "Jam Perkuliahan",
        "Ruang Kelas",
        "Mode Pembelajaran",
      ],
      [
        "25TI11005",
        "Kalkulus",
        2,
        "Teknik Informatika",
        "TI26I",
        "Lusiana Sani Parwati S. Pd. M. Mat",
        "Senin",
        "14:10 s.d 17:50",
        "B4A",
        "Offline",
      ],
      [
        "25TI11002",
        "Pemrograman Web",
        2,
        "Teknik Informatika",
        "TI26A",
        "Julhan Abdul Malik, S.Kom",
        "Senin",
        "09:10 s.d 10:50",
        "B5C",
        "Offline",
      ],
      [
        "25PG11002",
        "Matematika untuk Guru Sekolah Dasar",
        2,
        "Pendidikan Guru Sekolah Dasar",
        "PG26C",
        "Prof. Hirlan Maulana, Ph.D",
        "Sabtu",
        "09:10 s.d 10:50",
        "-",
        "Online",
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [
      { wch: 18 },
      { wch: 30 },
      { wch: 8 },
      { wch: 22 },
      { wch: 14 },
      { wch: 30 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Template_Perkuliahan");
  } else if (type === "prodi") {
    const data = [
      ["Nama Fakultas", "Kode Prodi", "Nama Program Studi"],
      ["Fakultas Ilmu Komputer", "TI", "Teknik Informatika"],
      ["Fakultas Ilmu Komputer", "SI", "Sistem Informasi"],
      ["Fakultas Ekonomi dan Bisnis", "MN", "Manajemen"],
      ["Fakultas Teknik", "TS", "Teknik Sipil"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, ws, "Template_Prodi");
  } else if (type === "semester") {
    const data = [
      ["Tahun Akademik", "Periode", "Aktif"],
      ["2025/2026", "GANJIL", "YA"],
      ["2025/2026", "GENAP", "TIDAK"],
      ["2024/2025", "GENAP", "TIDAK"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 16 }, { wch: 10 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws, "Template_Semester");
  }

  // Trigger download in browser
  XLSX.writeFile(wb, `Template_Import_${type.toUpperCase()}.xlsx`);
}
