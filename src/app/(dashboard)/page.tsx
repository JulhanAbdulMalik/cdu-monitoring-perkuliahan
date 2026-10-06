// src/app/(dashboard)/page.tsx
// CDU Portal - Real-Data Dashboard (Plus Jakarta Sans)

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Calendar } from "lucide-react";
import SparklineCard from "@/components/dashboard/SparklineCard";
import MonitoringTrendChart, {
  TrendItem,
  TrendDataByMode,
} from "@/components/dashboard/MonitoringTrendChart";
import StatusDonutChart, {
  DonutStatusItem,
  DonutClassMode,
  ModeDistributionData,
} from "@/components/dashboard/StatusDonutChart";
import RecentClassesTable from "@/components/dashboard/RecentClassesTable";
import { calculateClassSummary, calculateSessionPillars } from "@/lib/score-calculator";
import {
  formatPct,
  roundPct,
  getCurrentActiveSessionNumber,
  DEFAULT_SEMESTER_START_DATE,
} from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const session = await auth();

  let totalKelas = 0;
  let totalDosen = 0;
  let totalProdi = 0;
  let kelasOffline = 0;
  let kelasOnline = 0;
  let kelasBimbingan = 0;
  let totalKelasNonBimbingan = 0;
  let activeSemester: any = null;
  let recentClassesList: any[] = [];
  let avgKehadiranUniv = 0;
  let avgKontenUniv = 0;
  let kelasPerluPerhatianCount = 0;
  let kelasCukupCount = 0;
  let totalAlpha = 0;
  let totalSesiTerlaksana = 0;
  let totalHadir = 0;
  let trendData: TrendItem[] = [];
  let trendDataByMode: TrendDataByMode | undefined = undefined;
  let donutData: DonutStatusItem[] = [];
  let distributionByMode: Record<DonutClassMode, ModeDistributionData> | undefined = undefined;

  let sparklineClassData = [{ val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }];
  let sparklineKehadiranData = [{ val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }];
  let sparklineKontenData = [{ val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }];
  let sparklineAlphaData = [{ val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }];

  let currentActiveSesi = 1;
  let sudahDimonitorSesiAktif = 0;
  let belumDimonitorSesiAktif = 0;
  let persenSelesaiSesiAktif = 0;

  try {
    const userRole = (session?.user as any)?.role;
    const userProdiIds = ((session?.user as any)?.prodiIds as string[]) || [];
    const isDosen = userRole === "DOSEN";

    // Optimasi Waterfall: Jalankan query semester, total dosen, dan total prodi secara paralel
    const [allSemesters, dosenCount, prodiCount] = await Promise.all([
      prisma.semester.findMany({
        orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
        include: { hariLibur: true },
      }),
      isDosen
        ? prisma.dosen.count({ where: { prodiId: { in: userProdiIds } } })
        : prisma.dosen.count(),
      isDosen ? Promise.resolve(userProdiIds.length) : prisma.prodi.count(),
    ]);

    activeSemester = allSemesters.find((s) => s.aktif) || allSemesters[0] || null;
    totalDosen = dosenCount;
    totalProdi = prodiCount;


    const rawClasses = await prisma.kelas.findMany({
      where: {
        ...(activeSemester ? { semesterId: activeSemester.id } : {}),
        ...(isDosen ? { mataKuliah: { prodiId: { in: userProdiIds } } } : {}),
      },
      include: {
        mataKuliah: {
          include: { prodi: true },
        },
        dosen: true,
        semester: true,
        monitoringSesi: {
          orderBy: { nomorSesi: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    totalKelas = rawClasses.length;

    // Sesi aktif saat ini & progres monitoring sesi aktif
    const semStartStr = activeSemester?.tanggalMulai
      ? new Date(activeSemester.tanggalMulai).toISOString().split("T")[0]
      : DEFAULT_SEMESTER_START_DATE;
    currentActiveSesi = getCurrentActiveSessionNumber(semStartStr, activeSemester?.hariLibur);

    sudahDimonitorSesiAktif = rawClasses.filter((cls) => {
      const targetSesi = cls.monitoringSesi.find((s) => s.nomorSesi === currentActiveSesi);
      return targetSesi ? targetSesi.kehadiran !== "BELUM_DIISI" : false;
    }).length;
    belumDimonitorSesiAktif = totalKelas - sudahDimonitorSesiAktif;
    persenSelesaiSesiAktif =
      totalKelas > 0 ? roundPct(sudahDimonitorSesiAktif, totalKelas) : 0;

    // Count by mode
    kelasOffline = rawClasses.filter(c => (c.modePembelajaran as string) === "LURING").length;
    kelasOnline = rawClasses.filter(c => (c.modePembelajaran as string) === "DARING").length;
    kelasBimbingan = rawClasses.filter(c => (c.modePembelajaran as string) === "BIMBINGAN").length;

    let totalHadirLengkap = 0;
    let totalHadirTdkLengkap = 0;
    let totalRegularSesiTerlaksana = 0;
    let totalSkor3PilarTerlaksana = 0;
    let totalSemesterKontenScore = 0;
    let totalSemesterMaxKontenScore = 0;
    totalKelasNonBimbingan = 0;
    // Total scheduled sessions = 16 per class (for true attendance %)  
    const totalJadwalSesi = rawClasses.length * 16;

    // Array 16 sesi untuk akumulasi trend data S1 - S16
    const sesiAggregates = Array.from({ length: 16 }, (_, i) => ({
      nomorSesi: i + 1,
      totalTerisi: 0,
      totalHadir: 0,
      totalSkorPilar: 0,
      totalRegular: 0,
    }));

    for (const cls of rawClasses) {
      const summary = calculateClassSummary(
        cls.monitoringSesi as any,
        cls.modePembelajaran as any,
        currentActiveSesi
      );

      if (summary.statusEvaluasi === "PERHATIAN") {
        kelasPerluPerhatianCount++;
      }

      if ((cls.modePembelajaran as any) !== "BIMBINGAN") {
        totalKelasNonBimbingan++;
        totalSemesterKontenScore += summary.totalSkor3Pilar;
        totalSemesterMaxKontenScore += ((cls.modePembelajaran as any) === "LURING" ? 28 : 42);
      }

      for (const s of cls.monitoringSesi) {
        const isExam = s.nomorSesi === 8 || s.nomorSesi === 16;

        if (s.kehadiran === "HADIR") {
          totalHadir++;
          totalHadirLengkap++;
          totalSesiTerlaksana++;
        } else if (s.kehadiran === "HADIR_TIDAK_LENGKAP") {
          totalHadir++;
          totalHadirTdkLengkap++;
          totalSesiTerlaksana++;
        } else if (s.kehadiran === "TIDAK_HADIR" || (s.kehadiran as string) === "ALPHA") {
          totalAlpha++;
          totalSesiTerlaksana++;
        }

        // 3 Pilar untuk sesi reguler (kecuali kelas Bimbingan karena bebas konten)
        if (!isExam && (cls.modePembelajaran as any) !== "BIMBINGAN") {
          totalRegularSesiTerlaksana++;
          const pilar = calculateSessionPillars(s, cls.modePembelajaran as any);
          if (pilar.score !== null) {
            totalSkor3PilarTerlaksana += pilar.score;
          }
        }
      }
    }

    // Kehadiran: hadir / total sesi terjadwal (bukan hanya yang sudah diisi)
    avgKehadiranUniv = roundPct(totalHadir, totalJadwalSesi);

    // Konten: Rerata persentase konten dari seluruh kelas reguler (Non-Bimbingan)
    // Selaras 1:1 dengan halaman Rekapitulasi Sesi
    avgKontenUniv = totalSemesterMaxKontenScore > 0
      ? Math.round((totalSemesterKontenScore / totalSemesterMaxKontenScore) * 1000) / 10
      : 0;

    // Kalkulasi tren monitoring per 16 sesi berdasarkan jenis kelas (ALL, OFFLINE, ONLINE, BIMBINGAN)
    function calculateTrendForClasses(classList: typeof rawClasses): TrendItem[] {
      const totalKelasInMode = classList.length;
      const nonBimbinganClasses = classList.filter(
        (c) => (c.modePembelajaran as any) !== "BIMBINGAN"
      );
      const totalNonBimbingan = nonBimbinganClasses.length;
      const targetPilarSesi = nonBimbinganClasses.reduce((acc, c) => acc + ((c.modePembelajaran as any) === "LURING" ? 2 : 3), 0);

      const sesiAgg = Array.from({ length: 16 }, (_, i) => ({
        nomorSesi: i + 1,
        totalHadir: 0,
        totalAlpha: 0,
        totalGantiHari: 0,
        totalBelumDiisi: 0,
        totalSkorPilar: 0,
        totalTerisi: 0,
        totalRegular: 0,
      }));

      for (const cls of classList) {
        const isBimbingan = (cls.modePembelajaran as any) === "BIMBINGAN";
        for (const s of cls.monitoringSesi) {
          const aggIndex = s.nomorSesi - 1;
          if (aggIndex < 0 || aggIndex >= 16) continue;
          const isExam = s.nomorSesi === 8 || s.nomorSesi === 16;

          if (s.kehadiran === "HADIR" || s.kehadiran === "HADIR_TIDAK_LENGKAP") {
            sesiAgg[aggIndex].totalHadir++;
            sesiAgg[aggIndex].totalTerisi++;
          } else if (s.kehadiran === "TIDAK_HADIR" || (s.kehadiran as string) === "ALPHA") {
            sesiAgg[aggIndex].totalAlpha++;
            sesiAgg[aggIndex].totalTerisi++;
          } else {
            // BELUM_DIISI
            const hasGantiNote = s.catatanCdu ? /ganti|reschedule|tunda/i.test(s.catatanCdu) : false;
            if (hasGantiNote) {
              sesiAgg[aggIndex].totalGantiHari++;
            } else {
              sesiAgg[aggIndex].totalBelumDiisi++;
            }
          }

          // 3 Pilar untuk sesi reguler (kecuali kelas Bimbingan karena bebas konten)
          if (!isExam && !isBimbingan) {
            const pilar = calculateSessionPillars(s, cls.modePembelajaran as any);
            if (pilar.score !== null) {
              sesiAgg[aggIndex].totalRegular++;
              sesiAgg[aggIndex].totalSkorPilar += pilar.score;
            }
          }
        }
      }

      return sesiAgg.map((agg) => {
        const isExam = agg.nomorSesi === 8 || agg.nomorSesi === 16;
        const sesiLabel =
          agg.nomorSesi === 8 ? "UTS" : agg.nomorSesi === 16 ? "UAS" : `S${agg.nomorSesi}`;
        const fullLabel =
          agg.nomorSesi === 8
            ? "Sesi 8 (UTS)"
            : agg.nomorSesi === 16
            ? "Sesi 16 (UAS)"
            : `Sesi ${agg.nomorSesi}`;

        const kehadiran =
          totalKelasInMode > 0 ? roundPct(agg.totalHadir, totalKelasInMode) : 0;

        let konten = 0;
        if (totalNonBimbingan === 0) {
          // Kelas Bimbingan dibebaskan dari 3 pilar konten
          konten = 0;
        } else if (isExam) {
          konten = kehadiran;
        } else {
          konten =
            targetPilarSesi > 0
              ? roundPct(agg.totalSkorPilar, targetPilarSesi)
              : 0;
        }

        return {
          sesi: sesiLabel,
          full: fullLabel,
          kehadiran,
          konten,
          totalKelas: totalKelasInMode,
          totalHadir: agg.totalHadir,
          totalAlpha: agg.totalAlpha,
          totalGantiHari: agg.totalGantiHari,
          totalBelumDiisi: agg.totalBelumDiisi,
          totalNonBimbingan,
          totalTerisi: agg.totalTerisi,
          totalRegular: agg.totalRegular,
          totalSkorPilar: agg.totalSkorPilar,
        };
      });
    }

    trendDataByMode = {
      ALL: calculateTrendForClasses(rawClasses),
      OFFLINE: calculateTrendForClasses(
        rawClasses.filter((c) => (c.modePembelajaran as string) === "LURING")
      ),
      ONLINE: calculateTrendForClasses(
        rawClasses.filter((c) => (c.modePembelajaran as string) === "DARING")
      ),
      BIMBINGAN: calculateTrendForClasses(
        rawClasses.filter((c) => (c.modePembelajaran as string) === "BIMBINGAN")
      ),
    };

    trendData = trendDataByMode.ALL;

    // Donut Chart Data (Distribution per Mode Pembelajaran)
    function calculateDistributionForClasses(classList: typeof rawClasses): ModeDistributionData {
      let hLengkap = 0;
      let hTdkLengkap = 0;
      let alphaCount = 0;
      let sesiTerlaksana = 0;

      for (const cls of classList) {
        for (const s of cls.monitoringSesi) {
          if (s.kehadiran === "HADIR") {
            hLengkap++;
            sesiTerlaksana++;
          } else if (s.kehadiran === "HADIR_TIDAK_LENGKAP") {
            hTdkLengkap++;
            sesiTerlaksana++;
          } else if (s.kehadiran === "TIDAK_HADIR" || (s.kehadiran as string) === "ALPHA") {
            alphaCount++;
            sesiTerlaksana++;
          }
        }
      }

      const hLengkapPct = sesiTerlaksana > 0 ? roundPct(hLengkap, sesiTerlaksana) : 0;
      const hTdkLengkapPct = sesiTerlaksana > 0 ? roundPct(hTdkLengkap, sesiTerlaksana) : 0;
      const alphaPct = sesiTerlaksana > 0 ? roundPct(alphaCount, sesiTerlaksana) : 0;

      return {
        totalSesi: sesiTerlaksana,
        totalKelas: classList.length,
        data: [
          {
            name: "Hadir Lengkap",
            value: hLengkapPct,
            count: hLengkap,
            color: "#10b981",
          },
          {
            name: "Hadir Tidak Lengkap",
            value: hTdkLengkapPct,
            count: hTdkLengkap,
            color: "#f59e0b",
          },
          {
            name: "Alpha / Tidak Hadir",
            value: alphaPct,
            count: alphaCount,
            color: "#ef4444",
          },
        ],
      };
    }

    distributionByMode = {
      ALL: calculateDistributionForClasses(rawClasses),
      OFFLINE: calculateDistributionForClasses(
        rawClasses.filter((c) => (c.modePembelajaran as string) === "LURING")
      ),
      ONLINE: calculateDistributionForClasses(
        rawClasses.filter((c) => (c.modePembelajaran as string) === "DARING")
      ),
      BIMBINGAN: calculateDistributionForClasses(
        rawClasses.filter((c) => (c.modePembelajaran as string) === "BIMBINGAN")
      ),
    };

    donutData = distributionByMode.ALL.data;

    // Recent Classes
    recentClassesList = rawClasses.slice(0, 6).map((cls) => {
      const filledSessions = cls.monitoringSesi.filter(
        (s) => s.kehadiran !== "BELUM_DIISI"
      ).length;

      let status: "LENGKAP" | "SEBAGIAN" | "BELUM" = "BELUM";
      if (filledSessions === 16) status = "LENGKAP";
      else if (filledSessions > 0) status = "SEBAGIAN";

      return {
        id: cls.id,
        kodeKelas: cls.kodeKelas,
        mataKuliah: cls.mataKuliah.nama,
        sks: cls.mataKuliah.sks,
        dosen: cls.dosen.nama,
        prodi: cls.mataKuliah.prodi?.nama || "Umum",
        progress: filledSessions,
        status,
      };
    });

    // Sparklines data 100% riil dihitung per 5 blok sesi dari database
    const kelasAktifBlok1 = new Set(rawClasses.filter(c => c.monitoringSesi.some(s => s.nomorSesi >= 1 && s.nomorSesi <= 3 && s.kehadiran !== "BELUM_DIISI")).map(c => c.id)).size;
    const kelasAktifBlok2 = new Set(rawClasses.filter(c => c.monitoringSesi.some(s => s.nomorSesi >= 4 && s.nomorSesi <= 6 && s.kehadiran !== "BELUM_DIISI")).map(c => c.id)).size;
    const kelasAktifBlok3 = new Set(rawClasses.filter(c => c.monitoringSesi.some(s => s.nomorSesi >= 7 && s.nomorSesi <= 9 && s.kehadiran !== "BELUM_DIISI")).map(c => c.id)).size;
    const kelasAktifBlok4 = new Set(rawClasses.filter(c => c.monitoringSesi.some(s => s.nomorSesi >= 10 && s.nomorSesi <= 12 && s.kehadiran !== "BELUM_DIISI")).map(c => c.id)).size;
    const kelasAktifBlok5 = new Set(rawClasses.filter(c => c.monitoringSesi.some(s => s.nomorSesi >= 13 && s.nomorSesi <= 16 && s.kehadiran !== "BELUM_DIISI")).map(c => c.id)).size;

    sparklineClassData = [
      { val: kelasAktifBlok1 },
      { val: kelasAktifBlok2 },
      { val: kelasAktifBlok3 },
      { val: kelasAktifBlok4 },
      { val: kelasAktifBlok5 },
    ];

    if (trendData.length === 16) {
      sparklineKehadiranData = [
        { val: Math.round((trendData[0].kehadiran + trendData[1].kehadiran + trendData[2].kehadiran) / 3) || avgKehadiranUniv },
        { val: Math.round((trendData[3].kehadiran + trendData[4].kehadiran + trendData[5].kehadiran) / 3) || avgKehadiranUniv },
        { val: Math.round((trendData[6].kehadiran + trendData[7].kehadiran) / 2) || avgKehadiranUniv },
        { val: Math.round((trendData[8].kehadiran + trendData[9].kehadiran + trendData[10].kehadiran) / 3) || avgKehadiranUniv },
        { val: Math.round((trendData[11].kehadiran + trendData[12].kehadiran + trendData[13].kehadiran + trendData[14].kehadiran + trendData[15].kehadiran) / 5) || avgKehadiranUniv },
      ];

      sparklineKontenData = [
        { val: Math.round((trendData[0].konten + trendData[1].konten + trendData[2].konten) / 3) || avgKontenUniv },
        { val: Math.round((trendData[3].konten + trendData[4].konten + trendData[5].konten) / 3) || avgKontenUniv },
        { val: Math.round((trendData[6].konten + trendData[7].konten) / 2) || avgKontenUniv },
        { val: Math.round((trendData[8].konten + trendData[9].konten + trendData[10].konten) / 3) || avgKontenUniv },
        { val: Math.round((trendData[11].konten + trendData[12].konten + trendData[13].konten + trendData[14].konten + trendData[15].konten) / 5) || avgKontenUniv },
      ];
    }

    const isSesiAlpha = (s: any) => s.kehadiran === "TIDAK_HADIR" || (s.kehadiran as string) === "ALPHA";
    const alphaBlok1 = rawClasses.flatMap(c => c.monitoringSesi.filter(s => s.nomorSesi >= 1 && s.nomorSesi <= 3 && isSesiAlpha(s))).length;
    const alphaBlok2 = rawClasses.flatMap(c => c.monitoringSesi.filter(s => s.nomorSesi >= 4 && s.nomorSesi <= 6 && isSesiAlpha(s))).length;
    const alphaBlok3 = rawClasses.flatMap(c => c.monitoringSesi.filter(s => s.nomorSesi >= 7 && s.nomorSesi <= 9 && isSesiAlpha(s))).length;
    const alphaBlok4 = rawClasses.flatMap(c => c.monitoringSesi.filter(s => s.nomorSesi >= 10 && s.nomorSesi <= 12 && isSesiAlpha(s))).length;
    const alphaBlok5 = rawClasses.flatMap(c => c.monitoringSesi.filter(s => s.nomorSesi >= 13 && s.nomorSesi <= 16 && isSesiAlpha(s))).length;

    sparklineAlphaData = [
      { val: alphaBlok1 },
      { val: alphaBlok2 },
      { val: alphaBlok3 },
      { val: alphaBlok4 },
      { val: alphaBlok5 },
    ];
  } catch (err) {
    console.error("Dashboard database fetch error:", err);
  }

  const userName = session?.user?.name || "Staff CDU";

  return (
    <div className="space-y-4">
      {/* ── 1. Top Greeting & Action Header ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-none">
            Selamat Datang, {userName}! 👋
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-1">
            Berikut ringkasan aktivitas monitoring perkuliahan semester{" "}
            <span className="font-semibold text-[#a80063]">
              {activeSemester
                ? `${activeSemester.tahunAkademik} (${activeSemester.periode})`
                : "Aktif"}
            </span>
          </p>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/70 text-xs font-medium text-slate-600">
            <Calendar size={13} className="text-[#a80063]" />
            <span>
              {activeSemester
                ? `${activeSemester.tahunAkademik} ${activeSemester.periode}`
                : "Semester Aktif"}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Top 5 Metric Cards with Sparklines ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        <SparklineCard
          title="Total Kelas Aktif"
          value={totalKelas}
          subtitle={`${totalProdi} Prodi • ${totalDosen} Dosen terdaftar`}
          trendText={`Sem. Aktif`}
          isPositive={true}
          segments={[
            { label: "Offline", value: kelasOffline, color: "blue" },
            { label: "Online", value: kelasOnline, color: "emerald" },
            { label: "Bimbingan", value: kelasBimbingan, color: "violet" },
          ]}
          details={[
            { label: "Offline", value: kelasOffline, color: "blue" },
            { label: "Online", value: kelasOnline, color: "emerald" },
            { label: "Bimbingan", value: kelasBimbingan, color: "violet" },
          ]}
        />

        <SparklineCard
          title="Rata-rata Kehadiran"
          value={formatPct(avgKehadiranUniv)}
          valueColor="emerald"
          subtitle={`Seluruh ${totalKelas} kelas • ${totalSesiTerlaksana} sesi tercatat`}
          trendText={avgKehadiranUniv >= 90 ? "Target Tercapai" : "Di Bawah Target"}
          isPositive={avgKehadiranUniv >= 90}
          progress={avgKehadiranUniv}
          progressColor="emerald"
          details={[
            { label: "Hadir", value: `${totalHadir}`, color: "emerald" },
            { label: "Alpha", value: `${totalAlpha}`, color: "rose" },
            { label: "Target CDU", value: "≥90%", color: "slate" },
          ]}
        />

        <SparklineCard
          title="Rata-rata Konten"
          value={formatPct(avgKontenUniv)}
          valueColor="maroon"
          subtitle={`Rerata skor 3 Pilar dari ${totalKelasNonBimbingan} kelas reguler`}
          trendText={avgKontenUniv >= 75 ? "Sesuai Standar" : "Perlu Optimasi"}
          isPositive={avgKontenUniv >= 75}
          progress={avgKontenUniv}
          progressColor="maroon"
          details={[
            { label: "L/S", value: "Pilar 1", color: "maroon" },
            { label: "T/Q", value: "Pilar 2", color: "maroon" },
            { label: "V/C", value: "Pilar 3", color: "maroon" },
          ]}
        />

        <SparklineCard
          title={`Progres Monitoring - Sesi ${currentActiveSesi}`}
          value={formatPct(persenSelesaiSesiAktif)}
          subtitle={`${sudahDimonitorSesiAktif}/${totalKelas} kelas telah dicek`}
          trendText="Minggu Ini"
          isPositive={persenSelesaiSesiAktif >= 80}
          progress={persenSelesaiSesiAktif}
          progressColor="emerald"
          details={[
            { label: "Selesai", value: sudahDimonitorSesiAktif, color: "emerald" },
            { label: "Belum", value: belumDimonitorSesiAktif, color: "rose" },
            { label: "Target", value: "100%", color: "slate" },
          ]}
        />

        <SparklineCard
          title="Kelas Perlu Perhatian"
          value={`${kelasPerluPerhatianCount} Kelas`}
          subtitle={`${totalAlpha} sesi alpha terdeteksi`}
          trendText={kelasPerluPerhatianCount === 0 ? "Kondisi Baik" : `${kelasPerluPerhatianCount} Perlu Dicek`}
          isPositive={kelasPerluPerhatianCount === 0}
          segments={[
            { label: "Perhatian", value: kelasPerluPerhatianCount, color: "rose" },
            { label: "Terlaksana", value: Math.max(0, totalKelas - kelasPerluPerhatianCount), color: "emerald" },
          ]}
          details={[
            { label: "Perhatian", value: kelasPerluPerhatianCount, color: "rose" },
            { label: "Terlaksana", value: Math.max(0, totalKelas - kelasPerluPerhatianCount), color: "emerald" },
          ]}
        />
      </div>

      {/* ── 3. Middle Row: Unified Trend Spline Chart & Donut Distribution Chart ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <div className="lg:col-span-2">
          <MonitoringTrendChart
            trendDataByMode={trendDataByMode}
            sessionData={trendData}
          />
        </div>

        <div className="lg:col-span-1">
          <StatusDonutChart
            distributionByMode={distributionByMode}
            data={donutData}
            totalSesi={totalSesiTerlaksana}
          />
        </div>
      </div>

      {/* ── 4. Bottom Row: Status Monitoring Kelas Terkini (Full Width) ────────── */}
      <div>
        <RecentClassesTable classes={recentClassesList} />
      </div>
    </div>
  );
}
