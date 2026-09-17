// src/types/index.ts
// TypeScript type definitions untuk CDU Monitoring

// ─────────────────────────────────────────
// Enums (mirror dari Prisma schema)
// ─────────────────────────────────────────

export type Role = "ADMIN" | "CDU_STAFF";
export type Periode = "GANJIL" | "GENAP";
export type ModePembelajaran = "DARING" | "LURING" | "BIMBINGAN";
export type JenisSesi = "REGULER" | "UTS" | "UAS";
export type Kehadiran =
  | "HADIR"
  | "TIDAK_HADIR"
  | "HADIR_TIDAK_LENGKAP"
  | "BELUM_DIISI";
export type SumberData = "MANUAL" | "IMPORT_EXCEL";

export const LABEL_MODE_PEMBELAJARAN: Record<string, string> = {
  DARING: "Online",
  LURING: "Offline",
  BIMBINGAN: "Bimbingan",
};

// ─────────────────────────────────────────
// Session / Auth
// ─────────────────────────────────────────

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

// ─────────────────────────────────────────
// Data Master
// ─────────────────────────────────────────

export interface Semester {
  id: string;
  tahunAkademik: string;
  periode: Periode;
  aktif: boolean;
  createdAt: string;
}

export interface Fakultas {
  id: string;
  nama: string;
  createdAt: string;
}

export interface Prodi {
  id: string;
  nama: string;
  kode: string;
  fakultasId: string;
  fakultas?: Fakultas;
  createdAt: string;
}

export interface Dosen {
  id: string;
  nama: string;
  nidn?: string;
  email?: string;
  prodiId: string;
  prodi?: Prodi;
  createdAt: string;
  updatedAt: string;
}

export interface MataKuliah {
  id: string;
  kode: string;
  nama: string;
  sks: number;
  prodiId: string;
  prodi?: Prodi;
  createdAt: string;
}

export interface Kelas {
  id: string;
  kodeKelas: string;
  semesterId: string;
  mataKuliahId: string;
  dosenId: string;
  jadwalHari?: string;
  jadwalJam?: string;
  modePembelajaran: ModePembelajaran;
  createdAt: string;
  updatedAt: string;

  // Relations
  semester?: Semester;
  mataKuliah?: MataKuliah;
  dosen?: Dosen;
  monitoringSesi?: MonitoringSesi[];
}

// ─────────────────────────────────────────
// Monitoring
// ─────────────────────────────────────────

export interface MonitoringSesi {
  id: string;
  kelasId: string;
  nomorSesi: number;
  jenisSesi: JenisSesi;
  tanggal?: string;

  // Kehadiran (manual CDU)
  kehadiran: Kehadiran;

  // Konten (dari import Excel - boolean | null)
  lectureNote: boolean | null;
  slide: boolean | null;
  video: boolean | null;
  conference: boolean | null;
  tugas: boolean | null;
  kuis: boolean | null;

  // Dosen Pengajar Sesi (Ganti Dosen / Dosen Baru)
  dosenPengajarId?: string | null;
  statusPengajar?: "UTAMA" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP";
  catatanGantiDosen?: string | null;

  // Metadata
  catatanCdu?: string;
  sumberData: SumberData;
  inputOlehId?: string;
  createdAt: string;
  updatedAt: string;

  // Relations
  kelas?: Kelas;
  dosenPengajar?: Dosen | null;
}

// ─────────────────────────────────────────
// API Response Types
// ─────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// ─────────────────────────────────────────
// Dashboard Types
// ─────────────────────────────────────────

export interface DashboardStats {
  totalKelasAktif: number;
  rataRataKehadiran: number; // persen
  persenKontenLengkap: number; // persen
  jumlahKelasBemasalah: number;
}

export interface KelasBermasalah {
  kelasId: string;
  kodeKelas: string;
  mataKuliah: string;
  dosen: string;
  prodi: string;
  jumlahAlpha: number;
  jumlahSesiDiisi: number;
}

// ─────────────────────────────────────────
// Import Excel Types
// ─────────────────────────────────────────

export interface ImportPreviewData {
  mataKuliah: string;
  kelas: string;
  sesiData: {
    nomorSesi: number;
    jenisSesi: JenisSesi;
    isKhadiranOnly: boolean;
    lectureNote: boolean | null;
    slide: boolean | null;
    video: boolean | null;
    conference: boolean | null;
    tugas: boolean | null;
    kuis: boolean | null;
    kolomTerdeteksi: string[];
  }[];
  warningMessages: string[];
}
