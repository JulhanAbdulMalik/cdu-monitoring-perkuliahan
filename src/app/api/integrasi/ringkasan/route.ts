// src/app/api/integrasi/ringkasan/route.ts
// GET /api/integrasi/ringkasan?tanggal=YYYY-MM-DD&prodiId=
// Ringkasan kepatuhan untuk notifikasi (bot Telegram / asisten):
//   - sesiHariIni     : sesi bertanggal hari itu yang 3 pilarnya belum lengkap
//   - sesiLewatKosong : sesi lampau (≤ tanggal) tanpa konten sama sekali
//   - belumTerpetakan : kelas aktif tanpa edlinkGroupId
//   - belumSinkron    : kelas terpetakan yang belum disinkronkan > 24 jam

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkIntegrasiAuth, jsonError } from "@/lib/integrasi-auth";
import { calculateSessionPillars } from "@/lib/score-calculator";

export const dynamic = "force-dynamic";

function rentangHariWIB(tanggal: string) {
  const mulai = new Date(`${tanggal}T00:00:00+07:00`);
  const akhir = new Date(mulai.getTime() + 24 * 3600 * 1000);
  return { mulai, akhir };
}

export async function GET(req: NextRequest) {
  const denied = checkIntegrasiAuth(req);
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const tanggal =
    sp.get("tanggal") ||
    new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10); // hari ini WIB
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return jsonError("Format tanggal YYYY-MM-DD");
  const prodiId = sp.get("prodiId") || undefined;
  const batas = Math.min(Number(sp.get("limit") || 200), 1000);

  const semester = await prisma.semester.findFirst({ where: { aktif: true } });
  if (!semester) return jsonError("Tidak ada semester aktif", 404);

  const { mulai, akhir } = rentangHariWIB(tanggal);
  const filterKelas = {
    semesterId: semester.id,
    ...(prodiId ? { mataKuliah: { prodiId } } : {}),
  };
  const kelasSelect = {
    id: true,
    kodeKelas: true,
    modePembelajaran: true,
    edlinkGroupId: true,
    mataKuliah: { select: { nama: true, prodi: { select: { kode: true, nama: true } } } },
    dosen: { select: { nama: true } },
  } as const;

  const sesiHari = await prisma.monitoringSesi.findMany({
    where: { tanggal: { gte: mulai, lt: akhir }, kelas: filterKelas },
    include: { kelas: { select: kelasSelect } },
    orderBy: [{ tanggal: "asc" }],
  });

  const sesiHariIni = sesiHari
    .map((s) => {
      const p = calculateSessionPillars(
        s,
        s.kelas.modePembelajaran as Parameters<typeof calculateSessionPillars>[1]
      );
      return { s, p };
    })
    .filter(({ p }) => !p.isExam && p.score !== p.maxScore)
    .slice(0, batas)
    .map(({ s, p }) => ({
      kelasId: s.kelas.id,
      edlinkGroupId: s.kelas.edlinkGroupId,
      kodeKelas: s.kelas.kodeKelas,
      mataKuliah: s.kelas.mataKuliah.nama,
      prodi: s.kelas.mataKuliah.prodi.kode,
      dosen: s.kelas.dosen.nama,
      nomorSesi: s.nomorSesi,
      tanggal: s.tanggal,
      skor: `${p.score}/${p.maxScore}`,
      kurang: [!p.hasSL && "Slide/LN", !p.hasQT && "Tugas/Kuis", s.kelas.modePembelajaran !== "LURING" && !p.hasTV && "Video/Conference"].filter(Boolean),
      sumberData: s.sumberData,
    }));

  const sesiLewatKosong = await prisma.monitoringSesi.count({
    where: {
      tanggal: { lt: akhir },
      jenisSesi: "REGULER",
      kelas: filterKelas,
      NOT: [
        { lectureNote: true },
        { slide: true },
        { video: true },
        { conference: true },
        { tugas: true },
        { kuis: true },
      ],
    },
  });

  const [totalKelas, belumTerpetakan, belumSinkron] = await Promise.all([
    prisma.kelas.count({ where: filterKelas }),
    prisma.kelas.count({ where: { ...filterKelas, edlinkGroupId: null } }),
    prisma.kelas.count({
      where: {
        ...filterKelas,
        edlinkGroupId: { not: null },
        OR: [{ edlinkSyncedAt: null }, { edlinkSyncedAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) } }],
      },
    }),
  ]);

  return NextResponse.json({
    tanggal,
    semester: `${semester.tahunAkademik} ${semester.periode}`,
    totalKelas,
    belumTerpetakan,
    belumSinkron,
    sesiHariIniTotal: sesiHari.length,
    sesiHariIniBelumLengkap: sesiHariIni.length,
    sesiLewatKosong,
    sesiHariIni,
  });
}
