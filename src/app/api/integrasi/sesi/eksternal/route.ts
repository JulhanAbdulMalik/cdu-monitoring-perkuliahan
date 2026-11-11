// src/app/api/integrasi/sesi/eksternal/route.ts
// POST /api/integrasi/sesi/eksternal  (auth: Bearer INTEGRASI_API_KEYS)
// Worker mengirim ringkasan konten per sesi dari LMS nusaputra.app untuk satu kelas
// (respons GET /api/integration/v1/classes/{uuid}/sessions, sudah dipetakan worker).
//
// Aturan aman (sama dengan mode "merge" Edlink):
//   - Komponen konten hanya dinaikkan false/null → true; centang staf CDU tidak pernah dihapus.
//   - Sesi 8 (UTS) dan 16 (UAS) CDU tidak diberi konten; sesi ujian di sumber juga dilewati.
//   - Tanggal & jam sesi mengikuti nusaputra.app (sumber jadwal resmi). Perubahan tanggal
//     dilaporkan di `perubahan` (field "tanggal") dan juga di `selisihJadwal` (nilai lama → baru).
//   - Dosen per sesi mengikuti nusaputra.app: dosen utama kelas → UTAMA, dosen kedua → TANDEM,
//     dosen lain → PENGGANTI_INSIDENTAL. Status PERGANTIAN_TETAP yang diisi staf dipertahankan
//     bila dosennya sama. Dosen yang belum ada di CDU dibuat (cari NIDN dulu, lalu nama di prodi).
//     Sesi tanpa dosen di nusaputra.app tidak diubah.
//   - Kehadiran TIDAK pernah disentuh (tetap diisi manual operator).
//   - Hanya untuk kelas sumberLms = NUSAPUTRA_APP (dicari lewat externalId).
//   - dryRun=true: hitung perubahan tanpa menulis.
//
// Body:
// {
//   "externalId": "uuid",
//   "sesi": [{ "nomor": 1, "tanggal": "2026-09-21", "jamMulai": "08:00", "jamSelesai": "09:40",
//              "ujian": false,
//              "dosen": { "nama": "Ns. Siti", "nidn": "0412345678" },   // null bila belum ada
//              "konten": { "lectureNote": true, "slide": false, "video": false,
//                          "conference": false, "tugas": true, "kuis": false },
//              "bukti": ["Slide: Pengantar.pptx"] }],
//   "dryRun": false
// }

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { checkIntegrasiAuth, jsonError } from "@/lib/integrasi-auth";
import { KOMPONEN_KONTEN } from "@/lib/edlink-mapper";
import { invalidateLaporanCache } from "@/actions/laporan";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type SesiInput = {
  nomor?: unknown;
  tanggal?: unknown;
  jamMulai?: unknown;
  jamSelesai?: unknown;
  dosen?: { nama?: unknown; nidn?: unknown } | null;
  ujian?: unknown;
  konten?: Record<string, unknown>;
  bukti?: unknown;
};

const TANGGAL_RE = /^\d{4}-\d{2}-\d{2}$/;
const JAM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function tanggalValid(v: unknown): string | null {
  if (typeof v !== "string" || !TANGGAL_RE.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
}

function jamValid(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, 5);
  return JAM_RE.test(t) ? t : null;
}

function teks(v: unknown, maks: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  return t ? t.slice(0, maks) : null;
}

function nidnBersih(v: unknown): string | null {
  const t = teks(v, 30);
  if (!t) return null;
  const d = t.replace(/[^0-9A-Za-z]/g, "");
  return d.length >= 6 ? d : null;
}

type StatusPengajar = "UTAMA" | "TANDEM" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP";

