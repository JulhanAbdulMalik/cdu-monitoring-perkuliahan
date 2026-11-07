"use server";
// src/actions/nusaputra-app-kelas.ts
// Tombol "Sinkron Kelas nusaputra.app" di /master/kelas (khusus SUPER_ADMIN).
//
// Alur (tidak ada yang tersimpan tanpa persetujuan Admin):
//   1. previewKelasNusaputraApp(semesterId)
//      → baca daftar kelas dari API nusaputra.app (hanya-baca), cocokkan dengan CDU,
//        kembalikan ImportPreviewResult (format sama dengan modal Import Excel).
//        Kelas yang sudah ada di CDU / datanya tidak lengkap tetap ditampilkan tetapi
//        tidak bisa diimport.
//   2. commitKelasNusaputraApp(rows)
//      → simpan HANYA kelas baru yang dikirim modal (baris "Siap"). Kelas yang sudah
//        ada TIDAK pernah diubah. Mata kuliah / dosen yang belum ada dibuat.
//
// Env:
//   NUSAPUTRA_APP_BASE_URL   mis. https://nusaputra.app
//   NUSAPUTRA_APP_API_TOKEN  token Sanctum ability integration:read
//   NUSAPUTRA_APP_PRODI      pemetaan "kode_nusaputra_app:kode_prodi_cdu[,..]" (default "14401:202505")

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ModePembelajaran, Prisma } from "@prisma/client";
import { requireSuperAdmin } from "@/lib/action-auth";
import { invalidateLaporanCache } from "@/actions/laporan";
import type { ImportPreviewResult, ImportPreviewRow } from "@/actions/master-import";

