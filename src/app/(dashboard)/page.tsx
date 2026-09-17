// src/app/(dashboard)/page.tsx
// CDU Monitoring - Real-Data Dashboard (Plus Jakarta Sans)

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Calendar } from "lucide-react";
import SparklineCard from "@/components/dashboard/SparklineCard";
import MonitoringTrendChart, {
  TrendItem,
  WeeklyTrendItem,
} from "@/components/dashboard/MonitoringTrendChart";
import StatusDonutChart, { DonutStatusItem } from "@/components/dashboard/StatusDonutChart";
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
  let weeklyTrendData: WeeklyTrendItem[] = [];
  let donutData: DonutStatusItem[] = [];

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
    let sumPersenKontenNonBimbingan = 0;
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
        sumPersenKontenNonBimbingan += summary.persenKonten;
      }

      for (const s of cls.monitoringSesi) {
        const isExam = s.nomorSesi === 8 || s.nomorSesi === 16;
        const aggIndex = s.nomorSesi - 1;

        if (s.kehadiran === "HADIR") {
          totalHadir++;
          totalHadirLengkap++;
          totalSesiTerlaksana++;

          if (aggIndex >= 0 && aggIndex < 16) {
            sesiAggregates[aggIndex].totalTerisi++;
            sesiAggregates[aggIndex].totalHadir++;
          }
        } else if (s.kehadiran === "HADIR_TIDAK_LENGKAP") {
          totalHadir++;
          totalHadirTdkLengkap++;
          totalSesiTerlaksana++;

          if (aggIndex >= 0 && aggIndex < 16) {
            sesiAggregates[aggIndex].totalTerisi++;
            sesiAggregates[aggIndex].totalHadir++;
          }
        } else if (s.kehadiran === "TIDAK_HADIR") {
          totalAlpha++;
          totalSesiTerlaksana++;

          if (aggIndex >= 0 && aggIndex < 16) {
            sesiAggregates[aggIndex].totalTerisi++;
          }
        }

        // 3 Pilar untuk sesi reguler (kecuali kelas Bimbingan karena bebas konten)
        if (!isExam && (cls.modePembelajaran as any) !== "BIMBINGAN") {
          totalRegularSesiTerlaksana++;
          const pilar = calculateSessionPillars(s);
          if (pilar.score !== null) {
            totalSkor3PilarTerlaksana += pilar.score;
            if (aggIndex >= 0 && aggIndex < 16) {
              sesiAggregates[aggIndex].totalRegular++;
              sesiAggregates[aggIndex].totalSkorPilar += pilar.score;
            }
          }
        }
      }
    }

    // Kehadiran: hadir / total sesi terjadwal (bukan hanya yang sudah diisi)
    avgKehadiranUniv = roundPct(totalHadir, totalJadwalSesi);

    // Konten: Rerata persentase konten dari seluruh kelas reguler (Non-Bimbingan)
    // Selaras 1:1 dengan halaman Rekapitulasi Sesi
    avgKontenUniv = totalKelasNonBimbingan > 0
      ? Math.round((sumPersenKontenNonBimbingan / totalKelasNonBimbingan) * 10) / 10
      : 0;

    const targetPilarSesi = totalKelasNonBimbingan * 3;

    // Trend S1 - S16 (Per Sesi): Mengukur capaian terhadap seluruh kelas aktif universitas
    trendData = sesiAggregates.map((agg) => {
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
        totalKelas > 0 ? roundPct(agg.totalHadir, totalKelas) : 0;

      let konten = 0;
      if (isExam) {
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
        totalTerisi: agg.totalTerisi,
        totalRegular: agg.totalRegular,
        totalSkorPilar: agg.totalSkorPilar,
      };
    });

    // Trend Minggu 1 - 16 (Periode Mingguan): Mengukur capaian terhadap seluruh kelas aktif universitas
    weeklyTrendData = sesiAggregates.map((agg) => {
      const isExam = agg.nomorSesi === 8 || agg.nomorSesi === 16;
      const mingguLabel =
        agg.nomorSesi === 8
          ? "M8 (UTS)"
          : agg.nomorSesi === 16
          ? "M16 (UAS)"
          : `M${agg.nomorSesi}`;

      const fullLabel =
        agg.nomorSesi === 8
          ? "Minggu 8 (Pekan UTS)"
          : agg.nomorSesi === 16
          ? "Minggu 16 (Pekan UAS)"
          : `Minggu ${agg.nomorSesi}`;

      const periodeLabel =
        agg.nomorSesi === 1
          ? "Awal Semester"
          : agg.nomorSesi === 8
          ? "Pekan UTS"
          : agg.nomorSesi === 16
          ? "Pekan UAS"
          : agg.nomorSesi === 7
          ? "Pra-UTS"
          : agg.nomorSesi === 15
          ? "Pra-UAS"
          : "Pekan Perkuliahan";

      const kehadiran =
        totalKelas > 0 ? roundPct(agg.totalHadir, totalKelas) : 0;

      let konten = 0;
      if (isExam) {
        konten = kehadiran;
      } else {
        konten =
          targetPilarSesi > 0
            ? roundPct(agg.totalSkorPilar, targetPilarSesi)
            : 0;
      }

      return {
        minggu: mingguLabel,
        full: fullLabel,
        periodeLabel,
        kehadiran,
        konten,
        totalSesi: agg.totalTerisi,
        totalHadir: agg.totalHadir,
      };
    });

    // Donut Chart Data
    const hadirLengkapPersen =
      totalSesiTerlaksana > 0
        ? roundPct(totalHadirLengkap, totalSesiTerlaksana)
        : 0;
    const hadirTdkLengkapPersen =
      totalSesiTerlaksana > 0
        ? roundPct(totalHadirTdkLengkap, totalSesiTerlaksana)
        : 0;
    const alphaPersen =
      totalSesiTerlaksana > 0
        ? roundPct(totalAlpha, totalSesiTerlaksana)
        : 0;

    donutData = [
      {
        name: "Hadir Lengkap",
        value: hadirLengkapPersen,
        count: totalHadirLengkap,
        color: "#10b981",
      },
      {
        name: "Hadir Tidak Lengkap",
        value: hadirTdkLengkapPersen,
        count: totalHadirTdkLengkap,
        color: "#f59e0b",
      },
      {
        name: "Alpha / Tidak Hadir",
        value: alphaPersen,
        count: totalAlpha,
        color: "#ef4444",
      },
    ];

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

    const alphaBlok1 = rawClasses.flatMap(c => c.monitoringSesi.filter(s => s.nomorSesi >= 1 && s.nomorSesi <= 3 && s.kehadiran === "TIDAK_HADIR")).length;
    const alphaBlok2 = rawClasses.flatMap(c => c.monitoringSesi.filter(s => s.nomorSesi >= 4 && s.nomorSesi <= 6 && s.kehadiran === "TIDAK_HADIR")).length;
    const alphaBlok3 = rawClasses.flatMap(c => c.monitoringSesi.filter(s => s.nomorSesi >= 7 && s.nomorSesi <= 9 && s.kehadiran === "TIDAK_HADIR")).length;
    const alphaBlok4 = rawClasses.flatMap(c => c.monitoringSesi.filter(s => s.nomorSesi >= 10 && s.nomorSesi <= 12 && s.kehadiran === "TIDAK_HADIR")).length;
    const alphaBlok5 = rawClasses.flatMap(c => c.monitoringSesi.filter(s => s.nomorSesi >= 13 && s.nomorSesi <= 16 && s.kehadiran === "TIDAK_HADIR")).length;

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
            sessionData={trendData}
            weeklyData={weeklyTrendData}
          />
        </div>

        <div className="lg:col-span-1">
          <StatusDonutChart data={donutData} totalSesi={totalSesiTerlaksana} />
        </div>
      </div>

      {/* ── 4. Bottom Row: Status Monitoring Kelas Terkini (Full Width) ────────── */}
      <div>
        <RecentClassesTable classes={recentClassesList} />
      </div>
    </div>
  );
}