export async function POST(req: NextRequest) {
  const denied = checkIntegrasiAuth(req);
  if (denied) return denied;

  let body: { externalId?: unknown; sesi?: unknown; dryRun?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError("Body harus JSON");
  }

  const externalId = typeof body?.externalId === "string" ? body.externalId.trim() : "";
  if (!externalId) return jsonError("externalId wajib diisi");
  const daftar: SesiInput[] = Array.isArray(body?.sesi) ? (body.sesi as SesiInput[]) : [];
  if (daftar.length > 40) return jsonError("sesi maksimal 40");
  const dryRun = body?.dryRun === true;

  const kelas = await prisma.kelas.findUnique({
    where: { externalId },
    include: {
      monitoringSesi: true,
      mataKuliah: { select: { prodiId: true } },
    },
  });
  if (!kelas) return jsonError("Kelas dengan externalId ini belum diimpor ke CDU", 404);
  if (kelas.sumberLms !== "NUSAPUTRA_APP") return jsonError("Kelas ini bukan kelas sumber nusaputra.app", 409);

  const perubahan: Array<{ nomorSesi: number; field: string; dari: unknown; ke: unknown }> = [];
  const lewati: Array<{ nomorSesi: number; alasan: string }> = [];
  const selisihJadwal: Array<{ nomorSesi: number; cdu: string; sumber: string }> = [];
  const updates: Array<{ id: string; data: Prisma.MonitoringSesiUpdateInput }> = [];
  const nomorDilihat = new Set<number>();
  const dosenBaru: Array<{ nama: string; nidn: string | null }> = [];
  const dosenCache = new Map<string, string | null>();

  /** Cari Dosen CDU (NIDN → nama di prodi). Bila tidak ada: dibuat (kecuali dryRun → null). */
  async function cariAtauBuatDosen(d: { nama: string; nidn: string | null }): Promise<string | null> {
    const key = d.nidn ? `nidn:${d.nidn}` : `nama:${d.nama.toLowerCase()}`;
    if (dosenCache.has(key)) return dosenCache.get(key) ?? null;
    let found = d.nidn ? await prisma.dosen.findUnique({ where: { nidn: d.nidn }, select: { id: true } }) : null;
    if (!found) {
      found = await prisma.dosen.findFirst({
        where: { prodiId: kelas!.mataKuliah.prodiId, nama: { equals: d.nama, mode: "insensitive" } },
        select: { id: true },
      });
    }
    let id: string | null = found?.id ?? null;
    if (!id) {
      dosenBaru.push(d);
      if (!dryRun) {
        const dibuat = await prisma.dosen.create({
          data: { nama: d.nama, nidn: d.nidn, prodiId: kelas!.mataKuliah.prodiId },
          select: { id: true },
        });
        id = dibuat.id;
      }
    }
    dosenCache.set(key, id);
    return id;
  }

  for (const s of daftar) {
    const nomor = Number(s?.nomor);
    if (!Number.isInteger(nomor) || nomor < 1 || nomor > 16) {
      lewati.push({ nomorSesi: nomor, alasan: "nomor sesi di luar 1–16" });
      continue;
    }
    if (nomorDilihat.has(nomor)) {
      lewati.push({ nomorSesi: nomor, alasan: "nomor sesi ganda di sumber" });
      continue;
    }
    nomorDilihat.add(nomor);

    const sesi = kelas.monitoringSesi.find((x) => x.nomorSesi === nomor);
    if (!sesi) {
      lewati.push({ nomorSesi: nomor, alasan: "baris sesi belum ada di CDU" });
      continue;
    }

    const data: Prisma.MonitoringSesiUpdateInput & Record<string, unknown> = {};
    const cduUjian = sesi.jenisSesi !== "REGULER";
    if (cduUjian || s?.ujian === true) {
      if (!cduUjian) lewati.push({ nomorSesi: nomor, alasan: "sesi ujian di nusaputra.app; konten tidak dihitung" });
    } else {
      for (const k of KOMPONEN_KONTEN) {
        if (s?.konten?.[k] === true && sesi[k] !== true) data[k] = true;
      }
    }

    // ── Tanggal & jam perkuliahan ────────────────────────────────────────
    const tgl = tanggalValid(s?.tanggal);
    if (tgl) {
      const tglCdu = sesi.tanggal ? sesi.tanggal.toISOString().slice(0, 10) : null;
      if (tglCdu !== tgl) {
        data.tanggal = new Date(`${tgl}T00:00:00.000Z`);
        if (tglCdu) selisihJadwal.push({ nomorSesi: nomor, cdu: tglCdu, sumber: tgl });
      }
    }
    const jamMulai = jamValid(s?.jamMulai);
    const jamSelesai = jamValid(s?.jamSelesai);
    if (jamMulai && jamSelesai) {
      if (sesi.jamMulai !== jamMulai) data.jamMulai = jamMulai;
      if (sesi.jamSelesai !== jamSelesai) data.jamSelesai = jamSelesai;
    }

    // ── Dosen pengajar sesi ──────────────────────────────────────────────
    const namaDosen = teks(s?.dosen?.nama, 150);
    if (namaDosen) {
      const dosenId = await cariAtauBuatDosen({ nama: namaDosen, nidn: nidnBersih(s?.dosen?.nidn) });
      let target: { id: string | null; status: StatusPengajar } | null = null;
      if (dosenId === kelas.dosenId) target = { id: null, status: "UTAMA" };
      else if (dosenId && dosenId === kelas.dosen2Id) target = { id: dosenId, status: "TANDEM" };
      else if (dosenId) {
        // Pergantian tetap yang dicatat staf untuk dosen yang sama dipertahankan
        const tetap = sesi.statusPengajar === "PERGANTIAN_TETAP" && sesi.dosenPengajarId === dosenId;
        target = { id: dosenId, status: tetap ? "PERGANTIAN_TETAP" : "PENGGANTI_INSIDENTAL" };
      } else {
        // dryRun dan dosen belum ada di CDU: laporkan sebagai calon perubahan saja
        perubahan.push({ nomorSesi: nomor, field: "dosenPengajar", dari: sesi.dosenPengajarId, ke: `(baru) ${namaDosen}` });
      }
      if (target) {
        const dosenSekarang = sesi.statusPengajar === "UTAMA" ? null : sesi.dosenPengajarId;
        if (dosenSekarang !== target.id || sesi.statusPengajar !== target.status) {
          data.dosenPengajarId = target.id;
          data.statusPengajar = target.status;
        }
      }
    }

    if (Object.keys(data).length > 0) {
      for (const [field, ke] of Object.entries(data)) {
        perubahan.push({ nomorSesi: nomor, field, dari: (sesi as Record<string, unknown>)[field] ?? null, ke });
      }
      data.sumberData = "NUSAPUTRA_APP";
      // Prisma memakai relasi untuk dosen pengajar
      if ("dosenPengajarId" in data) {
        const id = data.dosenPengajarId as string | null;
        delete data.dosenPengajarId;
        data.dosenPengajar = id ? { connect: { id } } : { disconnect: true };
      }
      updates.push({ id: sesi.id, data });
    }
  }

  if (!dryRun) {
    await prisma.$transaction([
      ...updates.map((u) => prisma.monitoringSesi.update({ where: { id: u.id }, data: u.data })),
      prisma.kelas.update({ where: { id: kelas.id }, data: { externalSyncedAt: new Date() } }),
    ]);
    if (updates.length > 0) {
      try {
        revalidatePath(`/monitoring/${kelas.id}`);
        revalidatePath("/monitoring");
        revalidatePath("/laporan/rekap");
        revalidatePath("/");
      } catch {
        /* revalidate opsional */
      }
      await invalidateLaporanCache();
    }
  }

  return NextResponse.json({
    kelasId: kelas.id,
    kodeKelas: kelas.kodeKelas,
    externalId,
    dryRun,
    sesiDiperbarui: updates.length,
    perubahan,
    lewati,
    selisihJadwal,
    dosenBaru,
  });
}