const HARI: Record<number, string> = { 1: "Senin", 2: "Selasa", 3: "Rabu", 4: "Kamis", 5: "Jumat", 6: "Sabtu", 7: "Minggu" };
const HARI_VALID = Object.values(HARI);
const MODE_VALID: ModePembelajaran[] = ["DARING", "LURING", "HYBRID", "BIMBINGAN"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type NpLecturer = { name?: string | null; nidn?: string | null; role?: string | null };
type NpSchedule = { day_of_week?: number | null; start_time?: string | null; end_time?: string | null };
type NpClass = {
  id?: string;
  class_code?: string | null;
  course?: { code?: string | null; name?: string | null; credits?: number | null };
  lecturers?: NpLecturer[] | null;
  schedules?: NpSchedule[] | null;
  lms_url?: string | null;
};

function konfigurasi() {
  const baseUrl = (process.env.NUSAPUTRA_APP_BASE_URL || "").replace(/\/+$/, "");
  const token = process.env.NUSAPUTRA_APP_API_TOKEN || "";
  const pemetaan = (process.env.NUSAPUTRA_APP_PRODI || "14401:202505")
    .split(",")
    .map((x) => x.split(":").map((y) => y.trim()))
    .filter((x) => x.length === 2 && x[0] && x[1]) as Array<[string, string]>;
  return { baseUrl, token, pemetaan };
}

function teks(v: unknown, maks = 200): string {
  if (typeof v !== "string") return "";
  return v.trim().replace(/\s+/g, " ").slice(0, maks);
}

function nidnBersih(v: unknown): string | null {
  const d = teks(v, 30).replace(/[^0-9A-Za-z]/g, "");
  return d.length >= 6 ? d : null;
}

function urlAman(v: unknown): string | null {
  const t = teks(v, 500);
  if (!t) return null;
  try {
    const u = new URL(t);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

async function ambilKelasNusaputraApp(baseUrl: string, token: string, prodi: string): Promise<NpClass[]> {
  const r = await fetch(`${baseUrl}/api/integration/v1/classes?study_program=${encodeURIComponent(prodi)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "cdu-portal/1.0" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  if (r.status === 401 || r.status === 403) throw new Error(`nusaputra.app menolak token (${r.status})`);
  if (!r.ok) throw new Error(`nusaputra.app merespons ${r.status}`);
  const body = (await r.json()) as { success?: boolean; data?: { classes?: NpClass[] } };
  if (!body?.success) throw new Error("Respons nusaputra.app tidak dikenal");
  return Array.isArray(body.data?.classes) ? body.data!.classes! : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PREVIEW (tidak menulis apa pun ke database)
// ─────────────────────────────────────────────────────────────────────────────

export async function previewKelasNusaputraApp(
  semesterId?: string
): Promise<{ success: boolean; data?: ImportPreviewResult; error?: string }> {
  try {
    await requireSuperAdmin();
    const { baseUrl, token, pemetaan } = konfigurasi();
    if (!baseUrl || !token) {
      return { success: false, error: "Koneksi nusaputra.app belum dikonfigurasi (NUSAPUTRA_APP_BASE_URL / NUSAPUTRA_APP_API_TOKEN)." };
    }

    const semester = semesterId
      ? await prisma.semester.findUnique({ where: { id: semesterId } })
      : await prisma.semester.findFirst({ where: { aktif: true } });
    if (!semester) return { success: false, error: "Semester tujuan tidak ditemukan" };

    const previewList: ImportPreviewRow[] = [];
    let nomor = 0;

    for (const [kodeSumber, kodeCdu] of pemetaan) {
      const prodi = await prisma.prodi.findUnique({ where: { kode: kodeCdu }, select: { id: true, nama: true, kode: true } });
      const daftar = await ambilKelasNusaputraApp(baseUrl, token, kodeSumber);
      if (daftar.length === 0) continue;

      const externalIds = daftar.map((k) => k.id).filter((x): x is string => !!x);
      const [sudahExternal, mkProdi, dosenAll] = await Promise.all([
        prisma.kelas.findMany({
          where: { externalId: { in: externalIds } },
          select: { externalId: true, kodeKelas: true, semester: { select: { tahunAkademik: true, periode: true } } },
        }),
        prodi ? prisma.mataKuliah.findMany({ where: { prodiId: prodi.id }, select: { id: true, kode: true, nama: true } }) : [],
        prisma.dosen.findMany({ select: { id: true, nama: true, nidn: true } }),
      ]);
      const mapExternal = new Map(sudahExternal.map((k) => [k.externalId!, k]));
      const kelasSemester = prodi
        ? await prisma.kelas.findMany({
            where: { semesterId: semester.id, mataKuliah: { prodiId: prodi.id } },
            select: { kodeKelas: true, mataKuliah: { select: { kode: true } } },
          })
        : [];
      const kunciSemester = new Set(kelasSemester.map((k) => `${k.kodeKelas.toUpperCase()}|${k.mataKuliah.kode.toUpperCase()}`));

      for (const k of daftar) {
        nomor++;
        const externalId = teks(k.id, 64);
        const kodeKelas = teks(k.class_code, 30).toUpperCase();
        const kodeMk = teks(k.course?.code, 30).toUpperCase();
        const namaMk = teks(k.course?.name, 200);
        const skNum = Number(k.course?.credits);
        const sks = Number.isInteger(skNum) && skNum > 0 && skNum <= 24 ? skNum : 0;

        const dosen = (k.lecturers || [])
          .map((d) => ({ nama: teks(d?.name, 150), nidn: nidnBersih(d?.nidn) }))
          .filter((d) => d.nama);
        const d1 = dosen[0];
        const d2 = dosen.find((d, i) => i > 0 && d.nama.toLowerCase() !== d1?.nama.toLowerCase());
        const cariDosen = (d?: { nama: string; nidn: string | null }) =>
          d
            ? (d.nidn ? dosenAll.find((x) => x.nidn === d.nidn) : undefined) ||
              dosenAll.find((x) => x.nama.toLowerCase() === d.nama.toLowerCase())
            : undefined;
        const dosen1Db = cariDosen(d1);
        const dosen2Db = cariDosen(d2);

        const jadwal = [...(k.schedules || [])].sort(
          (a, b) => (a.day_of_week || 9) - (b.day_of_week || 9) || String(a.start_time || "").localeCompare(String(b.start_time || ""))
        );
        const utama = jadwal[0];
        const hari = utama?.day_of_week ? HARI[utama.day_of_week] || "" : "";
        const jam = utama?.start_time && utama?.end_time ? `${String(utama.start_time).slice(0, 5)} - ${String(utama.end_time).slice(0, 5)}` : "";

        const mkDb = mkProdi.find((m) => m.kode.toUpperCase() === kodeMk);

        const errors: string[] = [];
        let importBlokir = "";
        const ada = mapExternal.get(externalId);
        if (ada) {
          importBlokir = `Kelas sudah ada di CDU (${ada.semester.tahunAkademik} ${ada.semester.periode})`;
        } else if (kunciSemester.has(`${kodeKelas}|${kodeMk}`)) {
          importBlokir = "Kelas sudah ada di CDU (kode kelas & mata kuliah sama)";
        }
        if (importBlokir) errors.push(importBlokir);
        if (!externalId || !UUID_RE.test(externalId)) errors.push("ID kelas nusaputra.app tidak valid");
        if (!prodi) errors.push(`Prodi ${kodeCdu} tidak ada di CDU`);
        if (!kodeKelas) errors.push("Nama / Kode Kelas wajib diisi");
        if (!kodeMk || !namaMk) errors.push("Kode atau Nama Mata Kuliah wajib diisi");
        if (!d1) errors.push("Pengajar / Dosen belum diisi");
        if (!hari || !jam) errors.push("Jadwal mingguan belum diisi");

        previewList.push({
          rowIndex: nomor,
          data: {
            kodeKelas,
            semesterId: semester.id,
            semesterTahun: `${semester.tahunAkademik} (${semester.periode})`,
            kodeMk,
            namaMk,
            sks: sks || 2,
            mataKuliahId: mkDb?.id || null,
            mataKuliahNama: `${kodeMk} - ${namaMk}`,
            mataKuliahBaru: !mkDb,
            prodiQuery: prodi?.nama || kodeCdu,
            prodiId: prodi?.id || null,
            prodiNama: prodi?.nama || kodeCdu,
            dosenQuery: d1?.nama || "",
            dosenId: dosen1Db?.id || null,
            dosenNama: dosen1Db?.nama || d1?.nama || "-",
            dosenNidn: d1?.nidn || null,
            dosenNamaSumber: d1?.nama || "",
            dosenBaru: !!d1 && !dosen1Db,
            dosen2Query: d2?.nama || "",
            dosen2Id: dosen2Db?.id || null,
            dosen2Nama: dosen2Db?.nama || d2?.nama || null,
            dosen2Nidn: d2?.nidn || null,
            dosen2NamaSumber: d2?.nama || "",
            dosen2Baru: !!d2 && !dosen2Db,
            jadwalHari: hari || "-",
            jadwalJam: jam || "-",
            ruangan: null,
            modePembelajaran: "LURING",
            externalId,
            externalUrl: urlAman(k.lms_url),
            importBlokir,
          },
          isValid: errors.length === 0,
          errors,
        });
      }
    }

    return {
      success: true,
      data: {
        totalRows: previewList.length,
        validRows: previewList.filter((r) => r.isValid).length,
        invalidRows: previewList.filter((r) => !r.isValid).length,
        previewList,
      },
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Gagal mengambil data dari nusaputra.app" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SIMPAN (hanya kelas baru; kelas yang sudah ada tidak pernah diubah)
// ─────────────────────────────────────────────────────────────────────────────

function sesiBaru(kelasId: string, mode: ModePembelajaran): Prisma.MonitoringSesiCreateManyInput[] {
  const rows: Prisma.MonitoringSesiCreateManyInput[] = [];
  for (let i = 1; i <= 16; i++) {
    const isUTS = i === 8;
    const isUAS = i === 16;
    const isExam = isUTS || isUAS;
    rows.push({
      kelasId,
      nomorSesi: i,
      jenisSesi: isUTS ? "UTS" : isUAS ? "UAS" : "REGULER",
      kehadiran: "BELUM_DIISI",
      lectureNote: isExam ? null : false,
      slide: isExam ? null : false,
      video: isExam ? null : false,
      conference: isExam && mode !== "BIMBINGAN" ? null : false,
      tugas: isExam ? null : false,
      kuis: isExam ? null : false,
    });
  }
  return rows;
}

async function cariAtauBuatDosen(
  tx: Prisma.TransactionClient,
  nama: string,
  nidn: string | null,
  prodiId: string
): Promise<string> {
  let found = nidn ? await tx.dosen.findUnique({ where: { nidn }, select: { id: true } }) : null;
  if (!found) {
    found = await tx.dosen.findFirst({ where: { nama: { equals: nama, mode: "insensitive" } }, select: { id: true } });
  }
  if (!found) {
    found = await tx.dosen.create({ data: { nama, nidn, prodiId }, select: { id: true } });
  }
  return found.id;
}

export async function commitKelasNusaputraApp(
  rows: Array<Record<string, unknown>>
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    await requireSuperAdmin();
    if (!Array.isArray(rows) || rows.length === 0) return { success: false, error: "Tidak ada baris untuk disimpan" };
    if (rows.length > 500) return { success: false, error: "Maksimal 500 baris sekali simpan" };

    let count = 0;
    const dilewati: string[] = [];

    for (const r of rows) {
      const externalId = teks(r?.externalId, 64);
      const kodeKelas = teks(r?.kodeKelas, 30).toUpperCase();
      const kodeMk = teks(r?.kodeMk, 30).toUpperCase();
      const namaMk = teks(r?.namaMk, 200);
      const skNum = Number(r?.sks);
      const sks = Number.isInteger(skNum) && skNum > 0 && skNum <= 24 ? skNum : 2;
      const prodiId = teks(r?.prodiId, 40);
      const semesterId = teks(r?.semesterId, 40);
      const hari = HARI_VALID.find((h) => h.toLowerCase() === teks(r?.jadwalHari, 10).toLowerCase());
      const jam = teks(r?.jadwalJam, 40);
      const modeReq = teks(r?.modePembelajaran, 20) as ModePembelajaran;
      const mode: ModePembelajaran = MODE_VALID.includes(modeReq) ? modeReq : "LURING";
      const ruangan = mode !== "DARING" ? teks(r?.ruangan, 100) || null : null;
      const dosenNama = teks(r?.dosenNama, 150) || teks(r?.dosenQuery, 150);
      const dosen2Nama = teks(r?.dosen2Nama, 150) || teks(r?.dosen2Query, 150);
      // NIDN dari nusaputra.app hanya dipakai bila nama dosen tidak diubah di modal
      const dosenNidn = dosenNama && dosenNama === teks(r?.dosenNamaSumber, 150) ? nidnBersih(r?.dosenNidn) : null;
      const dosen2Nidn = dosen2Nama && dosen2Nama === teks(r?.dosen2NamaSumber, 150) ? nidnBersih(r?.dosen2Nidn) : null;

      if (!externalId || !UUID_RE.test(externalId) || !kodeKelas || !kodeMk || !namaMk || !prodiId || !semesterId
        || !hari || !jam || jam === "-" || !dosenNama || dosenNama === "-") {
        dilewati.push(kodeKelas || externalId || "?");
        continue;
      }

      const dibuat = await prisma.$transaction(async (tx) => {
        // Pengaman: kelas yang sudah ada tidak pernah diubah
        if (await tx.kelas.findUnique({ where: { externalId }, select: { id: true } })) return false;

        let mk = await tx.mataKuliah.findUnique({ where: { kode_prodiId: { kode: kodeMk, prodiId } }, select: { id: true } });
        if (!mk) mk = await tx.mataKuliah.create({ data: { kode: kodeMk, nama: namaMk, sks, prodiId }, select: { id: true } });

        if (
          await tx.kelas.findUnique({
            where: { kodeKelas_semesterId_mataKuliahId: { kodeKelas, semesterId, mataKuliahId: mk.id } },
            select: { id: true },
          })
        ) {
          return false;
        }

        const dosenId = await cariAtauBuatDosen(tx, dosenNama, dosenNidn, prodiId);
        let dosen2Id: string | null = null;
        if (dosen2Nama && dosen2Nama !== "-") {
          dosen2Id = await cariAtauBuatDosen(tx, dosen2Nama, dosen2Nidn, prodiId);
          if (dosen2Id === dosenId) dosen2Id = null;
        }

        const kelas = await tx.kelas.create({
          data: {
            kodeKelas,
            semesterId,
            mataKuliahId: mk.id,
            dosenId,
            dosen2Id,
            jadwalHari: hari,
            jadwalJam: jam,
            ruangan,
            modePembelajaran: mode,
            sumberLms: "NUSAPUTRA_APP",
            externalId,
            externalUrl: urlAman(r?.externalUrl),
          },
          select: { id: true },
        });
        await tx.monitoringSesi.createMany({ data: sesiBaru(kelas.id, mode) });
        return true;
      });

      if (dibuat) count++;
      else dilewati.push(kodeKelas);
    }

    if (count > 0) {
      try {
        revalidatePath("/master/kelas");
        revalidatePath("/monitoring");
        revalidatePath("/");
      } catch {
        /* revalidate opsional */
      }
      await invalidateLaporanCache();
    }

    if (count === 0) {
      return { success: false, error: "Tidak ada kelas baru yang disimpan (semua sudah ada atau datanya tidak lengkap)" };
    }
    return { success: true, count };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Gagal menyimpan kelas nusaputra.app" };
  }
}
