// src/app/(dashboard)/page.tsx
// CDU Monitoring — Real-Data Dashboard (Plus Jakarta Sans)

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  FileDown,
  Calendar,
  ClipboardList,
  BarChart3,
  School,
  ArrowRight,
  Sparkles,
  Users,
} from "lucide-react";
import SparklineCard from "@/components/dashboard/SparklineCard";
import MonitoringTrendChart, { TrendItem } from "@/components/dashboard/MonitoringTrendChart";
import WeeklyMonitoringTrendChart, { WeeklyTrendItem } from "@/components/dashboard/WeeklyMonitoringTrendChart";
import StatusDonutChart, { DonutStatusItem } from "@/components/dashboard/StatusDonutChart";
import RecentClassesTable from "@/components/dashboard/RecentClassesTable";
import { calculateClassSummary, calculateSessionPillars } from "@/lib/score-calculator";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const session = await auth();

  let totalKelas = 0;
  let totalDosen = 0;
  let totalProdi = 0;
  let activeSemester: any = null;
  let recentClassesList: any[] = [];
  let avgKehadiranUniv = 0;
  let avgKontenUniv = 0;
  let kelasPerluPerhatianCount = 0;
  let totalAlpha = 0;
  let totalSesiTerlaksana = 0;
  let trendData: TrendItem[] = [];
  let weeklyTrendData: WeeklyTrendItem[] = [];
  let donutData: DonutStatusItem[] = [];

  let sparklineClassData = [{ val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }];
  let sparklineKehadiranData = [{ val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }];
  let sparklineKontenData = [{ val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }];
  let sparklineAlphaData = [{ val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }];

  try {
    activeSemester =
      (await prisma.semester.findFirst({
        where: { aktif: true },
      })) ||
      (await prisma.semester.findFirst({
        orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
      }));

    totalDosen = await prisma.dosen.count();
    totalProdi = await prisma.prodi.count();

    const rawClasses = await prisma.kelas.findMany({
      where: activeSemester ? { semesterId: activeSemester.id } : {},
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

    let totalHadir = 0;
    let totalHadirLengkap = 0;
    let totalHadirTdkLengkap = 0;
    let totalRegularSesiTerlaksana = 0;
    let totalSkor3PilarTerlaksana = 0;

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
        cls.modePembelajaran as any
      );

      if (summary.statusEvaluasi === "PERLU_PERHATIAN" || summary.totalAlpha >= 2) {
        kelasPerluPerhatianCount++;
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

        // 3 Pilar untuk sesi reguler yang sudah terlaksana (kecuali kelas Bimbingan karena bebas konten)
        if (!isExam && s.kehadiran !== "BELUM_DIISI" && (cls.modePembelajaran as any) !== "BIMBINGAN") {
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

    avgKehadiranUniv =
      totalSesiTerlaksana > 0
        ? Math.round((totalHadir / totalSesiTerlaksana) * 100)
        : 0;

    avgKontenUniv =
      totalRegularSesiTerlaksana > 0
        ? Math.round((totalSkor3PilarTerlaksana / (totalRegularSesiTerlaksana * 3)) * 100)
        : 0;

    // Trend S1 - S16 (Per Sesi)
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
        agg.totalTerisi > 0 ? Math.round((agg.totalHadir / agg.totalTerisi) * 100) : 0;

      let konten = 0;
      if (isExam) {
        konten = kehadiran;
      } else {
        konten =
          agg.totalRegular > 0
            ? Math.round((agg.totalSkorPilar / (agg.totalRegular * 3)) * 100)
            : 0;
      }

      return {
        sesi: sesiLabel,
        full: fullLabel,
        kehadiran,
        konten,
      };
    });

    // Trend Minggu 1 - 16 (Periode Mingguan)
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
        agg.totalTerisi > 0 ? Math.round((agg.totalHadir / agg.totalTerisi) * 100) : 0;

      let konten = 0;
      if (isExam) {
        konten = kehadiran;
      } else {
        konten =
          agg.totalRegular > 0
            ? Math.round((agg.totalSkorPilar / (agg.totalRegular * 3)) * 100)
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
        ? Math.round((totalHadirLengkap / totalSesiTerlaksana) * 100)
        : 0;
    const hadirTdkLengkapPersen =
      totalSesiTerlaksana > 0
        ? Math.round((totalHadirTdkLengkap / totalSesiTerlaksana) * 100)
        : 0;
    const alphaPersen =
      totalSesiTerlaksana > 0
        ? Math.round((totalAlpha / totalSesiTerlaksana) * 100)
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
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-none">
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

          <Link
            href="/laporan/rekap"
            className="btn-brand inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold shadow-xs"
          >
            <FileDown size={14} />
            <span>Export Laporan</span>
          </Link>
        </div>
      </div>

      {/* ── 2. Top 4 Metric Cards with Sparklines ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <SparklineCard
          title="Total Kelas Aktif"
          value={totalKelas}
          subtitle={`Dari ${totalProdi} Prodi • ${totalDosen} Dosen`}
          trendText={`${totalKelas} Kelas`}
          isPositive={true}
          colorHex="#a80063"
          chartData={sparklineClassData}
        />

        <SparklineCard
          title="Rata-rata Kehadiran"
          value={`${avgKehadiranUniv}%`}
          subtitle="Target 90% CDU"
          trendText={avgKehadiranUniv >= 90 ? "Target Tercapai" : "Di Bawah Target"}
          isPositive={avgKehadiranUniv >= 90}
          colorHex="#10b981"
          chartData={sparklineKehadiranData}
        />

        <SparklineCard
          title="Kelengkapan Konten"
          value={`${avgKontenUniv}%`}
          subtitle="3 Pilar: Slide, Tugas, Video/Conf"
          trendText={avgKontenUniv >= 75 ? "Sesuai Standar" : "Perlu Optimasi"}
          isPositive={avgKontenUniv >= 75}
          colorHex="#8b5cf6"
          chartData={sparklineKontenData}
        />

        <SparklineCard
          title="Kelas Perlu Perhatian"
          value={`${kelasPerluPerhatianCount} Kelas`}
          subtitle={`${totalAlpha} sesi Alpha tercatat`}
          trendText={kelasPerluPerhatianCount === 0 ? "Kondisi Baik" : `${kelasPerluPerhatianCount} Perlu Ditindak`}
          isPositive={kelasPerluPerhatianCount === 0}
          colorHex="#ef4444"
          chartData={sparklineAlphaData}
        />
      </div>

      {/* ── 3. Middle Row: Trend Spline Charts (Per Sesi & Per Minggu) ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
        <MonitoringTrendChart data={trendData} />
        {/* <WeeklyMonitoringTrendChart data={weeklyTrendData} /> */}
      </div>

      {/* ── 4. Bottom Row: Recent Classes Table + Status Donut & Quick Actions ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RecentClassesTable classes={recentClassesList} />
        </div>

        <div className="lg:col-span-1 space-y-4">
          <StatusDonutChart data={donutData} totalSesi={totalSesiTerlaksana} />

          {/* Quick Action Widget Card */}
          {/* <div className="duralux-card p-4 sm:p-5 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-lg bg-[#fdf2f8] text-[#a80063] flex items-center justify-center text-xs font-bold">
                ⚡
              </span>
              <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                Aksi Cepat CDU
              </h3>
            </div>

            <div className="space-y-2">
              {[
                {
                  label: "Input Monitoring Kelas",
                  desc: "Grid 16 Sesi perkuliahan",
                  href: "/monitoring",
                  icon: ClipboardList,
                  bg: "bg-[#fdf2f8]",
                  text: "text-[#a80063]",
                },
                {
                  label: "Laporan per Dosen",
                  desc: "Evaluasi kepatuhan mengajar",
                  href: "/laporan/dosen",
                  icon: Users,
                  bg: "bg-emerald-50",
                  text: "text-emerald-600",
                },
                {
                  label: "Laporan per Program Studi",
                  desc: "Rekap performa & evaluasi alpha prodi",
                  href: "/laporan/prodi",
                  icon: BarChart3,
                  bg: "bg-amber-50",
                  text: "text-amber-600",
                },
                {
                  label: "Tabel Rekapitulasi",
                  desc: "Export Excel & Rekap Komprehensif",
                  href: "/laporan/rekap",
                  icon: FileDown,
                  bg: "bg-blue-50",
                  text: "text-blue-600",
                },
                {
                  label: "Kelola Master Kelas",
                  desc: "Dosen, Mata Kuliah & Jadwal",
                  href: "/master/kelas",
                  icon: School,
                  bg: "bg-purple-50",
                  text: "text-purple-600",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-[#fbcfe8] hover:bg-[#fdf2f8]/40 transition-all text-slate-800"
                  >
                    <div
                      className={`w-7 h-7 rounded-lg ${item.bg} ${item.text} flex items-center justify-center shrink-0 transition-transform group-hover:scale-105`}
                    >
                      <Icon size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xs text-slate-800 group-hover:text-[#a80063] transition-colors truncate">
                        {item.label}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {item.desc}
                      </p>
                    </div>
                    <ArrowRight
                      size={13}
                      className="text-slate-400 group-hover:text-[#a80063] group-hover:translate-x-0.5 transition-all shrink-0"
                    />
                  </Link>
                );
              })}
            </div>
          </div> */}

          {/* Mini Guide Widget Card */}
          {/* <div className="p-4 rounded-xl bg-gradient-to-tr from-[#1e1b4b] to-[#312e81] text-white relative overflow-hidden shadow-xs">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-white text-[9px] font-semibold backdrop-blur-md mb-1.5">
                <Sparkles size={10} className="text-[#f472b6]" />
                <span>Aturan CDU</span>
              </div>
              <h4 className="text-xs font-bold text-white">
                Sesi 8 (UTS) & 16 (UAS)
              </h4>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed font-normal">
                Hanya kehadiran dosen yang dicatat. Konten otomatis dinonaktifkan (NULL) untuk sesi ujian.
              </p>
            </div>
          </div> */}
        </div>
      </div>
    </div>
  );
}
