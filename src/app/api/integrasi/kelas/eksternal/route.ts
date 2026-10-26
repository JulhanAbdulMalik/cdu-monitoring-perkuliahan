// src/app/api/integrasi/kelas/eksternal/route.ts
// POST /api/integrasi/kelas/eksternal  (auth: Bearer INTEGRASI_API_KEYS)
// Worker mengimpor/menyelaraskan kelas dari LMS eksternal (nusaputra.app) ke CDU.
//
// Aturan aman:
//   - Prodi harus sudah ada di CDU (dicari lewat `prodiKode`); tidak pernah membuat prodi.
//   - Kelas dicocokkan lewat `externalId` (UUID course_class nusaputra.app).
//   - Kelas baru dibuat lengkap dengan 16 baris MonitoringSesi (pola sama dengan createKelas).
//   - Kelas yang sudah ada hanya diperbarui metadatanya (dosen, jadwal, URL); baris sesi,
//     kehadiran, catatan, dan mode pembelajaran (bisa diubah staf CDU) TIDAK disentuh.
//   - Kelas Edlink yang kebetulan berkunci sama tidak pernah diambil alih (dilaporkan konflik).
//   - Dosen dicari lewat NIDN, lalu nama di prodi yang sama; bila tidak ada, dibuat baru.
//   - dryRun=true: hitung tanpa menulis.
//
// Body:
// {
//   "sumber": "NUSAPUTRA_APP",
//   "prodiKode": "202505",
//   "dryRun": false,
//   "kelas": [{
//     "externalId": "uuid", "externalUrl": "https://nusaputra.app/lms/courses/uuid/sessions",
//     "kodeKelas": "KP24A",
//     "mataKuliah": { "kode": "KP101", "nama": "Farmakologi", "sks": 3 },
//     "dosen": [{ "nama": "Ns. ...", "nidn": "04..." }],   // urutan: koordinator dulu
//     "jadwalHari": "Senin", "jadwalJam": "08:00 - 09:40", "ruangan": null,
//     "modePembelajaran": "LURING"                          // hanya dipakai saat kelas dibuat
//   }]
// }

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { checkIntegrasiAuth, jsonError } from "@/lib/integrasi-auth";
import { invalidateLaporanCache } from "@/actions/laporan";
import type { ModePembelajaran, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const HARI_VALID = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const MODE_VALID: ModePembelajaran[] = ["DARING", "LURING", "HYBRID", "BIMBINGAN"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Nama Dosen pengganti bila kelas di LMS belum punya dosen (kolom dosenId CDU wajib diisi). */
export const DOSEN_BELUM_DITENTUKAN = "(Dosen belum ditentukan di nusaputra.app)";

type DosenInput = { nama?: unknown; nidn?: unknown };
type KelasInput = {
  externalId?: unknown;
  externalUrl?: unknown;
  kodeKelas?: unknown;
  mataKuliah?: { kode?: unknown; nama?: unknown; sks?: unknown };
  dosen?: unknown;
  jadwalHari?: unknown;
  jadwalJam?: unknown;
  ruangan?: unknown;
  modePembelajaran?: unknown;
};

function teks(v: unknown, maks = 200): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  return t.length > 0 ? t.slice(0, maks) : null;
}

function nidnBersih(v: unknown): string | null {
  const t = teks(v, 30);
  if (!t) return null;
  const d = t.replace(/[^0-9A-Za-z]/g, "");
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

export async function POST(req: NextRequest) {
  const denied = checkIntegrasiAuth(req);
  if (denied) return denied;

  let body: { sumber?: unknown; prodiKode?: unknown; kelas?: unknown; dryRun?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError("Body harus JSON");
  }

  if (body?.sumber !== "NUSAPUTRA_APP") return jsonError('sumber wajib "NUSAPUTRA_APP"');
  const prodiKode = teks(body?.prodiKode, 20);
  if (!prodiKode) return jsonError("prodiKode wajib diisi");
  const daftar: KelasInput[] = Array.isArray(body?.kelas) ? (body.kelas as KelasInput[]) : [];
  if (daftar.length === 0 || daftar.length > 500) return jsonError("kelas wajib diisi (1–500)");
  const dryRun = body?.dryRun === true;

  const [semester, prodi] = await Promise.all([
    prisma.semester.findFirst({ where: { aktif: true } }),
    prisma.prodi.findUnique({ where: { kode: prodiKode } }),
  ]);
  if (!semester) return jsonError("Tidak ada semester aktif", 404);
  if (!prodi) return jsonError(`Prodi ${prodiKode} tidak ada di CDU`, 404);

  const hasil = {
    dibuat: [] as Array<{ externalId: string; kodeKelas: string; mataKuliah: string }>,
    diperbarui: [] as Array<{ externalId: string; kodeKelas: string; field: string[] }>,
    tetap: 0,
    dosenBaru: [] as Array<{ nama: string; nidn: string | null }>,
    mataKuliahBaru: [] as string[],
    gagal: [] as Array<{ externalId: string | null; kodeKelas: string | null; error: string }>,
  };

  // Cache dalam satu request supaya dosen/MK yang sama tidak dibuat dua kali
  const dosenCache = new Map<string, string>();
  const mkCache = new Map<string, string>();
  const externalDilihat = new Set<string>();
  // Dicatat ke hasil hanya bila transaksi kelas berhasil (rollback = tidak jadi dibuat)
  let calonDosenBaru: Array<{ nama: string; nidn: string | null }> = [];
  let calonMkBaru: string[] = [];

  async function cariAtauBuatDosen(tx: Prisma.TransactionClient, d: { nama: string; nidn: string | null }): Promise<string> {
    const key = d.nidn ? `nidn:${d.nidn}` : `nama:${d.nama.toLowerCase()}`;
    const cached = dosenCache.get(key);
    if (cached) return cached;
    let found = d.nidn ? await tx.dosen.findUnique({ where: { nidn: d.nidn }, select: { id: true } }) : null;
    if (!found) {
      found = await tx.dosen.findFirst({
        where: { prodiId: prodi!.id, nama: { equals: d.nama, mode: "insensitive" } },
        select: { id: true },
      });
    }
    if (!found) {
      found = dryRun
        ? { id: `dry-${key}` }
        : await tx.dosen.create({ data: { nama: d.nama, nidn: d.nidn, prodiId: prodi!.id }, select: { id: true } });
      calonDosenBaru.push(d);
    }
    dosenCache.set(key, found.id);
    return found.id;
  }

  async function cariAtauBuatMk(tx: Prisma.TransactionClient, mk: { kode: string; nama: string; sks: number }): Promise<string> {
    const cached = mkCache.get(mk.kode);
    if (cached) return cached;
    let found = await tx.mataKuliah.findUnique({
      where: { kode_prodiId: { kode: mk.kode, prodiId: prodi!.id } },
      select: { id: true },
    });
    if (!found) {
      found = dryRun
        ? { id: `dry-mk-${mk.kode}` }
        : await tx.mataKuliah.create({ data: { kode: mk.kode, nama: mk.nama, sks: mk.sks, prodiId: prodi!.id }, select: { id: true } });
      calonMkBaru.push(`${mk.kode} ${mk.nama}`);
    }
    mkCache.set(mk.kode, found.id);
    return found.id;
  }

  for (const it of daftar) {
    const externalId = teks(it?.externalId, 64);
    const kodeKelas = teks(it?.kodeKelas, 30);
    const mkKode = teks(it?.mataKuliah?.kode, 30);
    const mkNama = teks(it?.mataKuliah?.nama, 200);
    const skNum = Number(it?.mataKuliah?.sks);
    const sks = Number.isInteger(skNum) && skNum >= 0 && skNum <= 24 ? skNum : 0;

    if (!externalId || !UUID_RE.test(externalId)) {
      hasil.gagal.push({ externalId, kodeKelas, error: "externalId harus UUID" });
      continue;
    }
    if (externalDilihat.has(externalId)) {
      hasil.gagal.push({ externalId, kodeKelas, error: "externalId ganda dalam satu kiriman" });
      continue;
    }
    externalDilihat.add(externalId);
    if (!kodeKelas || !mkKode || !mkNama) {
      hasil.gagal.push({ externalId, kodeKelas, error: "kodeKelas dan mataKuliah.kode/nama wajib diisi" });
      continue;
    }

    const dosenList = (Array.isArray(it?.dosen) ? (it.dosen as DosenInput[]) : [])
      .map((d) => ({ nama: teks(d?.nama, 150), nidn: nidnBersih(d?.nidn) }))
      .filter((d): d is { nama: string; nidn: string | null } => !!d.nama)
      .slice(0, 5);
    const hariRaw = teks(it?.jadwalHari, 10);
    const jadwalHari = hariRaw && HARI_VALID.find((h) => h.toLowerCase() === hariRaw.toLowerCase());
    const jadwalJam = teks(it?.jadwalJam, 40);
    const ruangan = teks(it?.ruangan, 100);
    const externalUrl = urlAman(it?.externalUrl);
    const modeReq = teks(it?.modePembelajaran, 20) as ModePembelajaran | null;
    const mode: ModePembelajaran = modeReq && MODE_VALID.includes(modeReq) ? modeReq : "LURING";

    calonDosenBaru = [];
    calonMkBaru = [];
    try {
      await prisma.$transaction(async (tx) => {
        const dosenIds: string[] = [];
        for (const d of dosenList) {
          const id = await cariAtauBuatDosen(tx, d);
          if (!dosenIds.includes(id)) dosenIds.push(id);
        }
        if (dosenIds.length === 0) {
          dosenIds.push(await cariAtauBuatDosen(tx, { nama: DOSEN_BELUM_DITENTUKAN, nidn: null }));
        }
        const mataKuliahId = await cariAtauBuatMk(tx, { kode: mkKode, nama: mkNama, sks });

        const existing = await tx.kelas.findUnique({
          where: { externalId },
          select: {
            id: true, kodeKelas: true, dosenId: true, dosen2Id: true, jadwalHari: true, jadwalJam: true,
            ruangan: true, externalUrl: true, semesterId: true, mataKuliahId: true,
          },
        });

        if (existing) {
          const data: Prisma.KelasUncheckedUpdateInput = {};
          const field: string[] = [];
          const set = (k: keyof typeof existing, v: string | null) => {
            if (existing[k] !== v) {
              (data as Record<string, unknown>)[k] = v;
              field.push(k);
            }
          };
          set("kodeKelas", kodeKelas);
          set("dosenId", dosenIds[0]);
          set("dosen2Id", dosenIds[1] ?? null);
          if (jadwalHari) set("jadwalHari", jadwalHari);
          if (jadwalJam) set("jadwalJam", jadwalJam);
          set("ruangan", ruangan);
          if (externalUrl) set("externalUrl", externalUrl);
          if (existing.mataKuliahId !== mataKuliahId) set("mataKuliahId", mataKuliahId);
          if (field.length > 0) {
            if (!dryRun) await tx.kelas.update({ where: { id: existing.id }, data });
            hasil.diperbarui.push({ externalId, kodeKelas, field });
          } else {
            hasil.tetap++;
          }
          return;
        }

        if (!dryRun) {
          const bentrok = await tx.kelas.findUnique({
            where: { kodeKelas_semesterId_mataKuliahId: { kodeKelas, semesterId: semester.id, mataKuliahId } },
            select: { id: true, sumberLms: true, externalId: true },
          });
          if (bentrok) {
            throw new Error(
              `Kelas ${kodeKelas} ${mkKode} sudah ada di CDU (sumber ${bentrok.sumberLms}${bentrok.externalId ? `, externalId ${bentrok.externalId}` : ""}); tidak diambil alih`
            );
          }
          const k = await tx.kelas.create({
            data: {
              kodeKelas,
              semesterId: semester.id,
              mataKuliahId,
              dosenId: dosenIds[0],
              dosen2Id: dosenIds[1] ?? null,
              jadwalHari: jadwalHari || "Senin",
              jadwalJam: jadwalJam || "-",
              ruangan,
              modePembelajaran: mode,
              sumberLms: "NUSAPUTRA_APP",
              externalId,
              externalUrl,
            },
            select: { id: true },
          });
          await tx.monitoringSesi.createMany({ data: sesiBaru(k.id, mode) });
        }
        hasil.dibuat.push({ externalId, kodeKelas, mataKuliah: mkNama });
      });
      hasil.dosenBaru.push(...calonDosenBaru);
      hasil.mataKuliahBaru.push(...calonMkBaru);
    } catch (e: unknown) {
      hasil.gagal.push({ externalId, kodeKelas, error: e instanceof Error ? e.message.slice(0, 300) : "gagal" });
      // Entri cache dari transaksi yang dibatalkan tidak boleh dipakai ulang
      dosenCache.clear();
      mkCache.clear();
    }
  }

  if (!dryRun && (hasil.dibuat.length > 0 || hasil.diperbarui.length > 0)) {
    try {
      revalidatePath("/monitoring");
      revalidatePath("/kelas");
      revalidatePath("/");
    } catch {
      /* revalidate opsional */
    }
    await invalidateLaporanCache();
  }

  return NextResponse.json({
    sumber: "NUSAPUTRA_APP",
    prodi: { kode: prodi.kode, nama: prodi.nama },
    semester: `${semester.tahunAkademik} ${semester.periode}`,
    dryRun,
    ...hasil,
  });
}
